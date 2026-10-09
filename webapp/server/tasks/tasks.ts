/**
 * Agent tasks: work that outlives a chat turn, on the agent's own computer.
 *  - meeting: meetbot joins a Zoom / Meet / Teams / Jitsi call in the agent's browser (silent, mic and camera off),
 *    records, transcribes offline; Lexari posts the summary, decisions, action items and the transcript in the chat.
 *  - job / video / deploy: a long command (lx-job) that reports back when it ends, with any files it lists.
 *  - schedule: a recurring instruction; at each run the agent does it and posts the result in the chat.
 * The poller (tick, started in instrumentation.ts) follows running jobs and starts due schedules.
 */
import crypto from "node:crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { agentTasks } from "../db/tasksSchema";
import { agents, chats, messages, users } from "../db/schema";
import { desktopOn, jobStart, jobStatus, jobStop, pullDesktop, runInDesktop, shq, type JobStatus } from "../desktop";
import { complete, streamCompletion, type ChatMessage } from "../engram/cortex";
import { buildPrompt } from "../engram/spinal";
import { notify } from "../notify";
import { attachFromComputer, type FileItem } from "../agentFiles";
import { HttpError } from "../http";
import { secretEnv } from "../secrets";
import { meetName } from "./meet";
import { everyLabel, everyText, nextRun, okTz, parseEvery, type Every } from "./schedule";
import type { MeetPlatform, TaskKind, TaskRef, TaskStatus, TaskView } from "@/content/tasks";

type Row = typeof agentTasks.$inferSelect;
const MEETINGS_PER_DAY = Number(process.env.MEETINGS_PER_DAY || 6);
const MEETINGS_MAX = Number(process.env.MEETINGS_MAX || 2); // at once, across the whole server (CPU)
const MEETING_MAX_SECS = Number(process.env.MEETING_MAX_SECS || 7200);
const JOBS_PER_HOUR = Number(process.env.JOBS_PER_HOUR || 12);
const SCHEDULES_MAX = Number(process.env.SCHEDULES_MAX || 10);
const OPEN: TaskStatus[] = ["running", "waiting"];

export function view(r: Row): TaskView {
  const st = r.state as { phase?: string; reason?: string; joinedAt?: number; seconds?: number; endedAt?: number; link?: string };
  const sp = r.spec as { mode?: "me" | "agent"; platform?: MeetPlatform; name?: string; every?: string; link?: string };
  const ev = sp.every ? parseEvery(sp.every) : null;
  return {
    id: r.id, kind: r.kind as TaskKind, status: r.status as TaskStatus, title: r.title, agent: r.agent, convo: r.convo,
    phase: st.phase, detail: r.result?.slice(0, 220) || st.reason || undefined, createdAt: r.createdAt.getTime(), finishedAt: r.finishedAt?.getTime(),
    joinedAt: st.joinedAt ? st.joinedAt * 1000 : undefined, secs: st.seconds, mode: sp.mode, platform: sp.platform, name: sp.name,
    every: ev ? everyLabel(ev) : undefined, nextRun: r.nextRun?.getTime(), runs: r.runs, link: st.link || sp.link,
  };
}
export const ref = (r: Row): TaskRef => ({ id: r.id, kind: r.kind as TaskKind, title: r.title });
const jobId = () => `t-${crypto.randomBytes(6).toString("hex")}`;

export async function names(userId: string, agent: string) {
  const [[u], [a]] = await Promise.all([
    db().select({ profile: users.profile }).from(users).where(eq(users.id, userId)).limit(1),
    db().select().from(agents).where(and(eq(agents.userId, userId), eq(agents.slug, agent))).limit(1),
  ]);
  let userName = String((u?.profile as { name?: string })?.name || "").trim();
  if (!userName) { // what the person told their home agent to call them
    const [h] = await db().select({ meta: agents.meta }).from(agents).where(and(eq(agents.userId, userId), eq(agents.slug, "home"))).limit(1);
    userName = String((h?.meta as { you?: string })?.you || "").trim();
  }
  const agentName = String((a?.meta as { nick?: string })?.nick || a?.name || "Your agent");
  return { userName, agentName, row: a };
}

