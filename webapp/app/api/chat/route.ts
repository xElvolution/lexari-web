import { INTERRUPTED } from "@/lib/callTurn";
import { notify } from "@/server/notify";
import { and, eq } from "drizzle-orm";
import { currentSession } from "@/server/auth/session";
import { ModelError, llmConfig, modelReady, streamCompletion } from "@/server/engram/cortex";
import { gatewayReady } from "@/server/engram/gateway";
import { LAMINA, modelById } from "@/content/models";
import { beginTurn, isBlocked, type Blocked, type Turn } from "@/server/billing/meter";
import { splitRemember } from "@/server/engram/hippocampus";
import { buildPrompt } from "@/server/engram/spinal";
import { recordEvent } from "@/server/events";
import { db, retryRead } from "@/server/db";
import { agents, chats, jobs, messages } from "@/server/db/schema";
import { WALLET_HINT, checkSend, stripWalletTags, walletFacts, walletRequests, type SendReq } from "@/server/walletTools";
import { historyBlock, readTx, settleTx, walletHistory, type TxEvent } from "@/server/txlog";
import { FUND_HINT, fundRequest, hireWallet, stripFundTags } from "@/server/hireWallet";
import { configError, jsonError, rateLimit, readJson, toErrorResponse } from "@/server/http";
import { chatBody } from "@/server/validate";
import { lockedSlugs } from "@/server/plans";
import { SPECIALISTS } from "@/content/appData";
import { desktopOn, runInDesktop, runRequests } from "@/server/desktop";
import { DESKTOP_MARK } from "@/server/engram/grokCli";
import { CU_BUDGET_MS, computerOn, computerTask, runComputer, stripComputer } from "@/server/computer";
import { agentLevel, takeShift } from "@/server/hub/levels";
import { attachFromComputer, fileTags, ownFiles, saveGenerated, stripFileTags, type FileItem } from "@/server/agentFiles";
import { generateImage, imageGenOn, imagineTask, stripImagine } from "@/server/imageGen";
import { grokVision, visionOn, type VisionImage } from "@/server/engram/grokCli";
import type { ModelInfo } from "@/content/models";
import { queuePriority, recallSize, shifts } from "@/lib/perks";

export const runtime = "nodejs";

