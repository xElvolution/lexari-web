"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import type { FaceState } from "@shared/components/avatar";
import { toast, type State } from "@/lib/store";
import { MAX_LEVEL, PERKS, coinsOf, hub, levelOf, xpFor, useHubBusy } from "@/lib/hub";
import { myAgents } from "@/components/agents";
import { WhoFace } from "@/components/faces";
import Icon from "@/components/Icon";
import { burst } from "@/components/fly";
import { Coin, Rise } from "./coin";
import { LevelBadge } from "./top";

const lookFor = (s: State, id: string) => (id === "home" ? s.agent?.look : null);

/** Pick an agent, pour coins into it as XP, and watch it level up. */
export default function LevelUp({ s }: { s: State }) {
  const team = myAgents(s);
  const [pick, setPick] = useState(team[0]?.id ?? "home");
  const agent = team.find((a) => a.id === pick) ?? team[0];
  const { level, xp } = levelOf(s, agent.id);
  const need = level >= MAX_LEVEL ? 0 : xpFor(level);
  const pct = level >= MAX_LEVEL ? 100 : Math.round((xp / need) * 100);
  const coins = coinsOf(s);
  const toNext = Math.max(0, need - xp);
  const [face, setFace] = useState<FaceState>("idle");
  const [rises, setRises] = useState<{ k: number; t: string }[]>([]);
  const [party, setParty] = useState<{ level: number; id: string } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const busy = useHubBusy();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const train = (amount: number) => {
    void hub.train(agent.id, amount).then((r) => {
    if (!r.ok) { toast({ text: r.error || (level >= MAX_LEVEL ? `${agent.name} is already at the top level.` : "Not enough coins. Do a quest first."), face: "home" }); return; }
    const k = Date.now(); setRises((x) => [...x.slice(-3), { k, t: `+${Math.min(amount, coins)} XP` }]);
    setTimeout(() => setRises((x) => x.filter((y) => y.k !== k)), 1200);
    if (stage.current) gsap.fromTo(stage.current, { scale: 0.96 }, { scale: 1, duration: 0.5, ease: "back.out(3)" });
    clearTimeout(timer.current);
    if (r.levelsGained > 0) { setFace("happy"); setParty({ level: r.level, id: agent.id }); }
    else { setFace("thinking"); timer.current = setTimeout(() => setFace("idle"), 900); }
    });
  };

  const R = 112, C = 2 * Math.PI * R;
  const nextPerk = PERKS.find((p) => p.level > level);
  return (
    <section data-rise id="level" className="scroll-mt-24 overflow-hidden rounded-[30px] bg-card ring-1 ring-line">
      <div className="flex flex-wrap items-end justify-between gap-4 p-5 pb-0 sm:p-7 sm:pb-0">
        <div>
          <p className="label text-[10px] text-brand-ink">Level up</p>
          <h2 className="display mt-1 text-[40px] leading-none text-ink sm:text-[48px]">Train your agents.</h2>
          <p className="mt-2 max-w-md text-[14px] leading-snug text-ink/65">Coins become XP. Every level unlocks a perk.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-tint px-3.5 py-2 text-[14px] font-bold tabular-nums text-ink"><Coin size={20} />{coins.toLocaleString("en-US")} to spend</span>
      </div>
      <div className="no-bar mt-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:px-7" role="radiogroup" aria-label="Agent to train">
        {team.map((a) => {
          const on = a.id === agent.id; const lv = levelOf(s, a.id).level;
          return (
            <button key={a.id} role="radio" aria-checked={on} onClick={() => { setPick(a.id); setFace("idle"); }} className={`flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-left transition ${on ? "bg-grape text-white shadow-[0_5px_0_#3514b0]" : "bg-tint text-ink hover:bg-grape/15"}`}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--face-tile)] ring-1 ring-line"><WhoFace who={a.id} look={lookFor(s, a.id)} size={32} /></span>
              <span><span className="block text-[14px] font-bold leading-tight">{a.name}</span><span className={`block text-[11.5px] font-semibold ${on ? "text-white/75" : "text-ink/55"}`}>Level {lv}</span></span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="carpet relative overflow-hidden rounded-[26px] bg-[#0a0a0a] p-5 text-white ring-1 ring-white/10 sm:p-6">
          <span className="pointer-events-none absolute left-1/2 top-[44%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-grape/45 blur-3xl" />
          <div ref={stage} className="relative mx-auto grid h-[260px] w-[260px] place-items-center max-[430px]:[zoom:.74]">
            <svg viewBox="0 0 260 260" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="130" cy="130" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="12" />
              <circle cx="130" cy="130" r={R} fill="none" stroke="url(#lvg)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700 ease-out" />
              <defs><linearGradient id="lvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c9b8ff" /><stop offset="1" stopColor="#5b2bff" /></linearGradient></defs>
            </svg>
            <span className="grid h-[184px] w-[184px] place-items-center rounded-full bg-[#141414] ring-1 ring-white/10"><WhoFace who={agent.id} look={lookFor(s, agent.id)} size={150} animated state={face} /></span>
            <LevelBadge level={level} big className="absolute bottom-1 right-5" />
            {rises.map((r) => <Rise key={r.k} k={r.k} text={r.t} />)}
          </div>
          <div className="relative mt-3 text-center">
            <p className="display text-[30px] leading-none">{agent.name}</p>
            <p className="mt-1.5 text-[13.5px] font-semibold tabular-nums text-white/65">{level >= MAX_LEVEL ? "Max level. A legend." : `Level ${level} · ${xp}/${need} XP · ${toNext} to level ${level + 1}`}</p>
          </div>
          <div className="relative mt-5 grid grid-cols-3 gap-2">
            {[25, 100].map((n) => (
              <button key={n} type="button" onClick={() => train(n)} disabled={!!busy || level >= MAX_LEVEL || coins <= 0} className="flex h-12 flex-col items-center justify-center rounded-2xl bg-white/10 text-[14px] font-bold ring-1 ring-white/15 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">
                <span>+{n} XP</span><span className="flex items-center gap-1 text-[11px] font-semibold text-white/60"><Coin size={12} />{n}</span>
              </button>
            ))}
            <button type="button" onClick={() => train(toNext)} disabled={!!busy || level >= MAX_LEVEL || coins < toNext} className="hub-shine flex h-12 flex-col items-center justify-center rounded-2xl bg-grape text-[14px] font-extrabold shadow-[0_5px_0_#3514b0] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
              <span>Level up</span><span className="flex items-center gap-1 text-[11px] font-semibold text-white/75"><Coin size={12} />{toNext}</span>
            </button>
          </div>
          {coins < toNext && level < MAX_LEVEL && <p className="relative mt-3 text-center text-[12.5px] text-white/55">{toNext - coins} more coins to level up in one go. <a href="#quests" className="font-bold text-lilac underline-offset-2 hover:underline">Find quests</a></p>}
        </div>
        <div>
          <div className="flex items-baseline justify-between"><h3 className="text-[16px] font-bold text-ink">Perks</h3>{nextPerk && <span className="text-[12.5px] font-semibold text-ink/55">Next: {nextPerk.title} at level {nextPerk.level}</span>}</div>
          <ol className="relative mt-3 space-y-1.5">
            <span className="absolute bottom-5 left-[21px] top-5 w-0.5 bg-line" aria-hidden />
            {PERKS.map((p) => {
              const got = level >= p.level; const next = p === nextPerk;
              return (
                <li key={p.level} className={`relative flex items-center gap-3 rounded-2xl p-2 pr-3 transition ${next ? "bg-tint ring-1 ring-grape/40" : ""}`}>
                  <span className={`relative grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${got ? "bg-grape text-white" : next ? "bg-card text-brand-ink ring-2 ring-grape" : "bg-card text-ink/40 ring-1 ring-line"}`} style={{ marginLeft: 6 }}>{got ? <Icon name="check" size={14} stroke={3} /> : p.level}</span>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${got ? "bg-grape/15 text-brand-ink" : "bg-tint text-ink/40"}`}><Icon name={p.icon} size={17} /></span>
                  <span className="min-w-0 flex-1"><span className={`block text-[14px] font-bold leading-tight ${got || next ? "text-ink" : "text-ink/50"}`}>{p.title}</span><span className="block text-[12.5px] leading-snug text-ink/55">{p.body}</span></span>
                  <span className={`label shrink-0 text-[8.5px] ${got ? "text-brand-ink" : "text-ink/40"}`}>{got ? "Unlocked" : `Lv ${p.level}`}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {party && <Celebrate key={`${party.id}-${party.level}`} s={s} id={party.id} level={party.level} name={team.find((a) => a.id === party.id)?.name ?? "Agent"} onClose={() => { setParty(null); setFace("idle"); }} />}
    </section>
  );
}

/** Full-screen level-up moment: spinning rays, a happy face, confetti and the perk it just unlocked. */
function Celebrate({ s, id, level, name, onClose }: { s: State; id: string; level: number; name: string; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  const perk = PERKS.find((p) => p.level === level);
  // The Hub re-renders every second (countdowns), which hands us a fresh onClose each time.
  // Keep it in a ref so the entrance animation and confetti run once, on mount only.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", k);
    const el = card.current;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const ctx = gsap.context(() => {
      if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(el, { scale: 0.6, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 0.65, ease: "back.out(1.8)" });
      gsap.fromTo(el.querySelector("[data-lv]"), { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, delay: 0.25, ease: "elastic.out(1, .5)" });
      const face = el.querySelector("[data-face]") as HTMLElement | null;
      [0, 350, 800].forEach((d) => timers.push(setTimeout(() => burst(face, 26), d)));
    });
    return () => { window.removeEventListener("keydown", k); timers.forEach(clearTimeout); ctx.kill(); };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/70 p-4 backdrop-blur-md" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current(); }} role="dialog" aria-modal="true" aria-label={`${name} reached level ${level}`}>
      <div ref={card} className="relative w-full max-w-[400px] overflow-hidden rounded-[34px] bg-grape p-7 pt-9 text-center text-white shadow-[0_30px_80px_-20px_rgba(91,43,255,.9)]">
        <span className="hub-rays pointer-events-none absolute left-1/2 top-[34%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2" style={{ background: "repeating-conic-gradient(from 0deg, rgba(255,255,255,.16) 0deg 9deg, transparent 9deg 22deg)", maskImage: "radial-gradient(circle, #000 15%, transparent 55%)", WebkitMaskImage: "radial-gradient(circle, #000 15%, transparent 55%)" }} />
        <p className="label relative text-white/80">Level up</p>
        <div data-face className="relative mx-auto mt-4 grid h-[170px] w-[170px] place-items-center rounded-full bg-[#0a0a0a] ring-4 ring-white/25 max-[430px]:[zoom:.82]">
          <WhoFace who={id} look={id === "home" ? s.agent?.look : null} size={140} animated state="happy" />
          <span className="absolute -bottom-3 -right-1"><LevelBadge level={level} big /></span>
        </div>
        <p data-lv className="display relative mt-6 text-[64px] leading-none">Level {level}</p>
        <p className="relative mt-2 text-[16px] font-semibold text-white/85">{name} just got better at its job.</p>
        {perk && (
          <div className="relative mt-5 flex items-center gap-3 rounded-2xl bg-white/12 p-3 text-left ring-1 ring-white/20">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-grape"><Icon name={perk.icon} size={20} /></span>
            <span><span className="label block text-[9px] text-white/70">Perk unlocked</span><span className="block text-[16px] font-bold">{perk.title}</span><span className="block text-[13px] text-white/75">{perk.body}</span></span>
          </div>
        )}
        <button type="button" onClick={() => close.current()} autoFocus className="relative mt-6 h-12 w-full rounded-full bg-white text-[16px] font-extrabold text-[#0a0a0a] transition hover:-translate-y-0.5">Keep going</button>
      </div>
    </div>,
    document.body,
  );
}
