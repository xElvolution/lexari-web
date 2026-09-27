"use client";

import Link from "next/link";
import { specialistBySlug } from "@/content/appData";
import { agentName, jobNo, progressOf, useApp, useNow } from "@/lib/store";
import Computer from "@/components/app/desk/Computer";
import Chat from "@/components/app/desk/Chat";
import TeamStrip from "@/components/app/desk/TeamStrip";
import Icon from "@/components/app/Icon";
import { WhoFace } from "@/components/app/faces";
import { StatusPill } from "@/components/app/ui";

function greeting(now: number) { const h = new Date(now || Date.now()).getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }

export default function DeskPage() {
  const s = useApp()!;
  const now = useNow(250);
  const running = s.jobs.filter((j) => j.status === "running");
  const job = running[running.length - 1] ?? [...s.jobs].reverse().find((j) => j.status !== "running");
  const live = job?.status === "running";
  const p = job && now ? progressOf(job, now) : 0;
  const step = live ? Math.min(3, Math.floor(p * 4)) : 4;
  const sp = job && job.assignee !== "home" ? specialistBySlug(job.assignee) : undefined;
  const needs = s.jobs.filter((j) => j.status === "needs-you").length;
  const host = (s.agent?.name || "agent").toLowerCase().replace(/[^a-z0-9]/g, "") || "agent";

  return (
    <>
      <div data-rise className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="label text-brand-ink">Desk 01 · {greeting(now)}{s.agent?.you ? `, ${s.agent.you}` : ""}</span>
          <h1 className="display mt-3 text-[44px] text-ink sm:text-[64px]">{agentName(s)}&apos;s desk</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="label flex items-center gap-1.5 rounded-full bg-tint px-3 py-2 text-[10px] text-ink"><i className={`h-2 w-2 rounded-full bg-grape ${running.length ? "live-dot" : ""}`} />{running.length ? `${running.length} running` : "idle"}</span>
          {needs > 0 && <Link href="/app/jobs?filter=needs-you" className="label flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-[10px] text-[var(--bg)] transition hover:-translate-y-0.5">{needs} needs you <Icon name="arrow" size={12} /></Link>}
          <Link href="/app/memory" className="label flex items-center gap-1.5 rounded-full bg-tint px-3 py-2 text-[10px] text-ink transition hover:-translate-y-0.5">{s.memory.length} memories</Link>
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div data-rise className="min-w-0">
          <Computer job={job} now={now} look={s.agent?.look ?? null} host={host} />
          {/* current job */}
          <div className="panel mt-5 p-5">
            {job ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tint"><WhoFace who={job.assignee} look={s.agent?.look} size={40} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="label text-[9.5px] text-ink/60">{live ? "Current job" : "Last job"} {jobNo(job.id)} · {sp ? sp.name : agentName(s)}</span><StatusPill status={job.status} /></div>
                    <p className="mt-1.5 text-[17px] font-bold leading-snug text-ink">{job.title}</p>
                  </div>
                  {live && <span className="display tab-num text-[34px] leading-none text-brand-ink">{Math.round(p * 100)}%</span>}
                </div>
                <ol className="mt-4 grid grid-cols-4 gap-1.5">
                  {job.steps.map((st, i) => (
                    <li key={st}>
                      <div className="h-2 overflow-hidden rounded-full bg-tint">
                        <div className={`h-full rounded-full bg-grape transition-[width] duration-300 ${i === step && live ? "stripes" : ""}`} style={{ width: `${i < step ? 100 : i === step && live ? Math.max(4, (p * 4 - i) * 100) : 0}%` }} />
                      </div>
                      <span className={`mt-2 block text-[11.5px] font-semibold leading-tight sm:text-[12.5px] ${i === step && live ? "text-ink" : i < step ? "text-ink/75" : "text-ink/50"}`}>{st}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-[15px] text-ink/70">No jobs yet. Give {agentName(s)} its first one in the chat.</p>
            )}
          </div>
        </div>
        <div data-rise className="min-w-0"><Chat s={s} /></div>
      </div>
      <TeamStrip s={s} />
    </>
  );
}