const PER_MINUTE = Number(process.env.CHAT_PER_MINUTE || 12);
const PER_DAY = Number(process.env.CHAT_PER_DAY || 300);
const CU_PER_HOUR = Number(process.env.CU_PER_HOUR || 10); // computer-use tasks per person per hour
const IMAGES_PER_HOUR = Number(process.env.IMAGES_PER_HOUR || 20); // pictures from the image tool per person per hour

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
  // both limits and the agents read go out together (a call turn waits on every round trip)
  const minePromise = retryRead(() => db().select().from(agents).where(eq(agents.userId, session.userId)));
  minePromise.catch(() => {});
  try {
    // Every member of a group answers the same message: only the first answer counts against the per-minute limit.
    const groupFollow = (body.follow === true && body.convo.startsWith("g-") && !body.call) || !!body.event;
    const [perMin, perDay] = await Promise.all([groupFollow ? Promise.resolve(true) : rateLimit(`chat:m:${session.userId}`, PER_MINUTE), rateLimit(`chat:d:${session.userId}`, PER_DAY, 86_400_000)]);
    if (!perMin) return jsonError(429, "That's a lot of messages. Wait a minute.");
    if (!perDay) return jsonError(429, "You've reached today's message limit. It resets tomorrow.");
  } catch (error) {
    return toErrorResponse(error);
  }
  if (!llmConfig().ready && !gatewayReady()) {
    console.error(`[chat] provider ${llmConfig().provider} is not configured`);
    return jsonError(503, "Your agent can't reply right now. Try again later.");
  }

  const userId = session.userId;
  const database = db();
  let mine;
  try { mine = await minePromise; } catch (error) { return toErrorResponse(error); }
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
  // The model: this chat's pick, else the agent's, else Lamina (content/models.ts).
  const [chatPick] = await retryRead(() => database.select({ model: chats.model }).from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, body.convo))).limit(1)).catch(() => []);
  const model = modelById(chatPick?.model) ?? modelById(speakerRow?.model) ?? LAMINA;
  if (!modelReady(model)) return jsonError(409, `${model.label} isn't available on this server yet. Switch to Lamina to keep going.`, { billing: { reason: "model_unavailable", model: model.id, modelLabel: model.label } });
  // In a group, earlier turns by other members are labelled with their names, and the agent knows who else is in the room.
  const isGroupChat = body.convo.startsWith("g-");
  const nameFor = (slug: string) => { const r = mine.find((a) => a.slug === slug); return (r?.meta as { nick?: string })?.nick || r?.name || SPECIALISTS.find((x) => x.slug === slug)?.name || slug; };
  let members: string[] = [];
  if (isGroupChat) {
    const [g] = await retryRead(() => database.select({ members: chats.memberSlugs, title: chats.title }).from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, body.convo))).limit(1)).catch(() => []);
    members = (g?.members || []).filter((m) => m !== body.speaker).map(nameFor);
  }
  const history = isGroupChat ? body.history.map((t) => (t.from !== "you" && t.from !== body.speaker ? { ...t, text: `${nameFor(t.from)} said: ${t.text}` } : t)) : body.history;
  const peers = (body.peers || []).filter((p) => p.from !== body.speaker);
  const upload = !body.call ? await uploadNote(userId, body.meta) : "";
  const said = `${body.text}${upload}`;
  const text = peers.length ? `${said}\n\n(Already answered in the group:\n${peers.map((p) => `${nameFor(p.from)}: ${p.text}`).join("\n")}\nNow give YOUR answer as ${speakerName}. Add something of your own; don't repeat them or speak for them.)` : said;
  // Level perks: Quick replies / Priority desk jump the model queue, Bigger memory reads more notes, Second shift runs two at once.
  const level = speakerRow && speakerRow.kind !== "hired" ? await agentLevel(userId, speakerRow.slug) : body.speaker === "home" ? await agentLevel(userId, "home") : 1;
  const priority = queuePriority(level);
  const prompt = buildPrompt({
    agentName: home.name, role, tone, speaker: speakerName,
    about: speakerRow?.kind === "custom" ? speakerRow.about : house?.back || "",
    you: (home.meta as { you?: string })?.you || "",
    history, recall: speakerRow?.memoryOn === false ? [] : body.recall, recallMax: recallSize(level), text,
  });
  prompt[0] = { ...prompt[0], content: `${prompt[0].content}\nYour name is ${speakerName}. When the person says your name (even misspelled by speech-to-text), they mean you.${isGroupChat && members.length ? ` You are in a group chat with ${members.join(", ")}${body.call ? " on a group voice call" : ""}. Every member answers in turn in their own voice. Only speak as yourself, never write lines for the others, and don't prefix your reply with your name.` : ""}` };

  const call = body.call === true;
  if (call) prompt[0] = { ...prompt[0], content: `${prompt[0].content}\n${CALL_HINT}${cutOff(body.history) ? `\n${INTERRUPT_HINT}` : ""}` };
  const tools = !call && desktopOn();
  if (tools) prompt[0] = { ...prompt[0], content: `${prompt[0].content}\n${DESKTOP_HINT}\n${FILES_HINT}` };
  // The image tool (a new picture from a description) only exists when an image key is set; otherwise the agent says so.
  const imagineOn = !call && imageGenOn();
  if (!call) prompt[0] = { ...prompt[0], content: `${prompt[0].content}\n${imagineOn ? IMAGINE_HINT : IMAGINE_OFF}` };
  const event = !call && body.event ? body.event : null;
  // The wallet tools (send, read) are for chat turns; every turn (calls too) reads the wallet history below.
  const owner = session.wallet || "";
  const wallet = call ? "" : owner;
  // Your agents can use your wallet (with a confirm card). A hired specialist never touches it: it has its own task
  // wallet and asks you to fund it for a task.
  const hiredSpeaker = speakerRow?.kind === "hired";
  if (wallet) prompt[0] = { ...prompt[0], content: `${prompt[0].content}\n${hiredSpeaker ? FUND_HINT(speakerName) : WALLET_HINT}` };
  const hold = tools || !!wallet || imagineOn;
  const tz = body.tz || "UTC";
  const savingUser: Promise<boolean> = !call && !(body.follow === true || !!event)
    ? saveUserMsg(userId, body).then(() => true, (error) => { console.error(`[chat] save user message: ${(error as Error).message}`); return false; })
    : Promise.resolve(false);
  // Transaction memory: your recent transactions (receipts in chats plus the chain) on every chat and call turn.
  // A call never waits long for it (whatever is cached is used).
  let receipt: TxEvent | null = null;
  if (event) receipt = await settleTx(userId, body.convo, event.tx.replace(/^tx-/, ""), owner, 40_000).catch(() => readTx(userId, body.convo, event.tx.replace(/^tx-/, "")).catch(() => null));
  if (event && !receipt) return jsonError(404, "There is no such transaction.");
  // Usage: reserve the estimated cost before calling the model (settled with the real cost after). Runs alongside the
  // wallet history read so it adds no wait.
  const turnP = beginTurn({ userId, model, convo: body.convo, agent: body.speaker, kind: event ? "event" : call ? "call" : body.follow ? "follow" : "chat", prompt });
  turnP.catch(() => {});
  if (owner) {
    const snap = await walletHistory(userId, owner, call ? 300 : 3500).catch(() => null);
    if (snap) prompt[0] = { ...prompt[0], content: `${prompt[0].content}\n${historyBlock(snap, owner, tz)}` };
  }
  if (event && receipt) prompt[prompt.length - 1] = { role: "user", content: eventPrompt(receipt) };
  let turn: Turn;
  try {
    const t = await turnP;
    if (isBlocked(t)) return jsonError(402, blockedText(t), { billing: t });
    turn = t;
  } catch (error) {
    return toErrorResponse(error);
  }
  const usage = { model, onUsage: turn.add };

  // Your message is saved before the agent starts, so it never disappears if the reply fails or the page reloads.
  // The save starts before the wallet reads above and runs alongside them, so its timestamp sits close to when you sent it.
  let userSaved = body.follow === true || !!event; // a later group member answers a message the first one already saved
  if (!call && !userSaved) userSaved = await savingUser;
  // Your message counts for the message quests as soon as it is saved, not when the reply finishes (or if it fails).
  const counted: Promise<boolean> = !call && !body.follow && !event && userSaved
    ? recordEvent(userId, "message", { ref: body.userMsgId }).then(() => true, () => false) : Promise.resolve(false);

  const sent = Date.now();
  const encoder = new TextEncoder();
  const abort = new AbortController();
  // Leaving or reloading the page must not lose the reply: keep generating and save it; the app picks it up on its next load.
  // Only a hard cap stops a runaway reply.
  const cap = setTimeout(() => abort.abort(), 180_000);
  // A call turn the person talked over (or hung up on) is dropped right away, so it doesn't hold a model slot.
  if (call) req.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); } catch {} };
      let full = "";
      let shownText = "";
      const show = (t: string) => { if (t) { shownText += t; send({ token: t }); } };
      // Second shift: one agent answers one turn at a time (two from level 5); a call turn never waits.
      let leave: (() => void) | null = null;
      try {
        if (!call) leave = await takeShift(`${userId}:${body.speaker}`, shifts(level)).catch(() => null);
        // Stream the reply, but hold text back from the first "<" so <run> requests never reach the screen.
        let shown = 0;
        for await (const token of streamCompletion(prompt, abort.signal, { fast: call, priority, ...usage })) {
          full += token;
          const cut = hold ? (full.indexOf("<") >= 0 ? full.indexOf("<") : full.length) : full.length;
          if (cut > shown) { show(full.slice(shown, cut)); shown = cut; }
        }
        // A task for the agent's computer: it looks at its screen and clicks/types step by step (server/computer.ts),
        // with live progress ({cu}) and the screenshots it took attached to this reply ({shots}).
        const task = tools && computerOn() ? computerTask(full) : null;
        if (task) {
          clearTimeout(cap);
          const cuCap = setTimeout(() => abort.abort(), CU_BUDGET_MS + 90_000);
          const before = stripComputer(full.slice(0, full.search(/<computer>/i))).trim();
          const ok = await rateLimit(`cu:h:${userId}`, CU_PER_HOUR, 3_600_000).catch(() => false);
          const r = !ok ? { text: "I've used my computer a lot this hour. Give me a bit and ask again.", shots: [] as number[] }
            : await runComputer(userId, body.convo, body.replyMsgId, task, `The person wrote: ${body.text.slice(0, 400)}`, (p) => send({ cu: p }), abort.signal)
              .catch((e: Error) => { console.error(`[computer] ${e.message}`); return { text: "My computer stopped responding, so I couldn't finish that. Try again in a moment.", shots: [] as number[] }; });
          clearTimeout(cuCap);
          if (r.shots.length) send({ shots: { id: body.replyMsgId, n: r.shots } });
          send({ cu: null });
          full = `${before && shown > 0 ? before + "\n\n" : ""}${r.text}`;
          show(full.slice(shown));
          shown = full.length;
        }
        const askedFiles = tools ? fileTags(full) : [];
        const cmds = tools && !task ? runRequests(full) : [];
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
          if (before && shown > 0) show("\n\n");
          let sentA = 0;
          for await (const token of streamCompletion(follow, abort.signal, { priority, ...usage })) {
            answer += token;
            const cut = answer.indexOf("<") >= 0 ? answer.indexOf("<") : answer.length;
            if (cut > sentA) { show(answer.slice(sentA, cut)); sentA = cut; }
          }
          full = `${before && shown > 0 ? before + "\n\n" : ""}${answer.replace(/<run>[\s\S]*?<\/run>/g, "").trim()}`;
        }
        // Wallet tags: reads are answered with real chain data; a send becomes a confirm card only you can approve.
        let pay: SendReq | null = null;
        if (wallet && hiredSpeaker) {
          const f = event ? null : fundRequest(full);
          const visible = stripFundTags(stripWalletTags(full));
          if (visible.length > shown) show(visible.slice(shown));
          full = visible;
          if (f) {
            pay = { to: hireWallet(userId, speakerRow!.slug).publicKey.toBase58(), sol: 0, usd: f.usd, status: "pending", kind: "fund", agent: speakerRow!.slug, reason: f.reason };
            send({ send: pay });
            if (!full) full = `I need $${f.usd}${f.reason ? ` for ${f.reason}` : ""}. Tap Confirm to send it from your balance to my wallet; anything I don't use goes back to your balance.`;
          }
        } else if (wallet) {
          const w = walletRequests(full);
          if (w.reads.length) {
            const facts = await walletFacts(wallet, w.reads);
            const before = stripWalletTags(full.slice(0, full.search(/<wallet>/i))).trim();
            const follow = [...prompt, { role: "assistant" as const, content: full }, { role: "user" as const, content: `Lexari wallet data:\n${facts}\n\nNow answer the person in plain sentences using this data. Do not write <wallet> again.` }];
            let answer = "";
            if (before && shown > 0) show("\n\n");
            for await (const token of streamCompletion(follow, abort.signal, { priority, ...usage })) { answer += token; }
            const clean = stripWalletTags(answer);
            show(clean);
            full = `${before && shown > 0 ? before + "\n\n" : ""}${clean}${w.sends.length ? full.slice(full.search(/<send/i)) : ""}`;
            shown = full.length;
          }
          if (event) w.sends = [];
          if (w.sends.length) {
            const c = checkSend(w.sends[0], wallet);
            if (c.ok) { pay = c.send; send({ send: pay }); }
            else { const note = `\n\n(I couldn't prepare that transfer: ${c.why})`; full += note; show(note); }
          }
          const visible = stripWalletTags(full);
          if (visible.length > shown && !w.reads.length) show(visible.slice(shown));
          full = visible;
          if (!full && pay) full = `I've prepared ${pay.sol} SOL to ${pay.to.slice(0, 4)}…${pay.to.slice(-4)}. Tap Confirm to send it.`;
        } else if (tools && shown < full.length) {
          show(full.slice(shown));
        }
        // Files: the ones the agent named come off its computer, and <imagine> makes a new picture (metered as premium).
        const files: FileItem[] = [];
        if (!call && !event) {
          const paths = [...new Set([...askedFiles, ...(tools ? fileTags(full) : [])])].slice(0, 4);
          const idea = imagineOn ? imagineTask(full) : null;
          full = stripFileTags(stripImagine(full));
          const ctx = { agent: speakerRow?.slug || "home", convo: body.convo, messageId: body.replyMsgId };
          const notes: string[] = [];
          if (paths.length) {
            send({ tool: { files: paths.length } });
            const r = await attachFromComputer(userId, ctx, paths).catch((e: Error) => { console.error(`[files] ${e.message}`); return { items: [] as FileItem[], notes: ["my computer didn't hand the file over"] }; });
            files.push(...r.items); notes.push(...r.notes);
          }
          if (idea) {
            send({ tool: { imagine: true } });
            const made = await imagine(userId, body.convo, ctx, idea, abort.signal);
            if (made.item) files.push(made.item); else notes.push(made.note);
          }
          if (notes.length) full = `${full}${full ? "\n\n" : ""}(${notes.join("; ")}.)`;
          if (!full.trim() && files.length) full = files.length === 1 ? `Here's ${files[0].name}.` : `Here are the ${files.length} files.`;
          if (files.length) send({ files });
        }
        // What reached the screen must match the saved reply: add what's missing, or replace it when they differ.
        if (full.startsWith(shownText)) show(full.slice(shownText.length));
        else { shownText = full; send({ replace: full }); }
        const split = splitRemember(full);
        if (!split.reply) throw new ModelError("The agent sent an empty reply. Try again.");
        if (split.remember) send({ remember: split.remember });
        if (call) { send({ done: true }); return; } // a call is not saved as chat messages
        await saveTurn(userId, body, speakerRow?.slug || "home", split.reply, sent, pay || files.length ? { ...(pay ? { send: pay } : {}), ...(files.length ? { files } : {}) } : event ? { about: event.tx } : null, userSaved);
        if (!body.follow && !event && !(await counted)) await recordEvent(userId, "message", { ref: body.userMsgId });
        // Push only reaches you when no Lexari tab is in front (the service worker checks).
        await notify(userId, { kind: "reply", title: speakerName || "Your agent", body: split.reply.replace(/\s+/g, " ").slice(0, 140), url: `/agents/${encodeURIComponent(body.convo)}`, key: `reply:${body.replyMsgId}` });
        // A real request to a specialist or an agent you made is a job, with the reply as its output.
        if (body.speaker !== "home" && body.text.trim().length >= 12 && !body.follow && !event) {
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
        leave?.();
        clearTimeout(cap);
        await turn.settle().catch((e: Error) => console.error(`[billing] settle: ${e.message}`));
        try { controller.close(); } catch {}
      }
    },
    cancel() { /* the browser went away: finish and save anyway */ },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-store", "x-accel-buffering": "no" } });
}

