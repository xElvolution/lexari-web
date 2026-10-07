"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { specialistBySlug } from "@/content/appData";
import { hirePriceLabel } from "@/lib/prices";
import { agentLevelOf, agentName, isCreated, isLocked, primaryOf, planOf, release, seatsUsed, toast, useApp } from "@/lib/store";
import { PlanSummary } from "@/components/Plans";
import Icon from "@/components/Icon";
import { AgentFace, RingLegend, SpecFace } from "@/components/faces";
import { myAgents } from "@/components/agents";
import { PageHead } from "@/components/ui";
import { AgentTile } from "@/components/faces";
import { openAdd, openAgent, openUpgrade } from "@/components/overlays";
import { AgentMenu, useAgentMenu } from "@/components/home/AgentMenu";
import { useRouter } from "next/navigation";

const PAGE = 20;
type Kind = "primary" | "made" | "hired";
const RING: Record<Kind, string> = { primary: "ring-[#f5c542]", made: "ring-[#8f6bff]", hired: "ring-[#c4c8d2]" };

export default function TeamPage() {
  const s = useApp()!;
  const [pick, setPick] = useState<string | null>(null);
  const menu = useAgentMenu();
  const router = useRouter();
  const nameFor = (id: string) => (id === "home" ? agentName(s) : s.meta[id]?.nick || s.custom.find((c) => c.id === id)?.name || specialistBySlug(id)?.name || id);
  const plan = planOf(s);
  const team = myAgents(s); // your agent, then the ones you made, then hired specialists
  const used = seatsUsed(s);
  const primary = primaryOf(s);
  // Seats you have, then locked seats up to the next row of five (at most 100).
  const unlocked = Math.min(Math.max(plan.seats, used), 100);
  const seats = Math.max(5, Math.ceil(Math.min(unlocked + (plan.seats < 100 ? 1 : 0), 100) / 5) * 5);
  const pages = Math.ceil(seats / PAGE);
  const big = seats <= 5;
  const free = s.paid.filter((x) => !s.hired.includes(x));
  const strip = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const goPage = (i: number) => { const el = strip.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" }); };
  const onScroll = () => { const el = strip.current; if (el) setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); };
  const kindOf = (id: string): Kind => (id === primary ? "primary" : isCreated(s, id) ? "made" : "hired");
  const picked = pick ? team.find((a) => a.id === pick) : undefined;

  const seat = (i: number) => {
    const a = team[i];
    const style = { animationDelay: `${Math.min(i % PAGE, 40) * 14}ms` };
    const num = big && <span className="label absolute bottom-[8%] right-[10%] text-[9px] text-ink/55 max-[430px]:hidden">{String(i + 1).padStart(2, "0")}</span>;
    if (a) {
      const k = kindOf(a.id);
      const locked = isLocked(s, a.id);
      const cls = `pop relative grid aspect-square place-items-center rounded-[22%] bg-tint ring-2 transition hover:-translate-y-0.5 ${RING[k]} ${k === "primary" ? "primary-ring [--r:22%]" : ""} ${pick === a.id ? "outline outline-2 outline-offset-2 outline-grape" : ""}`;
      const face = a.id === "home" ? <AgentFace look={s.agent?.look} size={120} track={big} className={`!h-[72%] !w-[72%] ${locked ? "opacity-40 grayscale" : ""}`} /> : <SpecFace slug={a.id} size={90} className={`!h-[72%] !w-[72%] ${locked ? "opacity-40 grayscale" : ""}`} />;
      // Level perks on the seat: a glow from level 4 (Card glow), gold from level 10 (Legend)
      const lv = k === "hired" ? 1 : agentLevelOf(s, a.id);
      const glow = lv >= 10 ? "legend" : lv >= 4 ? "glow" : undefined;
      if (locked) return <button key={i} data-agent-locked={a.id} onClick={() => openUpgrade("plans")} className={`${cls} opacity-80`} style={style} title={`${a.name} · locked on ${plan.name}`} aria-label={`${a.name} is locked on your plan. Upgrade to unlock.`}>{face}<span className="absolute inset-0 grid place-items-center"><span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[var(--bg)]"><Icon name="lock" size={13} /></span></span>{num}</button>;
      return <button key={i} {...menu.bind(a.id)} data-seat={a.id} data-ring={k} data-primary={k === "primary" ? "" : undefined} onClick={() => setPick(pick === a.id ? null : a.id)} className={cls} style={style} title={`${a.name} · seat ${i + 1}`} aria-label={`${a.name}, seat ${i + 1}${k === "primary" ? ", primary" : k === "made" ? ", made by you" : ", hired"}`}>{glow && <span aria-hidden data-seat-perk={glow} className="pointer-events-none absolute inset-0 rounded-[22%]" />}{face}{num}</button>;
    }
    if (i >= unlocked) return <button key={i} data-seat-locked onClick={() => openUpgrade(plan.id === "free" ? "add" : "full")} className="pop relative grid aspect-square place-items-center rounded-[22%] bg-ink/[.06] text-ink/35 transition hover:bg-tint hover:text-brand-ink" style={style} aria-label={`Seat ${i + 1} is locked. Upgrade for more seats.`} title="Locked · upgrade for more seats"><Icon name="lock" size={big ? 18 : 13} />{num}</button>;
    return <button key={i} data-seat-open onClick={() => openAdd()} className="pop relative grid aspect-square place-items-center rounded-[22%] border-2 border-dashed border-ink/25 bg-base/60 transition hover:border-grape hover:bg-tint" style={style} aria-label={`Open seat ${i + 1}. Add an agent.`}>{big && <Icon name="plus" size={18} className="text-ink/40" />}{num}</button>;
  };

  return (
    <>
      <AgentMenu s={s} at={menu.at} close={menu.close} onChat={(id) => router.push(`/agents/${id}`)} name={nameFor} />
      <PageHead kicker="Team" title="Your team floor." body={`Everyone on your team has a seat: ${agentName(s)}, the agents you made and the specialists you hired.`} />

      <div data-rise className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_.5fr]">
        <div className="relative overflow-hidden rounded-[30px] bg-card p-4 ring-2 ring-tint sm:p-7">
          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative flex items-center justify-between">
            <span className="label text-ink/65">floor plan</span>
            <span className="label tab-num text-brand-ink">{used} of {plan.seats} seat{plan.seats === 1 ? "" : "s"}</span>
          </div>
          <RingLegend className="relative mt-3" />
          <div ref={strip} onScroll={onScroll} data-floor-pages={pages} className="no-bar relative -mx-3 -mb-3 mt-1 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain py-3">
            {Array.from({ length: pages }, (_, p) => (
              <div key={p} data-floor-page={p + 1} className="w-full shrink-0 snap-start px-3" aria-label={`Seats ${p * PAGE + 1} to ${Math.min(seats, (p + 1) * PAGE)}`}>
                <div className={`grid gap-2 sm:gap-2.5 ${seats <= 5 ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-10"}`}>
                  {Array.from({ length: Math.min(PAGE, seats - p * PAGE) }, (_, j) => seat(p * PAGE + j))}
                </div>
              </div>
            ))}
          </div>
          {pages > 1 && (
            <div data-floor-dots className="relative mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Floor pages">
              {Array.from({ length: pages }, (_, p) => <button key={p} role="tab" aria-selected={page === p} aria-label={`Page ${p + 1}`} onClick={() => goPage(p)} className={`grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-[12px] font-bold tabular-nums transition ${page === p ? "bg-grape text-white" : "bg-tint text-ink/60 hover:text-ink"}`}>{p + 1}</button>)}
            </div>
          )}
          {picked && (() => { const k = kindOf(picked.id); return (
            <div className="pop relative mt-4 flex flex-wrap items-center gap-2.5 rounded-[22px] bg-ink p-3 text-[var(--bg)]">
              <AgentTile id={picked.id} look={s.agent?.look} size={44} status={false} />
              <span className="min-w-0 flex-1 max-sm:basis-[calc(100%-3.5rem)]"><b className="block truncate text-[18px] leading-tight">{picked.name}</b><span className="text-[12.5px] opacity-75">{k === "primary" ? "Primary" : k === "made" ? "Made by you" : picked.role} · seat {String(team.indexOf(picked) + 1).padStart(2, "0")}</span></span>
              <Link href={`/agents/${picked.id}`} className="rounded-full bg-grape px-3.5 py-1.5 text-[13.5px] font-bold text-white">Chat</Link>
              <button onClick={() => openAgent(picked.id)} className="rounded-full px-3.5 py-1.5 text-[13.5px] font-bold ring-1 ring-current/30 hover:bg-[var(--bg)]/10">ID card</button>
              {k === "hired" && <button onClick={() => { release(picked.id); setPick(null); toast({ text: `${picked.name} left the seat` }); }} className="rounded-full px-3.5 py-1.5 text-[13.5px] font-bold ring-1 ring-current/30 hover:bg-[var(--bg)]/10">Release</button>}
            </div>
          ); })()}
          <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink/70">
            <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded border-2 border-dashed border-ink/30" />Open seat</span>
            <span className="flex items-center gap-1.5"><i className="grid h-3.5 w-3.5 place-items-center rounded bg-ink/10"><Icon name="lock" size={9} className="text-ink/50" /></i>Locked</span>
            <span className="text-ink/50">Long-press an agent for more</span>
            <button onClick={() => openAdd()} className="btn btn-brand btn-sm ml-auto"><Icon name="plus" size={16} />Add an agent</button>
          </div>
        </div>

        <div className="grain relative flex flex-col overflow-hidden rounded-[30px] bg-grape p-6 text-white sm:p-7">
          <span className="label text-white/80">{plan.name} plan</span>
          <div className="mt-3 flex items-baseline gap-2"><span className="display text-[88px] leading-[0.8]">{plan.seats}</span><span className="text-white/80">{plan.seats === 1 ? "agent: your own" : "seats"}</span></div>
          <p className="mt-5 text-[16px] leading-relaxed text-white/90">{plan.id === "free" ? "Free plan includes one agent: your own. Upgrade to Pro to hire specialists from the marketplace." : `${used} of ${plan.seats} seats used. Each specialist is a one-time ${hirePriceLabel()} hire.`}</p>
          {plan.id !== "plus" && plan.id !== "max" && <button data-upgrade-plan onClick={() => openUpgrade("plans")} className="btn btn-white relative z-10 mt-5">Upgrade plan</button>}
          {free.length > 0 && <p className="relative z-10 mt-5 text-[13.5px] text-white/85">{free.length} paid specialist{free.length === 1 ? " is" : "s are"} off the floor. Add them back from the marketplace for free.</p>}
          <Link href="/marketplace" className="btn btn-white relative z-10 mt-8 lg:mt-auto">Open the marketplace</Link>
        </div>
      </div>
      <section data-rise id="plans" className="mt-8">
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Plans</h2>
        <p className="mt-0.5 text-[14px] text-ink/55">More seats for more agents. Monthly or yearly (2 months free), paid in devnet SOL.</p>
        <div className="mt-4"><PlanSummary /></div>
      </section>
    </>
  );
}
