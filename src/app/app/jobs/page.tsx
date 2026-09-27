"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { specialistBySlug, type Job, type JobStatus } from "@/content/appData";
import { agentName, downloadFile, jobNo, progressOf, rerunJob, resolveJob, toast, useApp, useNow, type State } from "@/lib/store";
import Icon from "@/components/app/Icon";
import { WhoFace } from "@/components/app/faces";
import { Empty, PageHead, StatusPill, ago } from "@/components/app/ui";

const FILTERS: { id: "all" | JobStatus; label: string }[] = [{ id: "all", label: "All" }, { id: "running", label: "Working" }, { id: "needs-you", label: "Needs you" }, { id: "done", label: "Done" }];

function Row({ j, s, now, open, toggle }: { j: Job; s: State; now: number; open: boolean; toggle: () => void }) {
  const router = useRouter();
  const body = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const el = body.current; if (!el) return;
    if (first.current) { first.current = false; gsap.set(el, { height: open ? "auto" : 0 }); return; }
    gsap.to(el, { height: open ? "auto" : 0, duration: 0.45, ease: "power3.inOut" });
  }, [open]);
  const sp = j.assignee !== "home" ? specialistBySlug(j.assignee) : undefined;
  const p = progressOf(j, now);
  const at = j.startedAt + (j.status === "running" ? 0 : j.duration);
  return (
    <li id={`job-${j.id}`} className={`overflow-hidden rounded-[24px] bg-card ring-1 transition ${open ? "ring-grape/50 shadow-[0_18px_40px_-24px_var(--glow)]" : "ring-line"}`}>
      <button onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left sm:gap-4 sm:p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tint"><WhoFace who={j.assignee} look={s.agent?.look} size={40} /></span>
        <span className="min-w-0 flex-1">
          <span className="label block text-[9.5px] text-ink/60">{jobNo(j.id)} · {sp ? sp.name : agentName(s)} · {j.status === "running" ? "started " : ""}{ago(at, now)}</span>
          <span className="mt-1 block truncate text-[16px] font-bold text-ink sm:text-[17px]">{j.title}</span>
          {j.status === "running" && <span className="mt-2 block h-1.5 max-w-[320px] overflow-hidden rounded-full bg-tint"><span className="stripes block h-full rounded-full bg-grape transition-[width] duration-300" style={{ width: `${p * 100}%` }} /></span>}
        </span>
        <span className="hidden sm:block"><StatusPill status={j.status} /></span>
        <Icon name="arrow" size={18} className={`shrink-0 text-ink/55 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
      </button>
      <div ref={body} className="overflow-hidden">
        <div className="grid gap-5 border-t border-dashed border-line p-4 sm:grid-cols-[1fr_1fr] sm:p-5">
          <div>
            <span className="sm:hidden"><StatusPill status={j.status} /></span>
            <span className="label mt-3 block text-[9.5px] text-ink/60 sm:mt-0">The ask</span>
            <p className="mt-1.5 text-[15px] leading-snug text-ink">{j.prompt}</p>
            <span className="label mt-4 block text-[9.5px] text-ink/60">Steps</span>
            <ol className="mt-2 grid gap-2">
              {j.steps.map((st, i) => { const done = j.status !== "running" || p * 4 > i + 1; const cur = j.status === "running" && Math.floor(p * 4) === i; return (
                <li key={st} className="flex items-center gap-2.5 text-[14px]"><span className={`grid h-5 w-5 place-items-center rounded-full ${done ? "bg-grape text-white" : cur ? "bg-tint ring-2 ring-grape" : "ring-2 ring-line"}`}>{done && <Icon name="check" size={11} stroke={3.2} />}</span><span className={done || cur ? "text-ink" : "text-ink/55"}>{st}</span></li>
              ); })}
            </ol>
            {j.learned && j.status !== "running" && <p className="mt-4 flex items-center gap-2 rounded-xl bg-tint px-3 py-2 text-[13px] font-semibold text-ink"><Icon name="memory" size={15} className="text-brand-ink" />Remembered: {j.learned}</p>}
          </div>
          <div>
            <span className="label block text-[9.5px] text-ink/60">Outputs</span>
            <ul className="mt-2 grid gap-2">
              {j.files.map((f) => (
                <li key={f.name} className="flex items-center gap-3 rounded-2xl bg-alt p-2.5 ring-1 ring-line">
                  <span className="grid h-9 w-8 place-items-center rounded-md bg-grape text-[9px] font-bold uppercase text-white">{f.name.split(".").pop()}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{f.name}</span>
                  <span className="text-[12px] text-ink/60">{j.status === "running" ? "writing…" : f.size}</span>
                  <button disabled={j.status === "running"} onClick={() => downloadFile(f.name, f.body)} aria-label={`Download ${f.name}`} className="grid h-8 w-8 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-brand-ink disabled:opacity-30"><Icon name="download" size={15} /></button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {j.status === "needs-you" && <button onClick={() => { resolveJob(j.id); toast({ text: `Approved. ${jobNo(j.id)} is done.`, face: "home" }); }} className="btn btn-brand btn-sm"><Icon name="check" size={16} />Looks good, approve</button>}
              {j.status !== "running" && <button onClick={() => { const who = rerunJob(j.id); router.push(`/app/chat/${who}`); }} className="btn btn-ghost btn-sm"><Icon name="flip" size={15} />Run again</button>}
              {j.status === "running" && <Link href={`/app/chat/${j.assignee}`} className="btn btn-ghost btn-sm">Open chat <Icon name="arrow" size={15} /></Link>}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function JobsPage() {
  const s = useApp()!;
  const now = useNow(500);
  const [filter, setFilter] = useState<"all" | JobStatus>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const f = sp.get("filter"); if (f === "needs-you" || f === "running" || f === "done") setFilter(f);
    const o = Number(sp.get("open")); if (o) { setOpen(o); setTimeout(() => document.getElementById(`job-${o}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 400); }
  }, []);
  const counts = { all: s.jobs.length, running: 0, "needs-you": 0, done: 0 } as Record<string, number>;
  s.jobs.forEach((j) => counts[j.status]++);
  const t = q.trim().toLowerCase();
  const list = [...s.jobs].reverse().filter((j) => (filter === "all" || j.status === filter) && (!t || j.prompt.toLowerCase().includes(t)));

  return (
    <>
      <PageHead kicker="Jobs" demo title="Everything it's done." body="Every job your team has worked on, with the steps it took and the files it saved. Open one to download the outputs." right={<Link href="/app/chat/home" data-rise className="btn btn-brand btn-sm"><Icon name="plus" size={16} />New job</Link>} />
      <div data-rise className="mt-7 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="no-bar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {FILTERS.map((f) => <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className="chip shrink-0">{f.label}<span className="tab-num opacity-70">{counts[f.id]}</span></button>)}
        </div>
        <label className="relative md:w-[300px]"><Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/55" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs" aria-label="Search jobs" className="field !h-11 !rounded-full !pl-11 !text-[15px]" /></label>
      </div>
      <div data-rise className="mt-5">
        {list.length ? (
          <ul className="grid gap-3">{list.map((j) => <Row key={j.id} j={j} s={s} now={now} open={open === j.id} toggle={() => setOpen(open === j.id ? null : j.id)} />)}</ul>
        ) : s.jobs.length ? (
          <Empty icon="jobs" title="Nothing here." body={filter === "needs-you" ? "Nothing is waiting on you. Nice." : "No jobs match that search."} cta={{ label: "Show all jobs", onClick: () => { setFilter("all"); setQ(""); } }} />
        ) : (
          <Empty icon="jobs" title="No jobs yet." body={`Ask ${agentName(s)} for something in chat and it will show up here.`} cta={{ href: "/app/chat/home", label: "Open chat" }} />
        )}
      </div>
    </>
  );
}