/** What the person sees in the chat when a turn is out of usage (the app also opens the out-of-usage sheet). */
function blockedText(b: Blocked) {
  if (b.reason === "free_daily") return "You've used today's free Lamina. It refills tomorrow, or upgrade to Pro to keep going.";
  if (b.reason === "premium_locked") return `${b.modelLabel} is a premium model. Upgrade to Pro, top up credits, or switch to Lamina.`;
  if (b.reason === "spend_limit") return "You've reached your monthly spend limit on extra credits. Raise it in Billing to keep going.";
  return `You've used the included usage for ${b.modelLabel} this cycle. Top up credits or move up a plan${b.model === "lamina" ? "" : ", or switch to Lamina"}.`;
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

const sh = (a?: string) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");
const amt = (n: number) => `${+n.toFixed(6)} SOL`;
/** What the agent is told when a receipt lands (in place of a message from the person). */
function eventPrompt(e: TxEvent) {
  const what: Record<string, string> = {
    send: `a transfer of ${amt(e.sol)} to ${sh(e.to)} that you prepared`, fund: `funding ${amt(e.sol)} into ${e.label || "a hired agent's task wallet"} (${sh(e.to)})`,
    return: `returning ${amt(e.sol)} of leftover SOL from ${e.label?.replace(/^you \(from (.*)\)$/, "$1") || "the task wallet"} to the person's wallet`,
    hire: `a hire payment of ${amt(e.sol)}`, plan: `a plan payment of ${amt(e.sol)}${e.label ? ` (${e.label})` : ""}`, card: `a card payment of ${amt(e.sol)}${e.label ? ` (${e.label})` : ""}`,
    mint: `minting the agent's ID card on chain${e.sol ? ` (it cost ${amt(e.sol)})` : ""}`, incoming: `${amt(e.sol)} arriving from ${e.label || sh(e.from)}`,
  };
  const status = e.status === "confirmed" ? "It CONFIRMED on Solana devnet." : e.status === "failed" ? `It FAILED${e.error ? `: ${e.error}` : ""}. Nothing moved except perhaps a network fee.` : e.status === "cancelled" ? "The person CANCELLED it. Nothing was sent." : "It was sent but is still PENDING confirmation.";
  const bal = e.balance !== undefined && e.balance >= 0 ? ` The person's wallet balance is now ${amt(e.balance)}.` : "";
  return [
    `[Lexari event, not a message from the person] The Confirm card in this chat just finished: ${what[e.kind] || e.kind}. ${status}${e.sig ? ` Signature ${sh(e.sig)}.` : ""}${e.fee ? ` Network fee ${amt(e.fee)}.` : ""}${bal}`,
    "Reply to the person in one or two short, natural sentences acknowledging exactly this result (amount, short address, devnet status" + (bal ? ", new balance" : "") + "). If it failed or was cancelled, say so plainly and offer to try again. No tags, no links, no lists, and do not say REMEMBER.",
  ].join("\n");
}

const CALL_HINT = "You are on a live voice call with the person right now. Talk like a person on the phone: answer in one or two short spoken sentences (about 30 words at most, never more than two sentences), start with the answer, no lists, markdown, emojis, links or headings. Ask at most one short question back. You are already mid-conversation: only your very first reply on the call may greet them; after that never open with a greeting (hello, hi, hey) or their name, just answer.";
const INTERRUPT_HINT = `The person just talked over you, so your previous reply was cut off; it is in the history only up to where it stopped, marked ${INTERRUPTED}. Do not repeat, continue or finish that reply, and don't mention being interrupted. Answer only their latest message, directly.`;
/** True when the agent's most recent turn in the call history was cut off by the person talking over it. */
function cutOff(history: { from: string; text: string }[]) {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].from !== "you") return history[i].text.includes(INTERRUPTED);
  return false;
}

