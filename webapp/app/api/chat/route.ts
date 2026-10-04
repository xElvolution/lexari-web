import { notify } from "@/server/notify";
import { and, eq } from "drizzle-orm";
import { currentSession } from "@/server/auth/session";
import { ModelError, llmConfig, streamCompletion } from "@/server/engram/cortex";
import { splitRemember } from "@/server/engram/hippocampus";
import { buildPrompt } from "@/server/engram/spinal";
import { recordEvent } from "@/server/events";
import { db, retryRead } from "@/server/db";
import { agents, chats, jobs, messages, users } from "@/server/db/schema";
import { WALLET_HINT, checkSend, stripWalletTags, walletFacts, walletRequests, type SendReq } from "@/server/walletTools";
import { configError, jsonError, rateLimit, readJson, toErrorResponse } from "@/server/http";
import { chatBody } from "@/server/validate";
import { lockedSlugs } from "@/server/plans";
import { SPECIALISTS } from "@/content/appData";
import { desktopOn, runInDesktop, runRequests } from "@/server/desktop";
import { DESKTOP_MARK } from "@/server/engram/grokCli";

export const runtime = "nodejs";

const PER_MINUTE = Number(process.env.CHAT_PER_MINUTE || 12);
const PER_DAY = Number(process.env.CHAT_PER_DAY || 300);

/** One reply from the agent, streamed as SSE. Needs a session; the agent's settings come from the database. */
export async function POST(req: Request) {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  let session;
  try {
    session = await retryRead(() => currentSession());
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
  let mine;
  try { mine = await retryRead(() => database.select().from(agents).where(eq(agents.userId, userId))); } catch (error) { return toErrorResponse(error); }
  const home = mine.find((a) => a.slug === "home");
  const speakerRow = mine.find((a) => a.slug === body.speaker);
  const house = SPECIALISTS.find((s) => s.slug === body.speaker);
  if (!home) return jsonError(400, "Finish setting up your agent first.");
  if (body.speaker !== "home" && !speakerRow) return jsonError(403, "That agent is not on your team.");
  if (body.speaker !== "home") {
    const locked = await lockedSlugs(userId).catch(() => [] as string[]);
    if (locked.includes(body.speaker)) return jsonError(402, `${(speakerRow?.meta as { nick?: string })?.nick || speakerRow?.name || "This agent"} is locked on your plan. Upgrade to keep working with them.`);
  }
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
  const [me] = await retryRead(() => database.select({ wallet: users.wallet }).from(users).where(eq(users.id, userId)).limit(1)).catch(() => []);
  const wallet = me?.wallet || "";
  if (wallet) prompt[0] = { ...prompt[0], content: `${prompt[0].content}\n${WALLET_HINT}` };
  const hold = tools || !!wallet;

  // Your message is saved before the agent starts, so it never disappears if the reply fails or the page reloads.
  let userSaved = false;
  try { await saveUserMsg(userId, body); userSaved = true; } catch (error) { console.error(`[chat] save user message: ${(error as Error).message}`); }

  const sent = Date.now();
  const encoder = new TextEncoder();
  const abort = new AbortController();
  // Leaving or reloading the page must not lose the reply: keep generating and save it; the app picks it up on its next load.
  // Only a hard cap stops a runaway reply.
  const cap = setTimeout(() => abort.abort(), 180_000);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); } catch {} };
      let full = "";
      try {
        // Stream the reply, but hold text back from the first "<" so <run> requests never reach the screen.
        let shown = 0;
        for await (const token of streamCompletion(prompt, abort.signal)) {
          full += token;
          const cut = hold ? (full.indexOf("<") >= 0 ? full.indexOf("<") : full.length) : full.length;
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
        }
        // Wallet tags: reads are answered with real chain data; a send becomes a confirm card only you can approve.
        let pay: SendReq | null = null;
        if (wallet) {
          const w = walletRequests(full);
          if (w.reads.length) {
            const facts = await walletFacts(wallet, w.reads);
            const before = stripWalletTags(full.slice(0, full.search(/<wallet>/i))).trim();
            const follow = [...prompt, { role: "assistant" as const, content: full }, { role: "user" as const, content: `Lexari wallet data:\n${facts}\n\nNow answer the person in plain sentences using this data. Do not write <wallet> again.` }];
            let answer = "";
            if (before && shown > 0) send({ token: "\n\n" });
            for await (const token of streamCompletion(follow, abort.signal)) { answer += token; }
            const clean = stripWalletTags(answer);
            send({ token: clean });
            full = `${before && shown > 0 ? before + "\n\n" : ""}${clean}${w.sends.length ? full.slice(full.search(/<send/i)) : ""}`;
            shown = full.length;
          }
          if (w.sends.length) {
            const c = checkSend(w.sends[0], wallet);
            if (c.ok) { pay = c.send; send({ send: pay }); }
            else { const note = `\n\n(I couldn't prepare that transfer: ${c.why})`; full += note; send({ token: note }); }
          }
          const visible = stripWalletTags(full);
          if (visible.length > shown && !w.reads.length) send({ token: visible.slice(shown) });
          full = visible;
          if (!full && pay) full = `I've prepared ${pay.sol} SOL to ${pay.to.slice(0, 4)}…${pay.to.slice(-4)}. Tap Confirm to send it.`;
        } else if (tools && shown < full.length) {
          send({ token: full.slice(shown) });
        }
        const split = splitRemember(full);
        if (!split.reply) throw new ModelError("The agent sent an empty reply. Try again.");
        if (split.remember) send({ remember: split.remember });
        await saveTurn(userId, body, speakerRow?.slug || "home", split.reply, sent, pay ? { send: pay } : null, userSaved);
        await recordEvent(userId, "message", { ref: body.userMsgId });
        // Push only reaches you when no Lexari tab is in front (the service worker checks).
        await notify(userId, { kind: "reply", title: speakerName || "Your agent", body: split.reply.replace(/\s+/g, " ").slice(0, 140), url: `/app?c=${encodeURIComponent(body.convo)}`, key: `reply:${body.replyMsgId}` });
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
        clearTimeout(cap);
        try { controller.close(); } catch {}
      }
    },
    cancel() { /* the browser went away: finish and save anyway */ },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-store", "x-accel-buffering": "no" } });
}