/** Joins a meeting as the person or as their agent. Returns the new task. */
export async function startMeeting(userId: string, input: { agent: string; convo: string; url: string; platform: MeetPlatform; mode: "me" | "agent"; messageId?: string }) {
  if (!desktopOn()) throw new HttpError(503, "Your agent's computer isn't available right now.");
  const database = db();
  const open = await database.select().from(agentTasks).where(and(eq(agentTasks.userId, userId), eq(agentTasks.kind, "meeting"), inArray(agentTasks.status, OPEN))).limit(1);
  if (open.length) throw new HttpError(409, "Your agent is already in a meeting. Stop that one first.");
  const [{ n: today }] = await database.select({ n: sql<number>`count(*)::int` }).from(agentTasks)
    .where(and(eq(agentTasks.userId, userId), eq(agentTasks.kind, "meeting"), gte(agentTasks.createdAt, new Date(Date.now() - 86_400_000))));
  if (today >= MEETINGS_PER_DAY) throw new HttpError(429, `Your agent can join ${MEETINGS_PER_DAY} meetings a day. Try again tomorrow.`);
  const [{ n: live }] = await database.select({ n: sql<number>`count(*)::int` }).from(agentTasks).where(and(eq(agentTasks.kind, "meeting"), inArray(agentTasks.status, OPEN)));
  if (live >= MEETINGS_MAX) throw new HttpError(503, "Lexari's meeting seats are all busy right now. Try again in a few minutes.");
  const { userName, agentName } = await names(userId, input.agent);
  const name = meetName(input.mode, agentName, userName);
  const who = userName.split(" ")[0] || "the person I work for";
  const note = `Hi, I'm ${input.mode === "me" ? `${who}'s` : agentName + ","} AI note-taking assistant${input.mode === "me" ? "" : ` for ${who}`}. I'm muted and only taking notes (recording audio for a summary). Ask me to leave anytime.`;
  const id = jobId();
  const cmd = `exec meetbot --url ${shq(input.url)} --name ${shq(name)} --note ${shq(note)} --max ${MEETING_MAX_SECS}`;
  const r = await jobStart(userId, id, cmd);
  if (!r.ok) throw new HttpError(r.error === "busy" ? 409 : 502, r.error === "busy" ? "Your agent's computer is busy with other jobs. Stop one and try again." : "Your agent's computer couldn't start the meeting. Try again.");
  const host = new URL(input.url).hostname.replace(/^www\./, "");
  const [row] = await database.insert(agentTasks).values({
    userId, agent: input.agent, convo: input.convo, kind: "meeting", status: "running", title: `Meeting on ${host}`,
    spec: { url: input.url, platform: input.platform, mode: input.mode, name, messageId: input.messageId || null }, state: { phase: "starting" }, jobId: id,
  }).returning();
  if (input.messageId) await patchMessage(userId, input.convo, input.messageId, { meet: { url: input.url, platform: input.platform, as: input.mode, taskId: row.id } });
  return row;
}

/** A long command on the agent's computer that reports back when it ends. */
export async function startJob(userId: string, input: { agent: string; convo: string; title: string; cmd: string; kind?: "job" | "video" | "deploy"; link?: string }) {
  if (!desktopOn()) throw new HttpError(503, "Your agent's computer isn't available right now.");
  const database = db();
  const [{ n }] = await database.select({ n: sql<number>`count(*)::int` }).from(agentTasks)
    .where(and(eq(agentTasks.userId, userId), inArray(agentTasks.kind, ["job", "video", "deploy"]), gte(agentTasks.createdAt, new Date(Date.now() - 3_600_000))));
  if (n >= JOBS_PER_HOUR) throw new HttpError(429, "That's a lot of background jobs this hour. Give it a bit.");
  const id = jobId();
  // Saved credentials the command names ($CLOUDFLARE_API_TOKEN …) go in as env, never into the command or its log.
  const { env } = await secretEnv(userId, input.agent, input.cmd).catch(() => ({ env: {} as Record<string, string> }));
  const r = await jobStart(userId, id, input.cmd, env);
  if (!r.ok) throw new HttpError(r.error === "busy" ? 409 : 502, r.error === "busy" ? "My computer is already running three jobs. Stop one first." : "My computer couldn't start that job.");
  const [row] = await database.insert(agentTasks).values({
    userId, agent: input.agent, convo: input.convo, kind: input.kind || "job", status: "running", title: input.title.slice(0, 120) || "Background job",
    spec: { cmd: input.cmd.slice(0, 4000), ...(input.link ? { link: input.link } : {}) }, state: { phase: "running" }, jobId: id,
  }).returning();
  return row;
}

/** A recurring instruction ("every morning summarize my email"). */
export async function addSchedule(userId: string, input: { agent: string; convo: string; prompt: string; every: string; tz: string }) {
  const e = parseEvery(input.every);
  if (!e) throw new HttpError(400, "I couldn't tell when to run that. Try 'daily 08:00' or 'weekdays 9am'.");
  const database = db();
  const [{ n }] = await database.select({ n: sql<number>`count(*)::int` }).from(agentTasks).where(and(eq(agentTasks.userId, userId), eq(agentTasks.kind, "schedule"), inArray(agentTasks.status, ["active", "paused"])));
  if (n >= SCHEDULES_MAX) throw new HttpError(409, `You can have ${SCHEDULES_MAX} scheduled tasks. Delete one first.`);
  const tz = okTz(input.tz) ? input.tz : "UTC";
  const [row] = await database.insert(agentTasks).values({
    userId, agent: input.agent, convo: input.convo, kind: "schedule", status: "active", title: input.prompt.replace(/\s+/g, " ").trim().slice(0, 120),
    spec: { prompt: input.prompt.slice(0, 1200), every: everyText(e), tz }, nextRun: new Date(nextRun(e, tz)),
  }).returning();
  return row;
}

export async function listTasks(userId: string, agent?: string) {
  const where = agent ? and(eq(agentTasks.userId, userId), eq(agentTasks.agent, agent)) : eq(agentTasks.userId, userId);
  return db().select().from(agentTasks).where(where).orderBy(desc(agentTasks.createdAt)).limit(40);
}
async function own(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db().select().from(agentTasks).where(and(eq(agentTasks.userId, userId), eq(agentTasks.id, id))).limit(1);
  return row ?? null;
}

/** Stop a running task, pause/resume a schedule, or delete one. */
export async function actOnTask(userId: string, id: string, op: "stop" | "pause" | "resume" | "delete") {
  const row = await own(userId, id);
  if (!row) throw new HttpError(404, "There is no such task.");
  const database = db();
  if (op === "stop") {
    if (!OPEN.includes(row.status as TaskStatus)) return row;
    if (row.jobId) await jobStop(userId, row.jobId, row.kind === "meeting").catch(() => null);
    // a meeting still transcribes what it heard; other jobs end now
    if (row.kind !== "meeting") { const [r] = await database.update(agentTasks).set({ status: "stopped", finishedAt: new Date(), updatedAt: new Date(), state: { ...(row.state as object), phase: "stopped" } }).where(eq(agentTasks.id, id)).returning(); return r; }
    const [r] = await database.update(agentTasks).set({ state: { ...(row.state as object), stopping: true }, updatedAt: new Date() }).where(eq(agentTasks.id, id)).returning();
    return r;
  }
  if (op === "delete") {
    if (OPEN.includes(row.status as TaskStatus) && row.jobId) await jobStop(userId, row.jobId).catch(() => null);
    await database.delete(agentTasks).where(eq(agentTasks.id, id));
    return null;
  }
  if (row.kind !== "schedule") throw new HttpError(400, "Only scheduled tasks can be paused.");
  const e = parseEvery(String((row.spec as { every?: string }).every || ""));
  const tz = String((row.spec as { tz?: string }).tz || "UTC");
  const [r] = await database.update(agentTasks).set(op === "pause" ? { status: "paused", updatedAt: new Date() } : { status: "active", nextRun: e ? new Date(nextRun(e, tz)) : null, updatedAt: new Date() }).where(eq(agentTasks.id, id)).returning();
  return r;
}

/** What the agent knows about its own schedules and running work (added to its prompt). */
export async function tasksContext(userId: string, agent: string) {
  const rows = await db().select().from(agentTasks).where(and(eq(agentTasks.userId, userId), eq(agentTasks.agent, agent), inArray(agentTasks.status, ["running", "waiting", "active", "paused"]))).limit(12);
  if (!rows.length) return "";
  return "Your current tasks:\n" + rows.map((r) => { const v = view(r); return `- ${v.kind}${v.every ? ` (${v.every}${v.status === "paused" ? ", paused" : ""})` : ""}: ${v.title}${v.phase && v.kind !== "schedule" ? ` [${v.phase}]` : ""}`; }).join("\n");
}

// ---------- chat messages ----------
async function chatId(userId: string, convo: string) {
  const database = db();
  let [c] = await database.select({ id: chats.id }).from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, convo))).limit(1);
  if (!c) [c] = await database.insert(chats).values({ userId, kind: convo.startsWith("g-") ? "group" : "dm", slug: convo, title: convo }).onConflictDoNothing().returning({ id: chats.id });
  if (!c) [c] = await database.select({ id: chats.id }).from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, convo))).limit(1);
  return c.id;
}
async function patchMessage(userId: string, convo: string, clientId: string, meta: Record<string, unknown>) {
  const cid = await chatId(userId, convo);
  await db().update(messages).set({ metaJson: sql`coalesce(${messages.metaJson}, '{}'::jsonb) || ${JSON.stringify(meta)}::jsonb` }).where(and(eq(messages.chatId, cid), eq(messages.clientId, clientId)));
}
/** Posts an agent message into a chat (a task result), with a push. Returns it as the app's Msg shape. */
export async function postMessage(userId: string, row: Row, text: string, meta: Record<string, unknown>, clientId: string) {
  const cid = await chatId(userId, row.convo);
  const at = new Date();
  await db().insert(messages).values({ chatId: cid, fromId: row.agent, text, clientId, metaJson: meta, createdAt: at }).onConflictDoNothing();
  await db().update(chats).set({ updatedAt: at }).where(eq(chats.id, cid));
  const { agentName } = await names(userId, row.agent).catch(() => ({ agentName: "Your agent" }));
  await notify(userId, { kind: "reply", title: agentName, body: text.replace(/\s+/g, " ").slice(0, 140), url: `/agents/${encodeURIComponent(row.convo)}`, key: `task:${clientId}` });
  return { id: clientId, from: row.agent, text, at: at.getTime(), ...meta };
}
/** Result messages posted for these tasks (so an open chat picks them up without a reload). */
export async function postedFor(userId: string, rows: Row[]) {
  const ids = rows.filter((r) => r.finishedAt && Date.now() - r.finishedAt.getTime() < 15 * 60_000 || r.lastRun && Date.now() - r.lastRun.getTime() < 15 * 60_000).map((r) => r.id);
  if (!ids.length) return [];
  const list = await db().select({ m: messages, slug: chats.slug }).from(messages).innerJoin(chats, eq(messages.chatId, chats.id))
    .where(and(eq(chats.userId, userId), gte(messages.createdAt, new Date(Date.now() - 15 * 60_000)), inArray(sql<string>`${messages.metaJson}->'task'->>'id'`, ids))).limit(20);
  return list.map(({ m, slug }) => ({ convo: slug, msg: { id: m.clientId || m.id, from: m.fromId, text: m.text, at: m.createdAt.getTime(), ...((m.metaJson as object) || {}) } }));
}

// ---------- the poller ----------
let ticking = false;
export async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const database = db();
    const open = await database.select().from(agentTasks).where(inArray(agentTasks.status, OPEN)).limit(50);
    for (const row of open) await follow(row).catch((e: Error) => console.error(`[tasks] follow ${row.id}: ${e.message}`));
    const due = await database.select().from(agentTasks).where(and(eq(agentTasks.status, "active"), lte(agentTasks.nextRun, new Date()))).limit(10);
    for (const row of due) await runSchedule(row).catch((e: Error) => console.error(`[tasks] schedule ${row.id}: ${e.message}`));
  } finally { ticking = false; }
}

async function follow(row: Row) {
  if (!row.jobId) return;
  const st: JobStatus = await jobStatus(row.userId, row.jobId).catch(() => ({ error: "relay" }));
  if (st.error) return;
  const database = db();
  const js = (st.status || {}) as Record<string, unknown>;
  const state = { ...(row.state as object), ...js, ...(row.kind !== "meeting" ? { phase: st.running ? "running" : "finished" } : {}) };
  const status: TaskStatus = row.kind === "meeting" && js.phase === "waiting" && st.running ? "waiting" : "running";
  if (st.running) {
    if (JSON.stringify(state) !== JSON.stringify(row.state) || status !== row.status) await database.update(agentTasks).set({ state, status, updatedAt: new Date() }).where(eq(agentTasks.id, row.id));
    return;
  }
  // finished (or the computer stopped): claim it once, then post the result
  const [claimed] = await database.update(agentTasks).set({ status: "done", state, finishedAt: new Date(), updatedAt: new Date() }).where(and(eq(agentTasks.id, row.id), inArray(agentTasks.status, OPEN))).returning();
  if (!claimed) return;
  if (row.kind === "meeting") await finishMeeting(claimed, st);
  else await finishJob(claimed, st);
}

const MEET_SUMMARY = [
  "You turn a meeting transcript into notes for the person who sent you. The transcript comes from automatic speech recognition: names and words can be wrong, there are no speaker labels.",
  "Write, in this order and with these exact headings on their own lines:",
  "Summary\n(3 to 6 short sentences)\n\nKey decisions\n- one per line, or 'None recorded'\n\nAction items\n- who: what (by when, if said), or 'None recorded'\n\nOpen questions\n- one per line, or skip this heading if there are none",
  "Plain text, no markdown bold, no preamble, no closing line. Never invent anything that isn't in the transcript.",
].join("\n");

async function finishMeeting(row: Row, st: JobStatus) {
  const s = (st.status || {}) as { phase?: string; reason?: string; seconds?: number; heard?: boolean; dir?: string; joinedAt?: number; lines?: number };
  const ref0 = { task: ref(row) };
  const mins = Math.max(1, Math.round((s.seconds || 0) / 60));
  if (s.phase !== "done") {
    const why = s.reason || (st.gone ? "My computer stopped before the meeting finished." : "I couldn't join the meeting.");
    await db().update(agentTasks).set({ status: s.phase === "failed" && !s.joinedAt ? "failed" : "stopped", result: why }).where(eq(agentTasks.id, row.id));
    await postMessage(row.userId, row, `I couldn't take notes on that meeting. ${why}`, ref0, `task-${row.id}-done`);
    return;
  }
  const tr = await pullDesktop(row.userId, `/home/agent/.lexari/jobs/${row.jobId}/transcript.txt`).catch(() => ({ b64: "" } as { b64?: string }));
  const transcript = Buffer.from(tr.b64 || "", "base64").toString("utf8").trim();
  if (!transcript) {
    const why = s.heard ? "I was in the meeting but couldn't make out any speech." : "I was in the meeting but didn't hear any audio, so there's nothing to summarise.";
    await db().update(agentTasks).set({ result: why }).where(eq(agentTasks.id, row.id));
    await postMessage(row.userId, row, `${why} (${mins} min)`, ref0, `task-${row.id}-done`);
    return;
  }
  let notes = "";
  try {
    notes = await complete([{ role: "system", content: MEET_SUMMARY }, { role: "user", content: `Meeting length: ${mins} min.\nTranscript:\n${transcript.slice(-60_000)}` }], AbortSignal.timeout(150_000));
  } catch (e) { console.error(`[tasks] meeting summary: ${(e as Error).message}`); }
  const ctx = { agent: row.agent, convo: row.convo, messageId: `task-${row.id}-done` };
  let files: FileItem[] = [];
  const name = `meeting-transcript-${new Date((s.joinedAt || Date.now() / 1000) * 1000).toISOString().slice(0, 16).replace(/[:T]/g, "-")}.txt`;
  const path = `${s.dir || "/home/agent/Meetings"}/${name}`;
  await runInDesktop(row.userId, `cp ${shq(`/home/agent/.lexari/jobs/${row.jobId}/transcript.txt`)} ${shq(path)}`).catch(() => null);
  files = (await attachFromComputer(row.userId, ctx, [path]).catch(() => ({ items: [] as FileItem[] }))).items;
  const text = notes ? `Meeting notes (${mins} min)\n\n${notes.replace(/\*\*/g, "")}` : `The meeting is over (${mins} min). I couldn't write the summary right now, but the full transcript is attached.`;
  await db().update(agentTasks).set({ result: notes.split("\n").find((l) => l.trim() && !/^summary$/i.test(l.trim()))?.slice(0, 220) || "Notes ready" }).where(eq(agentTasks.id, row.id));
  await postMessage(row.userId, row, text, { ...ref0, files }, ctx.messageId);
}

