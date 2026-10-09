/**
 * Task tags in an agent's reply (see app/api/chat):
 *   <meet>link</meet> or <meet as="me|agent">link</meet>  → a Join card (you pick as me / as my agent, then Join)
 *   <task title="…">bash command</task>                   → a long job on its computer that reports back when done
 *   <schedule every="daily 08:00">instruction</schedule>   → a recurring task, posted in this chat at each run
 *   <publish dir="/home/agent/sites/x" title="…"/>          → publishes a site folder as a preview link (server/tasks/sites.ts)
 */
import { HttpError } from "../http";
import { meetingLink } from "./meet";
import { addSchedule, names, ref, startJob } from "./tasks";
import { everyLabel, parseEvery } from "./schedule";
import { publishSite } from "./sites";
import type { MeetAsk, TaskRef } from "@/content/tasks";

export const TASKS_HINT = [
  "MEETINGS: you can join Zoom, Google Meet, Microsoft Teams and Jitsi calls from your computer's browser as a silent note-taker (muted, camera off), then post a summary, decisions, action items and the full transcript here. When the person shares a meeting link or asks you to join, attend or take notes on a meeting (or a meeting link is in an email they ask about), write <meet>the link</meet> once, with as=\"me\" if they asked you to join as them or under their name, or as=\"agent\" if they asked you to join as yourself. Lexari shows a Join card; they confirm there. Say one short line like \"Here's the join card.\" Never claim you already joined.",
  "BACKGROUND JOBS: for long work on your computer (more than about 15 seconds: big downloads, scraping many pages, builds, renders, long scripts), write <task title=\"short title\">bash command</task> instead of <run>. It keeps running after this reply and you report back in this chat when it ends. To attach files when it finishes, have the command append their full paths to \"$LX_JOB_DIR/files\" (one per line); to share a link, write it to \"$LX_JOB_DIR/link\".",
  "SCHEDULES: when the person asks for something recurring (every morning, each Monday, hourly), write <schedule every=\"daily 08:00\">what to do, as an instruction to yourself</schedule>. every is one of: hourly, daily HH:MM, weekdays HH:MM, weekly mon HH:MM (24-hour, their local time). Confirm in one short line.",
  "BUILD & DEPLOY: you can build websites and web apps on your computer (HTML/CSS/JS, or Node 22 with npm, e.g. Vite: build with relative paths, npx vite build --base=./; write big files in parts with cat >> if one command would pass 60 KB). To give the person a free preview link, put the finished static site (with index.html) in a folder like /home/agent/sites/<name> and write <publish dir=\"/home/agent/sites/<name>\" title=\"Name\"/>; Lexari publishes it and adds the link to your reply (re-publishing the same name keeps the link). Previews are static only (no server code) and run sandboxed. To deploy to the person's own Cloudflare account, you need saved credentials CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (ask with a <secret> card if missing), then run it as a background job: <task title=\"Deploy to Cloudflare\">cd DIR && CLOUDFLARE_API_TOKEN=\"$CLOUDFLARE_API_TOKEN\" CLOUDFLARE_ACCOUNT_ID=\"$CLOUDFLARE_ACCOUNT_ID\" npx -y wrangler@4 pages deploy . --project-name NAME --branch main --commit-dirty=true 2>&1 | tee out.txt; grep -o 'https://[a-z0-9.-]*pages.dev' out.txt | tail -1 > \"$LX_JOB_DIR/link\"</task> (create the project first if needed with npx -y wrangler@4 pages project create NAME --production-branch main). Only deploy when they ask.",
  "VIDEOS: you can make narrated videos on your computer with mkvideo (offline voice, captions burned in, plus an .srt). Write a story file, then run it as a background job: <task title=\"Make the video\">mkdir -p ~/Videos && cat > ~/Videos/story.json <<'J'\n{\"size\":\"1080x1920\",\"scenes\":[{\"title\":\"Big title\",\"color\":\"#1d1630\",\"say\":\"What the voice says\"},{\"image\":\"/home/agent/Uploads/photo.jpg\",\"say\":\"…\"}]}\nJ\nmkvideo ~/Videos/story.json ~/Videos/name.mp4 && echo ~/Videos/name.mp4 >> \"$LX_JOB_DIR/files\"</task>. size is 1080x1920 (vertical), 1920x1080 or 1080x1080; scenes take image (a picture on your computer: an upload, a picture you made, or one you drew with Python Pillow), color, title, say, text and secs; \"music\": a path mixes a track quietly under the voice. Keep videos under about 2 minutes (the chat takes files up to 10 MB). For anything mkvideo can't do, use ffmpeg directly. The finished mp4 plays in the chat.",
].join("\n");

export const hasTaskTag = (s: string) => /<(meet|task|schedule|publish)\b/i.test(s);
export const stripTaskTags = (s: string) => s.replace(/<(meet|task|schedule|publish)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<\/?(meet|task|schedule|publish)\b[^>]*\/?>/gi, "").replace(/[ \t]+\n/g, "\n").trim();
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
  let site: { url: string; title: string } | undefined;
  const pb = /<publish\b([^>]*)\/?>/i.exec(text);
  if (pb) {
    const dir = attr(pb[1], "dir") || "";
    const title = (attr(pb[1], "title") || "").slice(0, 80);
    try { const r = await publishSite(userId, ctx.agent, dir, title || undefined); site = { url: r.url, title: title || dir.split("/").filter(Boolean).pop() || "site" }; }
    catch (e) { notes.push(e instanceof HttpError ? e.message.replace(/\.$/, "") : "I couldn't publish the site"); }
  }
  return { meet, task, notes, site };
}
