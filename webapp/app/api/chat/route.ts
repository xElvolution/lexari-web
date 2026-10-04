import { and, eq } from "drizzle-orm";
import { currentSession } from "@/server/auth/session";
import { ModelError, llmConfig, streamCompletion } from "@/server/engram/cortex";
import { splitRemember } from "@/server/engram/hippocampus";
import { buildPrompt } from "@/server/engram/spinal";
import { recordEvent } from "@/server/events";
import { db } from "@/server/db";
import { agents, chats, jobs, messages } from "@/server/db/schema";
import { configError, jsonError, rateLimit, readJson, toErrorResponse } from "@/server/http";
import { chatBody } from "@/server/validate";
import { SPECIALISTS } from "@/content/appData";
import { desktopOn, runInDesktop, runRequests } from "@/server/desktop";

export const runtime = "nodejs";

const PER_MINUTE = Number(process.env.CHAT_PER_MINUTE || 12);
const PER_DAY = Number(process.env.CHAT_PER_DAY || 300);

/** One reply from the agent, streamed as SSE. Needs a session; the agent's settings come from the database. */
export async function POST(req: Request) {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  let session;
  try {
    session = await currentSession();
  } catch (error) {
    return toErrorResponse(error);
  }
  if (!session) return jsonError(401, "You're signed out. Sign in again.");
  const body = await readJson(req, chatBody);
  if (body instanceof Response) return body;
  try {
    if (!(await rateLimit(`chat:m:${session.userId}`, PER_MINUTE))) return jsonError(429, "That's a lot of messages. Wait a minute.");
    if (!(await rateLimit(`chat:d:${session.userId}`, PER_DAY, 86_400_000))) return jsonError(429, "You've reached today's message limit. It resets tomorrow.");
  } catch (error) {
    return toErrorResponse(error);
  }
  if (!llmConfig().ready) {
    console.error(`[chat] provider ${llmConfig().provider} is not configured`);
    return jsonError(503, "Your agent can't reply right now. Try again later.");
  }

  const userId = session.userId;
  const database = db();
  const mine = await database.select().from(agents).where(eq(agents.userId, userId));
  const home = mine.find((a) => a.slug === "home");
  const speakerRow = mine.find((a) => a.slug === body.speaker);
  const house = SPECIALISTS.find((s) => s.slug === body.speaker);
  if (!home) return jsonError(400, "Finish setting up your agent first.");
  if (body.speaker !== "home" && !speakerRow) return jsonError(403, "That agent is not on your team.");
  const speakerName = (speakerRow?.meta as { nick?: string })?.nick || speakerRow?.name || body.speaker;
  const role = speakerRow?.kind === "hired" ? house?.job || speakerRow.role : speakerRow?.role || home.role;
  const tone = speakerRow?.tone || home.tone || "short";
  const prompt = buildPrompt({
    agentName: home.name, role, tone, speaker: speakerName,
    about: speakerRow?.kind === "custom" ? speakerRow.about : house?.back || "",
    you: (home.meta as { you?: string })?.you || "",
    history: body.history, recall: speakerRow?.memoryOn === false ? [] : body.recall, text: body.text,
  });

  const tools = desktopOn();
  if (tools) prompt[0] = { ...prompt[0], content: `${prompt[0].content}\n${DESKTOP_HINT}` };

  const sent = Date.now();
  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); } catch {} };
      let full = "";
      try {
        // Stream the reply, but hold text back from the first "<" so <run> requests never reach the screen.
        let shown = 0;
        for await (const token of streamCompletion(prompt, abort.signal)) {
          full += token;
          const cut = tools ? (full.indexOf("<") >= 0 ? full.indexOf("<") : full.length) : full.length;
          if (cut > shown) { send({ token: full.slice(shown, cut) }); shown = cut; }
        }
        const cmds = tools ? runRequests(full) : [];
        if (cmds.length) {
          // The agent asked to use its computer: run the commands in this person's container, then let it answer with the output.
          const results: string[] = [];
          for (const cmd of cmds) {
            send({ tool: { cmd } });
            const r = await runInDesktop(userId, cmd).catch((e: Error) => ({ code: 1, out: `could not run: ${e.message}` }));
            results.push(`$ ${cmd}\n${r.out.slice(0, 3000)}${r.code ? `\n(exit ${r.code})` : ""}`);
          }
          const before = full.slice(0, full.indexOf("<run>")).trim();
          const follow = [...prompt, { role: "assistant" as const, content: full }, { role: "user" as const, content: `Output from your computer:\n${results.join("\n\n")}\n\nNow answer the person in plain sentences. Do not write <run> again.` }];
          let answer = "";
          if (before && shown > 0) send({ token: "\n\n" });
          for await (const token of streamCompletion(follow, abort.signal)) { answer += token; send({ token }); }
          full = `${before && shown > 0 ? before + "\n\n" : ""}${answer.replace(/<run>[\s\S]*?<\/run>/g, "").trim()}`;
        } else if (tools && shown < full.length) {
          send({ token: full.slice(shown) });
        }
        const split = splitRemember(full);
        if (!split.reply) throw new ModelError("The agent sent an empty reply. Try again.");
        if (split.remember) send({ remember: split.remember });
        await saveTurn(userId, body, speakerRow?.slug || "home", split.reply, sent);
        await recordEvent(userId, "message", { ref: body.userMsgId });
        // A real request to a specialist or an agent you made is a job, with the reply as its output.
        if (body.speaker !== "home" && body.text.trim().length >= 12) {
          const now = new Date();
          await database.insert(jobs).values({
            userId, agentId: speakerRow?.id, assignee: body.speaker, prompt: body.text.slice(0, 2000), status: "done",
            title: body.text.replace(/\s+/g, " ").slice(0, 80), output: split.reply, startedAt: now, finishedAt: now,
          });
        }
        send({ done: true });
      } catch (error) {
        if (error instanceof ModelError) { console.error(`[chat] ${error.message}`); send({ error: error.friendly }); }
        else { console.error(`[chat] ${(error as Error)?.message || "failed"}`); send({ error: "Your agent couldn't reply. Try again." }); }
      } finally {
        try { controller.close(); } catch {}
      }
    },
    cancel() { abort.abort(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-store", "x-accel-buffering": "no" } });
}

async function saveTurn(userId: string, body: { convo: string; text: string; userMsgId: string; replyMsgId: string; meta: Record<string, unknown> }, speaker: string, reply: string, sent: number) {
  const database = db();
  let [chat] = await database.select().from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, body.convo))).limit(1);
  if (!chat) [chat] = await database.insert(chats).values({ userId, kind: body.convo.startsWith("g-") ? "group" : "dm", slug: body.convo, title: speaker }).onConflictDoNothing().returning();
  if (!chat) [chat] = await database.select().from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, body.convo))).limit(1);
  const meta = Object.keys(body.meta || {}).length ? body.meta : null;
  await database.insert(messages).values([
    { chatId: chat.id, fromId: "you", text: body.text, clientId: body.userMsgId, metaJson: meta, createdAt: new Date(sent) },
    { chatId: chat.id, fromId: speaker, text: reply, clientId: body.replyMsgId, createdAt: new Date(Math.max(Date.now(), sent + 1)) },
  ]).onConflictDoNothing();
  await database.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chat.id));
}

const DESKTOP_HINT = [
  "You have your own Linux computer (bash, python3, git, no internet). Files live in /home/agent and the person can watch your terminal in the Desktop view.",
  "When the person asks you to make or change files, run code, or check something on your computer, write each shell command as <run>command</run> (at most three).",
  "You will then get the output and must answer in plain sentences. Never pretend you ran something you did not.",
].join(" ");