async function finishJob(row: Row, st: JobStatus) {
  const ok = st.exit === 0;
  const { scrub } = await secretEnv(row.userId, row.agent, "").catch(() => ({ scrub: (t: string) => t }));
  const log = scrub((st.log || "").slice(-2500));
  const ctx = { agent: row.agent, convo: row.convo, messageId: `task-${row.id}-done` };
  // files the job listed in $LX_JOB_DIR/files (one path per line)
  const listed = await pullDesktop(row.userId, `/home/agent/.lexari/jobs/${row.jobId}/files`).catch(() => ({ b64: "" } as { b64?: string }));
  const paths = Buffer.from(listed.b64 || "", "base64").toString("utf8").split("\n").map((p) => p.trim()).filter((p) => p.startsWith("/home/agent/")).slice(0, 4);
  const got = paths.length ? await attachFromComputer(row.userId, ctx, paths).catch(() => ({ items: [] as FileItem[], notes: [] as string[] })) : { items: [] as FileItem[], notes: [] as string[] };
  const linkFile = await pullDesktop(row.userId, `/home/agent/.lexari/jobs/${row.jobId}/link`).catch(() => ({ b64: "" } as { b64?: string }));
  const link = Buffer.from(linkFile.b64 || "", "base64").toString("utf8").trim().split("\n")[0];
  const goodLink = /^https:\/\/[^\s]+$/.test(link) ? link : "";
  const { agentName } = await names(row.userId, row.agent).catch(() => ({ agentName: "the agent" }));
  let text = "";
  try {
    text = await complete([
      { role: "system", content: `You are ${agentName}, a Lexari agent. A background job you started on your computer just ${st.gone ? "stopped because the computer went to sleep" : ok ? "finished" : `failed (exit ${st.exit})`}. Tell the person the result in 1 to 3 short plain sentences, in first person, using only what the output shows. ${goodLink ? `Include this link exactly: ${goodLink}` : "No links."} No tags, no markdown.` },
      { role: "user", content: `Job: ${row.title}\nOutput (last part):\n${log || "(no output)"}${got.items.length ? `\nFiles attached: ${got.items.map((f) => f.name).join(", ")}` : ""}` },
    ], AbortSignal.timeout(90_000));
  } catch { /* fall back below */ }
  if (!text) text = `${ok ? "Done" : "That job didn't finish"}: ${row.title}.${goodLink ? ` ${goodLink}` : ""}`;
  if (goodLink && !text.includes(goodLink)) text += `\n${goodLink}`;
  await db().update(agentTasks).set({ status: ok ? "done" : st.gone ? "stopped" : "failed", result: text.slice(0, 400), state: { ...(row.state as object), phase: ok ? "done" : "failed", ...(goodLink ? { link: goodLink } : {}) } }).where(eq(agentTasks.id, row.id));
  await postMessage(row.userId, row, text, { task: ref(row), ...(got.items.length ? { files: got.items } : {}) }, ctx.messageId);
}

