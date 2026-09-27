"use client";

import Link from "next/link";
import { specialistBySlug } from "@/content/appData";
import { agentName, planOf, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentFace, SpecFace } from "../faces";

export default function TeamStrip({ s }: { s: State }) {
  const p = planOf(s);
  const open = Math.max(0, p.seats - 1 - s.hired.length);
  const busy = new Set(s.jobs.filter((j) => j.status === "running").map((j) => j.assignee));
  return (
    <section data-rise className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div><span className="label text-brand-ink">Your team · {p.name}</span><h2 className="display mt-2 text-[34px] text-ink sm:text-[42px]">{1 + s.hired.length} of {p.seats} seats filled</h2></div>
        <Link href="/app/team" className="btn btn-ghost btn-sm shrink-0">Floor plan <Icon name="arrow" size={16} /></Link>
      </div>
      <div className="no-bar -mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        <div className="grain carpet-w relative w-[180px] shrink-0 snap-start overflow-hidden rounded-[24px] bg-grape p-4 text-white shadow-[0_6px_0_#3514b0]">
          <span className="label text-[9px] text-white/80">Seat 01 · yours</span>
          <div className="mt-2 grid h-20 place-items-center"><AgentFace look={s.agent?.look} size={72} /></div>
          <div className="display text-[26px] leading-none">{agentName(s)}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-white/85"><i className={`h-1.5 w-1.5 rounded-full bg-white ${busy.has("home") ? "live-dot" : ""}`} />{busy.has("home") ? "Working" : "Home agent"}</div>
        </div>
        {s.hired.map((h, i) => { const sp = specialistBySlug(h)!; return (
          <Link key={h} href={`/app/marketplace/${h}`} className="group relative w-[180px] shrink-0 snap-start rounded-[24px] bg-card p-4 ring-1 ring-line transition hover:-translate-y-1 hover:ring-grape/50">
            <span className="label text-[9px] text-ink/60">Seat {String(i + 2).padStart(2, "0")}</span>
            <div className="mt-2 grid h-20 place-items-center rounded-2xl bg-tint transition group-hover:scale-[1.03]"><SpecFace slug={h} size={66} /></div>
            <div className="display mt-2 text-[26px] leading-none text-ink">{sp.name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-ink/70"><i className={`h-1.5 w-1.5 rounded-full ${busy.has(h) ? "bg-grape live-dot" : "bg-ink/30"}`} />{busy.has(h) ? "Working" : sp.job}</div>
          </Link>
        ); })}
        {Array.from({ length: Math.min(open, 3) }).map((_, i) => (
          <Link key={i} href="/app/marketplace" className="group grid w-[180px] shrink-0 snap-start place-items-center rounded-[24px] border-2 border-dashed border-ink/25 p-4 text-center transition hover:border-grape hover:bg-tint">
            <span><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-tint text-brand-ink transition group-hover:rotate-90 group-hover:bg-grape group-hover:text-white"><Icon name="plus" size={24} /></span><span className="mt-3 block font-bold text-ink">Open seat</span><span className="text-[13px] text-ink/65">Hire a specialist</span></span>
          </Link>
        ))}
        {open === 0 && (
          <Link href="/app/team" className="grid w-[200px] shrink-0 snap-start place-items-center rounded-[24px] bg-ink p-4 text-center text-[var(--bg)] transition hover:-translate-y-1">
            <span><span className="display block text-[24px]">Floor is full</span><span className="mt-1 block text-[13px] opacity-75">Move up a plan for more seats</span></span>
          </Link>
        )}
      </div>
    </section>
  );
}
