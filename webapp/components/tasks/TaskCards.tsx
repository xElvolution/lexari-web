"use client";

import { useState } from "react";
import type { MeetAsk, TaskRef, TaskView } from "@/content/tasks";
import { PLATFORM_LABEL } from "@/content/tasks";
import { actTask, joinMeeting, openTasks, useTask } from "@/lib/tasks";
import { patchMsg, toast, useNow, type Msg } from "@/lib/store";
import { friendly } from "@/lib/api";
import Icon from "../Icon";
import { Spinner } from "../billing/parts";

const clock = (secs: number) => { const s = Math.max(0, Math.floor(secs)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`; };
const shortUrl = (u: string) => u.replace(/^https:\/\/(www\.)?/, "").replace(/\?.*$/, "").slice(0, 48);
const pill = "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tint text-ink transition hover:bg-grape hover:text-white disabled:opacity-45";
const box = "mt-1.5 w-[min(100%,360px)] max-w-full rounded-[18px] bg-card p-3 ring-1 ring-line";

/** What a meeting is doing, in a few words. */
function meetLine(t: TaskView, now: number) {
  if (t.status === "waiting" || t.phase === "waiting") return "Waiting to be let in";
  if (t.phase === "in_meeting" && t.joinedAt) return `In the meeting · ${clock((now - t.joinedAt) / 1000)}`;
  if (t.phase === "transcribing") return "Writing the notes…";
  if (t.status === "running") return "Joining…";
  if (t.status === "done") return `Notes ready${t.secs ? ` · ${Math.max(1, Math.round(t.secs / 60))} min` : ""}`;
  return t.detail || "Didn't get in";
}

/** The Join card for a meeting link: as my agent / as me, then Join. Turns into the live meeting row. */
export function MeetCard({ m, convo, onDesktop }: { m: Msg & { meet: MeetAsk }; convo: string; onDesktop: () => void }) {
  const mt = m.meet;
  const [as, setAs] = useState<"me" | "agent">(mt.as || "agent");
  const [busy, setBusy] = useState(false);
  const t = useTask(mt.taskId);
  const now = useNow(1000);
  const agentName = mt.agentName || "Your agent";
  const first = (mt.userName || "you").split(" ")[0];
  const shown = as === "me" ? (mt.userName || "Your name") : `${agentName} (for ${first})`;
  const join = async () => {
    setBusy(true);
    try {
      const task = await joinMeeting({ agent: m.from, convo, url: mt.url, as, messageId: m.id });
      patchMsg(convo, m.id, { meet: { ...mt, as, taskId: task.id } });
    } catch (e) { toast({ text: friendly(e, "Couldn't join the meeting.") }); }
    finally { setBusy(false); }
  };
  const live = !!mt.taskId;
  const active = t && (t.status === "running" || t.status === "waiting");
  return (
    <div data-meet-card className={box}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${live && active ? "bg-grape text-white" : "bg-tint text-brand-ink"}`}><Icon name="users" size={17} /></span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[14px] leading-tight text-ink">{PLATFORM_LABEL[mt.platform]}</b>
          <span className="block truncate font-mono text-[11px] text-ink/55">{shortUrl(mt.url)}</span>
        </span>
        {live && active && <button onClick={onDesktop} aria-label="Watch on the agent's computer" title="Watch" className={pill}><Icon name="desk" size={15} /></button>}
        {live && active && <button data-meet-stop onClick={() => void actTask(mt.taskId!, "stop").then(() => toast({ text: "Leaving the meeting. The notes come next." }), (e) => toast({ text: friendly(e, "Couldn't stop.") }))} aria-label="Leave the meeting" title="Leave" className={pill}><Icon name="hangup" size={15} /></button>}
      </div>
      {live ? (
        <p data-meet-status className="mt-2 flex items-center gap-2 rounded-xl bg-tint px-2.5 py-1.5 text-[12.5px] font-semibold text-ink/80">
          {active ? <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-grape opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-grape" /></span> : <Icon name={t?.status === "done" ? "check" : "info"} size={13} className={t?.status === "done" ? "text-brand-ink" : "text-ink/50"} />}
          <span className="min-w-0 flex-1 truncate" aria-live="polite">{t ? meetLine(t, now) : "Joining…"}</span>
          <span className="shrink-0 text-[11px] font-medium text-ink/50">{mt.as === "me" ? "as you" : "as agent"}</span>
        </p>
      ) : (
        <>
          <div role="radiogroup" aria-label="Join as" className="mt-2.5 inline-flex w-full rounded-full bg-tint p-1">
            {([["agent", "As my agent"], ["me", "As me"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={as === k} data-meet-as={k} onClick={() => setAs(k)} className={`h-8 flex-1 rounded-full text-[12.5px] font-bold transition ${as === k ? "bg-grape text-white shadow-sm" : "text-ink/65"}`}>{l}</button>)}
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-ink/60">Joins as <b className="text-ink/80">{shown}</b>, muted with camera off, and says it&apos;s taking notes.{as === "me" ? " Uses your account if you're signed in on its browser." : ""}</p>
          <button data-meet-join disabled={busy} onClick={() => void join()} className="btn btn-brand btn-sm mt-2.5 !h-9 w-full">{busy ? <Spinner /> : "Join"}</button>
        </>
      )}
    </div>
  );
}

const KIND_ICON: Record<string, string> = { job: "terminal", schedule: "clock", video: "play", deploy: "globe", meeting: "users" };

/** A background job, video, deploy or schedule under the reply that started it. */
export function TaskCard({ r, onDesktop }: { r: TaskRef; onDesktop: () => void }) {
  const t = useTask(r.id);
  const now = useNow(1000);
  if (r.kind === "meeting") return null; // shown by MeetCard
  return (
    <div data-task-card={r.kind} className={`${box} flex items-center gap-2.5 !py-2.5`}>
      <TaskRow t={t} r={r} now={now} onDesktop={onDesktop} />
    </div>
  );
}

export function taskLine(t: TaskView | undefined, now: number) {
  if (!t) return "";
  if (t.kind === "meeting") return meetLine(t, now);
  if (t.kind === "schedule") return t.status === "paused" ? `${t.every} · paused` : `${t.every}${t.nextRun ? ` · next ${new Date(t.nextRun).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}`;
  if (t.status === "running") return `${t.kind === "video" ? "Rendering" : t.kind === "deploy" ? "Deploying" : "Running"} · ${clock((now - t.createdAt) / 1000)}`;
  if (t.status === "done") return "Done";
  if (t.status === "stopped") return "Stopped";
  return "Didn't finish";
}

export function TaskRow({ t, r, now, onDesktop }: { t?: TaskView; r: TaskRef | TaskView; now: number; onDesktop?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (op: "stop" | "pause" | "resume" | "delete") => {
    setBusy(op);
    try { await actTask(r.id, op); } catch (e) { toast({ text: friendly(e, "Couldn't do that.") }); } finally { setBusy(null); }
  };
  const running = t?.status === "running" || t?.status === "waiting";
  return (
    <>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${running || t?.status === "active" ? "bg-grape text-white" : "bg-tint text-brand-ink"}`}>{running && r.kind !== "schedule" ? <Spinner /> : <Icon name={KIND_ICON[r.kind] || "jobs"} size={16} />}</span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[13.5px] leading-tight text-ink">{t?.title || r.title}</b>
        <span className="block truncate text-[11.5px] text-ink/60" aria-live="polite">{t ? taskLine(t, now) : "…"}</span>
      </span>
      {t?.link && <a href={t.link} target="_blank" rel="noreferrer" aria-label="Open the link" title="Open" className={pill}><Icon name="link" size={15} /></a>}
      {running && onDesktop && r.kind !== "schedule" && <button onClick={onDesktop} aria-label="Watch on the agent's computer" title="Watch" className={pill}><Icon name="desk" size={15} /></button>}
      {running && <button data-task-stop onClick={() => void act("stop")} disabled={!!busy} aria-label="Stop" title="Stop" className={pill}>{busy === "stop" ? <Spinner /> : <Icon name="stop" size={14} />}</button>}
      {t?.kind === "schedule" && <button data-task-pause onClick={() => void act(t.status === "paused" ? "resume" : "pause")} disabled={!!busy} aria-label={t.status === "paused" ? "Resume" : "Pause"} title={t.status === "paused" ? "Resume" : "Pause"} className={pill}>{busy === "pause" || busy === "resume" ? <Spinner /> : <Icon name={t.status === "paused" ? "play" : "pause"} size={14} />}</button>}
      {t && !running && (t.kind === "schedule" || !onDesktop) && <button data-task-delete onClick={() => void act("delete")} disabled={!!busy} aria-label="Delete" title="Delete" className={pill}>{busy === "delete" ? <Spinner /> : <Icon name="trash" size={14} />}</button>}
    </>
  );
}

/** Chat header: the agent's tasks (only once it has some), with a dot while one is running. */
export function TasksButton({ agent, name, list }: { agent: string; name: string; list: TaskView[] }) {
  if (!list.length) return null;
  const live = list.some((t) => t.status === "running" || t.status === "waiting");
  return (
    <button data-tasks-btn={agent} onClick={() => openTasks(agent)} aria-label={`${name}'s tasks${live ? ", one running" : ""}`} title={`${name}'s tasks`} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-brand-ink max-[430px]:h-9 max-[430px]:w-9">
      <Icon name="jobs" size={19} />
      {live && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-grape ring-2 ring-[var(--bg)]" />}
    </button>
  );
}
