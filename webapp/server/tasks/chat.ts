/**
 * Task tags in an agent's reply (see app/api/chat):
 *   <meet>link</meet> or <meet as="me|agent">link</meet>  → a Join card (you pick as me / as my agent, then Join)
 *   <task title="…">bash command</task>                   → a long job on its computer that reports back when done
 *   <schedule every="daily 08:00">instruction</schedule>   → a recurring task, posted in this chat at each run
 */
import { HttpError } from "../http";
import { meetingLink } from "./meet";
import { addSchedule, names, ref, startJob } from "./tasks";
import { everyLabel, parseEvery } from "./schedule";
import type { MeetAsk, TaskRef } from "@/content/tasks";

export const TASKS_HINT = [
  "MEETINGS: you can join Zoom, Google Meet, Microsoft Teams and Jitsi calls from your computer's browser as a silent note-taker (muted, camera off), then post a summary, decisions, action items and the full transcript here. When the person shares a meeting link or asks you to join, attend or take notes on a meeting (or a meeting link is in an email they ask about), write <meet>the link</meet> once, with as=\"me\" if they asked you to join as them or under their name, or as=\"agent\" if they asked you to join as yourself. Lexari shows a Join card; they confirm there. Say one short line like \"Here's the join card.\" Never claim you already joined.",
  "BACKGROUND JOBS: for long work on your computer (more than about 15 seconds: big downloads, scraping many pages, builds, renders, long scripts), write <task title=\"short title\">bash command</task> instead of <run>. It keeps running after this reply and you report back in this chat when it ends. To attach files when it finishes, have the command append their full paths to \"$LX_JOB_DIR/files\" (one per line); to share a link, write it to \"$LX_JOB_DIR/link\".",
  "SCHEDULES: when the person asks for something recurring (every morning, each Monday, hourly), write <schedule every=\"daily 08:00\">what to do, as an instruction to yourself</schedule>. every is one of: hourly, daily HH:MM, weekdays HH:MM, weekly mon HH:MM (24-hour, their local time). Confirm in one short line.",
].join("\n");

export const hasTaskTag = (s: string) => /<(meet|task|schedule)\b/i.test(s);
export const stripTaskTags = (s: string) => s.replace(/<(meet|task|schedule)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<(meet|task|schedule)\b[^>]*\/?>/gi, "").replace(/[ \t]+\n/g, "\n").trim();
const attr = (a: string, k: string) => new RegExp(`${k}\\s*=\\s*"([^"]*)"`, "i").exec(a)?.[1] ?? new RegExp(`${k}\\s*=\\s*'([^']*)'`, "i").exec(a)?.[1];

export async function runTaskTags(userId: string, ctx: { agent: string; convo: string; messageId: string; tz: string; userName?: string; agentName?: string; said: string }, text: string) {
  const notes: string[] = [];
  let meet: MeetAsk | undefined;
  let task: TaskRef | undefined;
  const m = /<meet\b([^>]*)>([\s\S]*?)<\/meet>/i.exec(text);
  if (m) {
    const link = meetingLink(m[2]) || meetingLink(ctx.said);
    const as = (attr(m[1], "as") || "").toLowerCase();
    const who = link ? await names(userId, ctx.agent).catch(() => null) : null;
    if (link) meet = { url: link.url, platform: link.platform, ...(as === "me" || as === "agent" ? { as } : {}), agentName: who?.agentName || ctx.agentName, userName: who?.userName || ctx.userName };
    else notes.push("that doesn't look like a Zoom, Google Meet, Teams or Jitsi link");
  }
  const t = /<task\b([^>]*)>([\s\S]*?)<\/task>/i.exec(text);
  if (t && t[2].trim()) {
    try { task = ref(await startJob(userId, { agent: ctx.agent, convo: ctx.convo, title: attr(t[1], "title") || t[2].trim().slice(0, 60), cmd: t[2].trim() })); }
    catch (e) { notes.push(e instanceof HttpError ? e.message.replace(/\.$/, "") : "my computer couldn't start that job"); }
  }
  const s = /<schedule\b([^>]*)>([\s\S]*?)<\/schedule>/i.exec(text);
  if (s && s[2].trim() && !task) {
    const every = attr(s[1], "every") || "";
    try { const row = await addSchedule(userId, { agent: ctx.agent, convo: ctx.convo, prompt: s[2].trim(), every, tz: ctx.tz }); task = ref(row); const e = parseEvery(every); if (e) task.title = `${everyLabel(e)}: ${task.title}`; }
    catch (e) { notes.push(e instanceof HttpError ? e.message.replace(/\.$/, "") : "I couldn't save that schedule"); }
  }
  return { meet, task, notes };
}