const FILES_HINT = [
  "To send the person a file from your computer (a script, CSV, image, PDF and so on), put <file>/home/agent/path/to/file</file> at the end of your reply, one tag per file, at most four. Lexari attaches it as a file card they can preview and download.",
  "Do this whenever they ask you to send, share, attach or give them a file, and after you make or edit one for them. Make the file first with <run>, then attach it in your answer. Save new files in /home/agent/Outputs (mkdir -p it first).",
  "Photos and files the person uploads are on your computer in /home/agent/Uploads. To edit images use Python with Pillow (python3 -c \"from PIL import Image, ImageDraw, ImageFont; ...\") or ImageMagick (convert, identify), save the result in /home/agent/Outputs and send it back with <file>.",
].join(" ");
const IMAGINE_HINT = "To make a brand new picture from a description (not an edit of a photo), write <imagine>a detailed description of the picture</imagine>, at most one per reply. The picture is attached to your reply. Don't say which tool or company makes it.";
const IMAGINE_OFF = "If the person asks you to generate, draw or create a brand new AI image from a description, tell them AI image generation isn't switched on yet. You can still edit photos they upload and make charts or graphics with code.";

/** Usage for one picture from the image tool: premium usage first, then credits (never the free Lamina pool). */
const IMAGES: ModelInfo = { id: "images", label: "Image making", short: "Images", maker: "", blurb: "", pool: "premium", price: { in: 0, out: 0 } };
async function imagine(userId: string, convo: string, ctx: { agent: string; convo: string; messageId: string }, idea: string, signal: AbortSignal): Promise<{ item?: FileItem; note: string }> {
  const ok = await rateLimit(`img:h:${userId}`, IMAGES_PER_HOUR, 3_600_000).catch(() => false);
  if (!ok) return { note: "I've made a lot of pictures this hour, so try again in a bit" };
  const t = await beginTurn({ userId, model: IMAGES, convo, agent: ctx.agent, kind: "chat", prompt: [{ content: idea }] }).catch(() => null);
  if (!t) return { note: "I couldn't make the picture right now" };
  if (isBlocked(t)) return { note: t.reason === "premium_locked" ? "making pictures needs Pro or credits, so I couldn't make it" : "you're out of premium usage and credits for pictures, so I couldn't make it" };
  try {
    const g = await generateImage(idea, signal);
    t.add({ model: "images", promptTokens: 0, completionTokens: 0, costUsd: g.costUsd, estimated: false });
    const ext = g.data[0] === 0xff ? "jpg" : "png";
    const name = `${idea.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "picture"}.${ext}`;
    return { item: await saveGenerated(userId, ctx, name, g.data), note: "" };
  } catch (e) {
    console.error(`[imagine] ${e instanceof ModelError ? e.message : (e as Error).message}`);
    return { note: "the picture couldn't be made right now" };
  } finally {
    await t.settle().catch((e: Error) => console.error(`[billing] image settle: ${e.message}`));
  }
}