type TurnBody = { convo: string; text: string; userMsgId: string; replyMsgId: string; meta: Record<string, unknown> };
async function chatRow(userId: string, convo: string, title: string) {
  const database = db();
  let [chat] = await database.select().from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, convo))).limit(1);
  if (!chat) [chat] = await database.insert(chats).values({ userId, kind: convo.startsWith("g-") ? "group" : "dm", slug: convo, title }).onConflictDoNothing().returning();
  if (!chat) [chat] = await database.select().from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, convo))).limit(1);
  return chat;
}
async function saveUserMsg(userId: string, body: TurnBody & { speaker: string }) {
  const chat = await retryRead(() => chatRow(userId, body.convo, body.speaker));
  const meta = Object.keys(body.meta || {}).length ? body.meta : null;
  await retryRead(() => db().insert(messages).values({ chatId: chat.id, fromId: "you", text: body.text, clientId: body.userMsgId, metaJson: meta, createdAt: new Date() }).onConflictDoNothing());
}
async function saveTurn(userId: string, body: TurnBody, speaker: string, reply: string, sent: number, replyMeta: Record<string, unknown> | null = null, userSaved = false) {
  const database = db();
  let [chat] = await database.select().from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, body.convo))).limit(1);
  if (!chat) [chat] = await database.insert(chats).values({ userId, kind: body.convo.startsWith("g-") ? "group" : "dm", slug: body.convo, title: speaker }).onConflictDoNothing().returning();
  if (!chat) [chat] = await database.select().from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, body.convo))).limit(1);
  const meta = Object.keys(body.meta || {}).length ? body.meta : null;
  await database.insert(messages).values([
    ...(userSaved ? [] : [{ chatId: chat.id, fromId: "you", text: body.text, clientId: body.userMsgId, metaJson: meta, createdAt: new Date(sent) }]),
    { chatId: chat.id, fromId: speaker, text: reply, clientId: body.replyMsgId, metaJson: replyMeta, createdAt: new Date(Math.max(Date.now(), sent + 1)) },
  ]).onConflictDoNothing();
  await database.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chat.id));
}

const DESKTOP_HINT = [
  DESKTOP_MARK,
  "You have your own Linux computer with a graphical desktop and a Chromium web browser (bash, python3, git, curl, xdotool; the public web is reachable through a filtered proxy). Files live in /home/agent and the person can watch your screen and terminal in the Desktop view.",
  "To show the person a web page on your screen run <run>browse https://example.com</run>. To read a page's text yourself run <run>readpage https://example.com</run>. To see which windows are open run <run>screen-info</run>. You can click and type in the browser with xdotool (for example <run>xdotool key ctrl+l && xdotool type 'lexari.ai' && xdotool key Return</run>).",
  "When the person asks you to make or change files, run code, or check something on your computer, write each shell command as <run>command</run> (at most three).",
  "You will then get the output and must answer in plain sentences. Never pretend you ran something you did not.",
].join(" ");