/** One run of a scheduled task: the agent does the instruction now and posts the answer. */
async function runSchedule(row: Row) {
  const sp = row.spec as { prompt?: string; every?: string; tz?: string };
  const e: Every | null = parseEvery(sp.every || "");
  const tz = sp.tz || "UTC";
  const database = db();
  const [claimed] = await database.update(agentTasks).set({ nextRun: e ? new Date(nextRun(e, tz)) : null, lastRun: new Date(), runs: row.runs + 1, updatedAt: new Date() })
    .where(and(eq(agentTasks.id, row.id), eq(agentTasks.status, "active"), lte(agentTasks.nextRun, new Date()))).returning();
  if (!claimed) return;
  const { agentName, row: a } = await names(row.userId, row.agent);
  const [home] = await database.select().from(agents).where(and(eq(agents.userId, row.userId), eq(agents.slug, "home"))).limit(1);
  const local = new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "full", timeStyle: "short" }).format(new Date());
  const prompt: ChatMessage[] = buildPrompt({
    agentName: home?.name || agentName, role: a?.role || home?.role || "", tone: a?.tone || home?.tone || "short", speaker: agentName,
    about: a?.kind === "custom" ? a.about : "", you: (home?.meta as { you?: string })?.you || "", history: [], recall: [],
    text: `[Scheduled task you agreed to run ${e ? everyLabel(e).toLowerCase() : ""}. It is ${local} for the person.] ${sp.prompt}\n\nDo it now and write the result for the person, short and useful. Don't say this is a scheduled message.`,
  });
  // the agent's own inbox, for tasks like "summarize my email"
  const { emailContext } = await import("../email/mail");
  const mail = await emailContext(row.userId, row.agent, agentName).catch(() => null);
  if (mail) prompt[0] = { ...prompt[0], content: `${prompt[0].content}\n${mail}` };
  let out = "";
  try { for await (const t of streamCompletion(prompt, AbortSignal.timeout(150_000))) out += t; } catch (err) { console.error(`[tasks] schedule turn: ${(err as Error).message}`); }
  out = out.replace(/<[a-z]+\b[^>]*>[\s\S]*?<\/[a-z]+>/gi, "").replace(/\n?REMEMBER:[\s\S]*$/, "").trim();
  if (!out) return;
  await postMessage(row.userId, claimed, out, { task: ref(claimed) }, `task-${row.id}-${claimed.runs}`);
}