/** A file you attached to this message: where it is on the agent's computer and, for a photo, what it shows. */
async function uploadNote(userId: string, meta: Record<string, unknown> | undefined) {
  const f = (meta as { file?: { id?: string } } | undefined)?.file;
  if (!f?.id) return "";
  const [row] = await ownFiles(userId, [f.id]).catch(() => []);
  if (!row) return "";
  const kb = row.size >= 1048576 ? `${(row.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(row.size / 1024))} KB`;
  const img = row.mime === "image/png" || row.mime === "image/jpeg";
  let seen = "";
  if (img && visionOn() && row.size <= 4 * 1048576) {
    const pic: VisionImage = { mime: row.mime as VisionImage["mime"], data: Buffer.from(row.data).toString("base64") };
    seen = await grokVision("You describe images for an assistant that will edit them. In two or three plain sentences say what the picture shows, its layout and orientation, main colours, and any text in it.", "Describe this image.", [pic], AbortSignal.timeout(30_000))
      .then((t) => t.replace(/\s+/g, " ").trim().slice(0, 700)).catch(() => "");
  }
  const where = row.path ? `It is on your computer at ${row.path}.` : "It couldn't be copied to your computer.";
  const look = seen ? ` What it shows: ${seen}` : row.mime.startsWith("image/") ? " You can't see the picture itself right now, but you can still edit it with code." : "";
  return `\n\n[The person attached ${row.name} (${kb}). ${where}${look}]`;
}

