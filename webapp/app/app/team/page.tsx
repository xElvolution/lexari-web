"use client";

import Link from "next/link";
import { useState } from "react";
import { specialistBySlug } from "@/content/appData";
import { hirePriceLabel } from "@/lib/prices";
import { agentName, release, toast, useApp } from "@/lib/store";
import Icon from "@/components/Icon";
import { AgentFace, SpecFace } from "@/components/faces";
import { PageHead } from "@/components/ui";
import { AgentTile } from "@/components/faces";
import { openAdd, openAgent } from "@/components/overlays";

export default function TeamPage() {
  const s = useApp()!;
  const [pick, setPick] = useState<string | null>(null);
  const taken = 1 + s.hired.length;
  // the floor always shows a few open desks, in rows of five
  const seats = Math.max(5, Math.ceil((taken + 1) / 5) * 5);
  const big = seats <= 5;
  const cols = seats <= 20 ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-10";
  const free = s.paid.filter((x) => !s.hired.includes(x));

  return (
    <>
      <PageHead kicker="Team" title="Your team floor." body={`${agentName(s)} is always first. Specialists you hire from the marketplace join here.`} />

      <div data-rise className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_.5fr]">
        <div className="relative overflow-hidden rounded-[30px] bg-card p-4 ring-2 ring-tint sm:p-7">
          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative flex items-center justify-between">
            <span className="label text-ink/65">floor plan</span>
            <span className="label tab-num text-brand-ink">{taken} on the team</span>
          </div>
          <div className={`relative mt-5 grid gap-1.5 sm:gap-2.5 ${cols}`}>
            {Array.from({ length: seats }).map((_, i) => {
              const slug = i > 0 ? s.hired[i - 1] : undefined;
              const state = i === 0 ? "home" : slug ? "hired" : "open";
              const sp = slug ? specialistBySlug(slug) : undefined;
              const cls = `pop relative grid aspect-square place-items-center rounded-[22%] transition ${state === "home" ? "bg-grape shadow-[0_4px_0_#3514b0]" : state === "hired" ? `bg-tint ring-2 ${pick === slug ? "ring-grape" : "ring-grape/40"} hover:-translate-y-1` : "border-2 border-dashed border-ink/25 bg-base/60 hover:border-grape hover:bg-tint"}`;
              const style = { animationDelay: `${Math.min(i, 40) * 14}ms` };
              const num = big && <span className={`label absolute bottom-[8%] right-[10%] text-[9px] ${state === "home" ? "text-white/85 max-[430px]:hidden" : "text-ink/55"}`}>{String(i + 1).padStart(2, "0")}</span>;
              if (state === "home") return <Link key={i} href="/app?c=home" className={cls} style={style} title={`${agentName(s)} · seat 01`}><AgentFace look={s.agent?.look} size={120} track={big} className="!h-[72%] !w-[72%]" />{num}</Link>;
              if (state === "hired") return <button key={i} onClick={() => setPick(pick === slug ? null : slug!)} className={cls} style={style} title={`${sp?.name} · seat ${i + 1}`} aria-label={`${sp?.name}, seat ${i + 1}`}><SpecFace slug={slug!} size={90} className="!h-[72%] !w-[72%]" />{num}</button>;
              return <button key={i} onClick={() => openAdd()} className={cls} style={style} aria-label={`Open seat ${i + 1}. Add an agent.`}>{big && <Icon name="plus" size={18} className="text-ink/40" />}{num}</button>;
            })}
          </div>
          {pick && (() => { const sp = specialistBySlug(pick)!; return (
            <div className="pop relative mt-5 flex flex-wrap items-center gap-3 rounded-[22px] bg-ink p-3 text-[var(--bg)]">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--bg)]/10"><SpecFace slug={pick} size={40} /></span>
              <span className="min-w-0 flex-1 max-sm:basis-[calc(100%-3.75rem)]"><b className="display block text-[24px] leading-none">{sp.name}</b><span className="text-[13px] opacity-75">{sp.job} · seat {String(s.hired.indexOf(pick) + 2).padStart(2, "0")}</span></span>
              <Link href={`/app?c=${pick}`} className="rounded-full bg-grape px-4 py-2 text-[14px] font-bold text-white">Chat</Link>
              <button onClick={() => openAgent(pick)} className="rounded-full px-4 py-2 text-[14px] font-bold ring-1 ring-current/30 hover:bg-[var(--bg)]/10">ID card</button>
              <button onClick={() => { release(pick); setPick(null); toast({ text: `${sp.name} left the seat`, face: sp.seed, color: sp.color }); }} className="rounded-full px-4 py-2 text-[14px] font-bold ring-1 ring-current/30 hover:bg-[var(--bg)]/10">Release</button>
            </div>
          ); })()}
          <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink/75">
            <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded bg-grape" />{agentName(s)}</span>
            <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded bg-tint ring-2 ring-grape/45" />Hired specialist</span>
            <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded border-2 border-dashed border-ink/30" />Open seat</span>
            <button onClick={() => openAdd()} className="btn btn-brand btn-sm ml-auto"><Icon name="plus" size={16} />Add an agent</button>
          </div>
          <div className="relative mt-6 rounded-[22px] bg-tint p-4">
            <div className="flex items-center justify-between gap-3"><h3 className="text-[15px] font-bold text-ink">Made by you</h3><button onClick={() => openAdd("create")} className="flex items-center gap-1.5 text-[13.5px] font-bold text-brand-ink hover:underline"><Icon name="plus" size={14} />Create an agent</button></div>
            {s.custom.length ? (
              <div className="mt-3 flex flex-wrap gap-2">{s.custom.map((c) => <button key={c.id} onClick={() => openAgent(c.id)} className="flex items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3.5 text-[14px] font-bold text-ink ring-1 ring-line transition hover:ring-grape"><AgentTile id={c.id} look={null} size={30} radius={15} />{c.name}</button>)}</div>
            ) : <p className="mt-1 text-[13.5px] text-ink/60">Agents you create sit here. They don&apos;t take a desk.</p>}
          </div>
        </div>

        <div className="grain relative flex flex-col overflow-hidden rounded-[30px] bg-grape p-6 text-white sm:p-7">
          <span className="label text-white/80">Free plan</span>
          <div className="mt-3 flex items-baseline gap-2"><span className="display text-[88px] leading-[0.8]">{taken}</span><span className="text-white/80">{taken === 1 ? "agent" : "agents"}</span></div>
          <p className="mt-5 text-[16px] leading-relaxed text-white/90">Your own agent is free. Each specialist is a one-time {hirePriceLabel()} payment, and seats never run out.</p>
          <ul className="mt-5 grid gap-2.5 text-[15px]">{["Your named agent with its memory", "Hire from the marketplace", "Release and rehire for free"].map((pt) => <li key={pt} className="flex gap-2.5"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-white" />{pt}</li>)}</ul>
          {free.length > 0 && <p className="relative z-10 mt-5 text-[13.5px] text-white/85">{free.length} paid specialist{free.length === 1 ? " is" : "s are"} off the floor. Add them back from the marketplace for free.</p>}
          <Link href="/app/marketplace" className="btn btn-white relative z-10 mt-8 lg:mt-auto">Open the marketplace</Link>
        </div>
      </div>
    </>
  );
}
