"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANS, specialistBySlug, type PlanId } from "@/content/appData";
import { agentName, planOf, release, setPlan, toast, useApp } from "@/lib/store";
import Icon from "@/components/Icon";
import { AgentFace, SpecFace } from "@/components/faces";
import { PageHead } from "@/components/ui";
import { AgentTile } from "@/components/faces";
import { openAdd, openAgent } from "@/components/overlays";

const COLS: Record<PlanId, string> = { free: "grid-cols-1 max-w-[240px] mx-auto", pro: "grid-cols-3 sm:grid-cols-5", plus: "grid-cols-5 sm:grid-cols-10", max: "grid-cols-10 sm:grid-cols-20" };

export default function TeamPage() {
  const s = useApp()!;
  const p = planOf(s);
  const [view, setView] = useState<PlanId>(s.plan);
  const [pick, setPick] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PlanId | null>(null);
  const V = PLANS.find((x) => x.id === view)!;
  const big = V.seats <= 5;
  const current = view === s.plan;
  const taken = 1 + s.hired.length;

  const choose = (id: PlanId) => {
    const seats = PLANS.find((x) => x.id === id)!.seats;
    if (s.hired.length > seats - 1) { setConfirm(id); return; }
    apply(id);
  };
  const apply = (id: PlanId) => { setPlan(id); setView(id); setConfirm(null); toast({ text: `You're on ${PLANS.find((x) => x.id === id)!.name} now`, face: "home" }); };
  const leaving = confirm ? s.hired.slice(PLANS.find((x) => x.id === confirm)!.seats - 1) : [];

  return (
    <>
      <PageHead kicker="Team" title="Your team floor." body={`Seat 01 is ${agentName(s)}, always. Every other seat is a desk for a specialist you hire. Plans only change how many seats you get.`}
        right={<span data-rise className="label flex items-center gap-2 rounded-full bg-grape px-3.5 py-2.5 text-[10px] text-white"><Icon name="team" size={14} />{taken} / {p.seats} on {p.name}</span>} />

      <div data-rise className="mt-7 flex flex-wrap gap-2" role="tablist" aria-label="Preview a plan">
        {PLANS.map((x) => (
          <button key={x.id} role="tab" aria-selected={view === x.id} onClick={() => { setView(x.id); setPick(null); }} className={`rounded-full px-5 py-3 text-[15px] font-bold transition-all ${view === x.id ? "bg-grape text-white shadow-[0_5px_0_#3514b0]" : "bg-tint text-ink hover:bg-grape/20"}`}>
            {x.name} <span className="ml-1 opacity-70">{x.seats}</span>{x.id === s.plan && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-current align-middle" aria-label="current" />}
          </button>
        ))}
      </div>

      <div data-rise className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_.5fr]">
        <div className="relative overflow-hidden rounded-[30px] bg-card p-4 ring-2 ring-tint sm:p-7">
          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative flex items-center justify-between">
            <span className="label text-ink/65">floor plan · {V.name}{current ? " · your plan" : " · preview"}</span>
            <span className="label tab-num text-brand-ink">{Math.min(taken, V.seats)} / {V.seats} seats</span>
          </div>
          <div key={view} className={`relative mt-5 grid gap-1.5 sm:gap-2.5 ${COLS[view]}`}>
            {Array.from({ length: V.seats }).map((_, i) => {
              const slug = i > 0 ? s.hired[i - 1] : undefined;
              const state = i === 0 ? "home" : slug ? "hired" : "open";
              const sp = slug ? specialistBySlug(slug) : undefined;
              const cls = `pop relative grid aspect-square place-items-center rounded-[22%] transition ${state === "home" ? "bg-grape shadow-[0_4px_0_#3514b0]" : state === "hired" ? `bg-tint ring-2 ${pick === slug ? "ring-grape" : "ring-grape/40"} hover:-translate-y-1` : "border-2 border-dashed border-ink/25 bg-base/60 hover:border-grape hover:bg-tint"}`;
              const style = { animationDelay: `${Math.min(i, 40) * 14}ms` };
              const num = big && <span className={`label absolute bottom-[8%] right-[10%] text-[9px] ${state === "home" ? "text-white/85" : "text-ink/55"}`}>{String(i + 1).padStart(2, "0")}</span>;
              if (state === "home") return <Link key={i} href="/app?c=home" className={cls} style={style} title={`${agentName(s)} · seat 01`}><AgentFace look={s.agent?.look} size={120} track={big} className="!h-[72%] !w-[72%]" />{num}</Link>;
              if (state === "hired") return <button key={i} onClick={() => setPick(pick === slug ? null : slug!)} className={cls} style={style} title={`${sp?.name} · seat ${i + 1}`} aria-label={`${sp?.name}, seat ${i + 1}`}><SpecFace slug={slug!} size={90} className="!h-[72%] !w-[72%]" />{num}</button>;
              return <button key={i} onClick={() => openAdd()} className={cls} style={style} aria-label={`Open seat ${i + 1}. Add an agent.`}>{big && <Icon name="plus" size={22} className="text-ink/40" />}{num}</button>;
            })}
          </div>
          {pick && (() => { const sp = specialistBySlug(pick)!; return (
            <div className="pop relative mt-5 flex flex-wrap items-center gap-3 rounded-[22px] bg-ink p-3 text-[var(--bg)]">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--bg)]/10"><SpecFace slug={pick} size={40} /></span>
              <span className="min-w-0 flex-1"><b className="display block text-[24px] leading-none">{sp.name}</b><span className="text-[13px] opacity-75">{sp.job} · seat {String(s.hired.indexOf(pick) + 2).padStart(2, "0")}</span></span>
              <Link href={`/app?c=${pick}`} className="rounded-full bg-grape px-4 py-2 text-[14px] font-bold text-white">Chat</Link>
              <button onClick={() => openAgent(pick)} className="rounded-full px-4 py-2 text-[14px] font-bold ring-1 ring-current/30 hover:bg-[var(--bg)]/10">ID card</button>
              <button onClick={() => { release(pick); setPick(null); toast({ text: `${sp.name} left the seat`, face: sp.seed, color: sp.color }); }} className="rounded-full px-4 py-2 text-[14px] font-bold ring-1 ring-current/30 hover:bg-[var(--bg)]/10">Release</button>
            </div>
          ); })()}
          <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink/75">
            <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded bg-grape" />{agentName(s)}</span>
            <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded bg-tint ring-2 ring-grape/45" />Hired specialist</span>
            <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded border-2 border-dashed border-ink/30" />Open seat</span>
            {current && taken < V.seats && <button onClick={() => openAdd()} className="btn btn-brand btn-sm ml-auto"><Icon name="plus" size={16} />Add an agent</button>}
            {current && taken >= V.seats && <span className="ml-auto font-semibold text-brand-ink">Every seat is taken. Move up a plan for more.</span>}
          </div>
          <div className="relative mt-6 rounded-[22px] bg-tint p-4">
            <div className="flex items-center justify-between gap-3"><h3 className="text-[15px] font-bold text-ink">Made by you</h3><button onClick={() => openAdd("create")} className="flex items-center gap-1.5 text-[13.5px] font-bold text-brand-ink hover:underline"><Icon name="plus" size={14} />Create an agent</button></div>
            {s.custom.length ? (
              <div className="mt-3 flex flex-wrap gap-2">{s.custom.map((c) => <button key={c.id} onClick={() => openAgent(c.id)} className="flex items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3.5 text-[14px] font-bold text-ink ring-1 ring-line transition hover:ring-grape"><AgentTile id={c.id} look={null} size={30} radius={15} />{c.name}</button>)}</div>
            ) : <p className="mt-1 text-[13.5px] text-ink/60">Agents you create sit here. They don&apos;t use a seat in this demo.</p>}
          </div>
        </div>

        <div className="grain relative flex flex-col overflow-hidden rounded-[30px] bg-grape p-6 text-white sm:p-7">
          <span className="label text-white/80">{V.name} plan</span>
          <div className="mt-3 flex items-baseline gap-2"><span className="display text-[88px] leading-[0.8]">{V.seats}</span><span className="text-white/80">{V.seats === 1 ? "seat" : "seats"}</span></div>
          <p className="mt-5 text-[16px] leading-relaxed text-white/90">{V.for}</p>
          <ul className="mt-5 grid gap-2.5 text-[15px]">{V.points.map((pt) => <li key={pt} className="flex gap-2.5"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-white" />{pt}</li>)}</ul>
          {current ? <span className="btn relative z-10 mt-8 bg-white/15 text-white lg:mt-auto">Your current plan</span>
            : <button onClick={() => choose(view)} className="btn btn-white relative z-10 mt-8 lg:mt-auto">Switch to {V.name}</button>}
          <p className="relative z-10 mt-3 text-center text-[12px] text-white/75">Demo: switching is instant and local</p>
        </div>
      </div>

      <section data-rise className="mt-10">
        <h2 className="display text-[34px] text-ink sm:text-[42px]">Plans, by seats</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((x) => {
            const on = x.id === s.plan;
            return (
              <div key={x.id} className={`flex flex-col rounded-[26px] p-5 transition ${on ? "bg-ink text-[var(--bg)] shadow-[0_8px_0_#5b2bff]" : "bg-card text-ink ring-1 ring-line hover:-translate-y-1"}`}>
                <div className="flex items-center justify-between"><span className="text-[17px] font-bold">{x.name}</span>{on && <span className="label rounded-full bg-grape px-2 py-1 text-[9px] text-white">current</span>}</div>
                <div className="mt-3 flex items-end gap-1.5"><span className="display text-[56px] leading-[0.85]">{x.seats}</span><span className="pb-1 text-[14px] opacity-75">{x.seats === 1 ? "seat" : "seats"}</span></div>
                <div className="mt-3 flex flex-wrap gap-[3px]">{Array.from({ length: Math.min(x.seats, 20) }).map((_, i) => <i key={i} className={`h-2.5 w-2.5 rounded-[3px] ${i === 0 ? "bg-grape" : on ? "bg-[var(--bg)]/35" : "bg-tint"}`} />)}{x.seats > 20 && <span className="text-[11px] opacity-70">+{x.seats - 20}</span>}</div>
                <p className="mt-4 text-[14px] leading-snug opacity-80">{x.for}</p>
                {!on && <button onClick={() => choose(x.id)} className="btn btn-ghost btn-sm mt-5">Switch to {x.name}</button>}
              </div>
            );
          })}
        </div>
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setConfirm(null)}>
          <div role="dialog" onClick={(e) => e.stopPropagation()} className="pop w-full max-w-[420px] rounded-[28px] bg-card p-6 text-ink shadow-[0_12px_0_#5b2bff] ring-1 ring-line">
            <h3 className="display text-[32px]">Fewer seats on {PLANS.find((x) => x.id === confirm)!.name}</h3>
            <p className="mt-2 text-[15px] text-ink/75">These specialists would leave their seats. {agentName(s)} stays at seat 01.</p>
            <div className="mt-4 flex flex-wrap gap-2">{leaving.map((h) => <span key={h} className="flex items-center gap-2 rounded-full bg-tint py-1 pl-1 pr-3 text-[14px] font-bold"><span className="grid h-7 w-7 place-items-center rounded-full bg-card"><SpecFace slug={h} size={24} /></span>{specialistBySlug(h)?.name}</span>)}</div>
            <div className="mt-6 flex gap-2"><button onClick={() => apply(confirm)} className="btn btn-brand btn-sm flex-1">Switch anyway</button><button onClick={() => setConfirm(null)} className="btn btn-line btn-sm">Keep my team</button></div>
          </div>
        </div>
      )}
    </>
  );
}