const DESKTOP_HINT = [
  DESKTOP_MARK,
  "You have your own Linux computer with a graphical desktop and a Chromium web browser (bash, python3, git, curl, xdotool; the public web is reachable through a filtered proxy). Files live in /home/agent and the person can watch your screen and terminal in the Desktop view.",
  "To show the person a web page on your screen run <run>browse https://example.com</run>. To read a page's text yourself run <run>readpage https://example.com</run>. To see which windows are open run <run>screen-info</run>. You can click and type in the browser with xdotool (for example <run>xdotool key ctrl+l && xdotool type 'lexari.ai' && xdotool key Return</run>).",
  "When the person asks you to make or change files, run code, or check something on your computer, write each shell command as <run>command</run> (at most three).",
  "For anything you need to SEE and operate on screen (open a site and look at it, search the web and show a page, click through a site, fill in a form, send a screenshot), write one <computer>the task in a sentence, with any details the person gave</computer> instead, after a few words like \"On it.\". Lexari then lets you look at your screen and click, type and scroll step by step, and your reply gets the screenshots attached. Use <computer> rather than xdotool for this. You never enter passwords, payment details or 2FA codes; the person does that part.",
  "You will then get the output and must answer in plain sentences. Never pretend you ran something you did not.",
].join(" ");
