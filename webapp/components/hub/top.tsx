"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { toast, type State } from "@/lib/store";
import { STREAK_PAY, checkedInToday, coinsOf, countdown, earnedSince, hub, hubOf, levelOf, nextReset, streakOf, useHubBusy, weekStart } from "@/lib/hub";

const utcKey = (t: number) => new Date(t).toISOString().slice(0, 10);
import { myAgents } from "@/components/agents";
import { WhoFace } from "@/components/faces";
import Icon from "@/components/Icon";
import { burst } from "@/components/fly";
import { Coin, flyCoins, useCount } from "./coin";

const lookFor = (s: State, id: string) => (id === "home" ? s.agent?.look : null);

/** Streak flame. Grey and still when the streak is zero. */
export function Flame({ size = 44, lit = true }: { size?: number; lit?: boolean }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox="0 0 40 48" width={size} height={size * 1.2} aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={`${u}o`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={lit ? "#5b2bff" : "#9a9a9a"} /><stop offset=".6" stopColor={lit ? "#8f6bff" : "#bdbdbd"} /><stop offset="1" stopColor={lit ? "#e3d9ff" : "#dadada"} /></linearGradient>
        <linearGradient id={`${u}i`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor={lit ? "#c9b8ff" : "#eeeeee"} /></linearGradient>
      </defs>
      {lit && <ellipse cx="20" cy="44" rx="13" ry="3" fill="#5b2bff" opacity=".25" />}
      <path className={lit ? "hub-flame" : ""} d="M20 2 C23 11 34 16 34 29 C34 38 27.6 45 20 45 C12.4 45 6 38 6 29 C6 22 10 18 13 14 C13.5 19 15.5 21 17.5 22 C16.5 14 18 8 20 2 Z" fill={`url(#${u}o)`} />
      <path className={lit ? "hub-flame-core" : ""} d="M20 22 C22 27 27 29 27 35 C27 39.6 23.9 43 20 43 C16.1 43 13 39.6 13 35 C13 31 15.5 29.5 17 27 C17.6 30 18.6 31 19.6 31.5 C19 28 19.2 25 20 22 Z" fill={`url(#${u}i)`} />
    </svg>
  );
}

/** Hero: animated balance, streak and this week's earnings, and the team with their levels. */
export function Hero({ s, now, ready }: { s: State; now: number; ready: number }) {
  const coins = useCount(coinsOf(s));
  const h = hubOf(s);
  const streak = streakOf(s, now);
  const week = earnedSince(s, weekStart(now));
  const team = myAgents(s).slice(0, 4);
  return (
    <section data-rise data-hub-hero className="grain relative overflow-hidden rounded-[34px] bg-grape p-6 text-white shadow-[0_24px_60px_-28px_rgba(91,43,255,.9)] sm:p-9">
      <span className="pointer-events-none absolute -right-24 -top-28 h-[420px] w-[420px] rounded-full border-[46px] border-white/[.06]" />
      <span className="pointer-events-none absolute -bottom-40 -left-24 h-[360px] w-[360px] rounded-full bg-[#b9a3ff]/25 blur-3xl" />
      <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="label text-white/75">Your balance</p>
          <div className="mt-3 flex items-center gap-4">
            <span data-coin-target className="hub-float inline-grid"><Coin size={64} /></span>
            <span className="display tabular-nums text-[76px] leading-none sm:text-[104px]" aria-live="polite">{coins.toLocaleString("en-US")}</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="flex items-center gap-2 rounded-full bg-white/15 py-1.5 pl-2 pr-3.5 text-[14px] font-bold backdrop-blur-sm"><Flame size={18} lit={streak > 0} />{streak}-day streak</span>
            <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-[14px] font-bold backdrop-blur-sm">+{week.toLocaleString("en-US")} this week</span>
            <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-[14px] font-bold backdrop-blur-sm">{h.lifetime.toLocaleString("en-US")} earned all time</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="#quests" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-[#0a0a0a] transition hover:-translate-y-0.5">{ready > 0 ? <><span className="grid h-6 min-w-6 place-items-center rounded-full bg-grape px-1.5 text-[12px] text-white">{ready}</span>Rewards ready</> : <>See quests</>}<Icon name="arrow" size={16} /></a>
            <a href="#level" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-[15px] font-bold text-white ring-1 ring-white/30 transition hover:bg-white/25">Level up an agent</a>
          </div>
        </div>
        <ul className="flex items-end justify-center gap-2 sm:gap-2.5 md:justify-end" aria-label="Your team">
          {team.map((a, i) => {
            const lv = levelOf(s, a.id).level; const big = i === 0;
            return (
              <li key={a.id} className="hub-float relative" style={{ animationDelay: `${i * -0.8}s` }}>
                <span className={`grid place-items-center rounded-[26px] bg-[#0a0a0a] ring-1 ring-white/15 ${big ? "h-[132px] w-[132px] max-sm:h-[96px] max-sm:w-[96px] max-sm:rounded-[22px]" : "h-[84px] w-[84px] max-sm:h-[58px] max-sm:w-[58px] max-sm:rounded-[18px]"}`}>
                  <span className={`grid place-items-center max-sm:scale-[0.72]`}><WhoFace who={a.id} look={lookFor(s, a.id)} size={big ? 108 : 64} animated /></span>
                </span>
                <LevelBadge level={lv} className="absolute -bottom-2 -right-2" small={!big} />
                <span className="mt-3 block max-w-[132px] truncate text-center text-[12.5px] font-bold text-white/85 max-sm:max-w-[60px] max-sm:text-[11.5px]">{a.name}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** A small hexagon with the level number. */
export function LevelBadge({ level, className = "", small = false, big = false }: { level: number; className?: string; small?: boolean; big?: boolean }) {
  const sz = big ? 64 : small ? 30 : 38;
  return (
    <span className={`grid place-items-center ${className}`} style={{ width: sz, height: sz }} aria-label={`Level ${level}`}>
      <svg viewBox="0 0 40 40" width={sz} height={sz} className="absolute drop-shadow-[0_3px_0_#2a0e8f]" aria-hidden>
        <path d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z" fill={level >= 10 ? "#ffd166" : "#ffffff"} stroke="#5b2bff" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <span className={`display relative leading-none text-[#3514b0] ${big ? "text-[28px]" : small ? "text-[13px]" : "text-[17px]"}`}>{level}</span>
    </span>
  );
}

/** A balance pill that sits in the corner once the hero balance scrolls away, so coins always land somewhere. */
export function FloatingBalance({ s }: { s: State }) {
  const coins = useCount(coinsOf(s));
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.querySelector("[data-hub-hero]"); if (!hero) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0.05 });
    io.observe(hero); return () => io.disconnect();
  }, []);
  return (
    <div className={`fixed right-4 top-[72px] z-[60] transition-all duration-300 lg:right-8 lg:top-6 ${show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"}`}>
      <a href="#top" className={`${show ? "flex" : "hidden"} items-center gap-2 rounded-full bg-card py-1.5 pl-1.5 pr-4 text-[15px] font-extrabold text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,.45)] ring-1 ring-line`} aria-label={`${coins} coins`}>
        <span data-coin-target className="inline-grid"><Coin size={28} /></span><span className="tabular-nums">{coins.toLocaleString("en-US")}</span>
      </a>
    </div>
  );
}

/** Daily check-in: a 7-day streak track, a flame, a satisfying stamp, and the last four weeks. */
export function CheckIn({ s, now }: { s: State; now: number }) {
  const done = checkedInToday(s, now);
  const streak = streakOf(s, now);
  const cur = done ? streak : streak + 1; // today's day number in the streak
  const start = Math.max(1, cur - 6);
  const tiles = Array.from({ length: 7 }, (_, i) => start + i);
  const btn = useRef<HTMLButtonElement>(null);
  const busy = useHubBusy();
  const flame = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const pay = STREAK_PAY[Math.min(STREAK_PAY.length, cur) - 1];
  const days = new Set((s.live?.ledger || []).filter((e) => e.kind === "check_in").map((e) => utcKey(e.at)));
  const grid = Array.from({ length: 28 }, (_, i) => utcKey(now - (27 - i) * 864e5));

  const claim = () => {
    void hub.checkIn(now || Date.now()).then((r) => {
    if (!r.ok) { toast({ text: r.error || "Already checked in today. See you tomorrow.", face: "home" }); return; }
    const tile = track.current?.querySelector<HTMLElement>("[data-today]");
    if (tile) gsap.fromTo(tile, { scale: 0.7, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.6, ease: "back.out(3)" });
    if (flame.current) gsap.fromTo(flame.current, { scale: 1.6 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, .45)" });
    flyCoins(tile || btn.current, r.coins); burst(tile || btn.current, 18);
    toast({ text: `Day ${r.day} checked in · +${r.coins} coins`, face: "home" });
    });
  };

  return (
    <section data-rise id="checkin" className="relative scroll-mt-24 overflow-hidden rounded-[30px] bg-card p-5 ring-1 ring-line sm:p-7">
      <div className="flex items-start gap-4">
        <span ref={flame} className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-tint"><Flame size={40} lit={streak > 0 || done} /></span>
        <div className="min-w-0">
          <p className="label text-[10px] text-brand-ink">Daily check-in</p>
          <h2 className="display mt-1 text-[36px] leading-none text-ink sm:text-[42px]">{streak}-day streak</h2>
          <p className="mt-2 text-[14px] leading-snug text-ink/65">Each day in a row pays more, up to 75 a day. Miss one and it starts over.</p>
        </div>
      </div>
      <ol ref={track} className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Streak days">
        {tiles.map((d) => {
          const got = d < cur || (d === cur && done); const today = d === cur;
          const p = STREAK_PAY[Math.min(STREAK_PAY.length, d) - 1]; const last = d === start + 6;
          return (
            <li key={d} data-today={today ? "" : undefined} className={`relative grid justify-items-center gap-1 rounded-2xl px-0.5 pb-2 pt-2 text-center transition-colors ${got ? "bg-grape text-white" : today ? "bg-tint text-ink ring-2 ring-grape" : "bg-tint text-ink/55"}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${got ? "text-white/75" : "text-ink/50"}`}>Day {d}</span>
              {got ? <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-grape"><Icon name="check" size={15} stroke={3} /></span>
                : last ? <span className="grid h-7 w-7 place-items-center"><Icon name="box" size={22} className="text-brand-ink" /></span> : <Coin size={26} />}
              <span className="text-[12.5px] font-extrabold tabular-nums">{p}</span>
              {today && !done && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-grape px-1.5 py-px text-[9px] font-bold text-white">Today</span>}
            </li>
          );
        })}
      </ol>
      {done
        ? <p className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-tint text-[14.5px] font-bold text-ink"><Icon name="check" size={17} className="text-brand-ink" stroke={3} />Checked in · next in {countdown(nextReset("daily", now) - now)}</p>
        : <button ref={btn} type="button" onClick={claim} disabled={!!busy} aria-busy={busy === "checkin"} className="hub-claim disabled:opacity-60 mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-grape text-[16px] font-extrabold text-white transition hover:-translate-y-0.5 active:translate-y-0.5">{busy === "checkin" ? "Confirm in your wallet…" : <>Check in · +{pay}<Coin size={22} /></>}</button>}
      <div className="mt-6">
        <div className="flex items-center justify-between"><span className="label text-[9.5px] text-ink/55">Last 4 weeks</span><span className="text-[12px] font-semibold text-ink/55">{grid.filter((k) => days.has(k)).length} of 28 days</span></div>
        <div className="mt-2 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5">
          {grid.map((k) => <span key={k} title={k} className={`aspect-square rounded-[5px] ${days.has(k) ? "bg-grape" : "bg-tint"} ${k === utcKey(now) ? "ring-2 ring-grape/50 ring-offset-1 ring-offset-[var(--card)]" : ""}`} />)}
        </div>
      </div>
    </section>
  );
}

/** Daily mystery box: shake, pop the lid, reveal the coins. */
const LID_OPEN = { y: -26, rotate: -18, transformOrigin: "20% 100%" };

export function MysteryBox({ s, now }: { s: State; now: number }) {
  const h = hubOf(s);
  const opened = h.boxes.length > 0;
  const won = opened ? h.ledger.find((e) => e.reason === "Mystery box" && utcKey(e.at) === utcKey(now))?.delta ?? 0 : 0;
  const busy = useHubBusy();
  const [phase, setPhase] = useState<"idle" | "shaking" | "open">(opened ? "open" : "idle");
  const box = useRef<HTMLDivElement>(null);
  const lid = useRef<SVGGElement>(null);
  // Already opened today (e.g. after a reload): rest the lid in the same pose the pop ends on, no replay.
  // When the next box is due, close it again.
  useLayoutEffect(() => {
    const el = lid.current; if (!el) return;
    if (!opened) { gsap.set(el, { clearProps: "all" }); el.removeAttribute("transform"); setPhase("idle"); return; }
    if (!gsap.isTweening(el)) gsap.set(el, LID_OPEN);
  }, [opened]);
  const open = () => {
    if (phase !== "idle") return;
    setPhase("shaking");
    setTimeout(() => {
      void hub.openBox(now || Date.now()).then((r) => {
        if (!r.ok) { setPhase("idle"); toast({ text: r.error || "The box did not open.", face: "home" }); return; }
        setPhase("open");
        if (lid.current) gsap.fromTo(lid.current, { y: 0, rotate: 0 }, { ...LID_OPEN, duration: 0.5, ease: "back.out(2)" });
        flyCoins(box.current, r.coins); burst(box.current, 22);
        toast({ text: r.coins >= 120 ? `Jackpot! +${r.coins} coins` : `Mystery box · +${r.coins} coins`, face: "home" });
      });
    }, 850);
  };
  return (
    <section data-rise id="box" className="relative flex scroll-mt-24 flex-col overflow-hidden rounded-[30px] bg-[#0a0a0a] p-5 text-white ring-1 ring-white/10 sm:p-7">
      <span className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-grape/40 blur-3xl" />
      <p className="label relative text-[10px] text-lilac">Daily mystery box</p>
      <h2 className="display relative mt-1 text-[36px] leading-none sm:text-[42px]">{phase === "open" ? `+${won || "?"} coins` : "What's inside?"}</h2>
      <p className="relative mt-2 text-[14px] leading-snug text-white/65">One a day. Anywhere from 15 to 250 coins.</p>
      <div ref={box} className="relative mx-auto mt-4 grid h-[170px] w-[200px] place-items-center">
        {phase === "open" && <span className="hub-rays pointer-events-none absolute inset-[-30px] rounded-full opacity-70" style={{ background: "repeating-conic-gradient(from 0deg, rgba(143,107,255,.45) 0deg 10deg, transparent 10deg 24deg)", maskImage: "radial-gradient(circle, #000 25%, transparent 68%)", WebkitMaskImage: "radial-gradient(circle, #000 25%, transparent 68%)" }} />}
        <svg viewBox="0 0 120 110" width="150" height="138" overflow="visible" className={`relative overflow-visible ${phase === "idle" ? "hub-wobble" : phase === "shaking" ? "hub-wobble-fast" : ""}`} aria-hidden>
          <ellipse cx="60" cy="104" rx="42" ry="5" fill="#000" opacity=".5" />
          <rect x="16" y="46" width="88" height="56" rx="8" fill="#5b2bff" />
          <rect x="16" y="46" width="88" height="14" fill="#3514b0" opacity=".5" />
          <rect x="53" y="46" width="14" height="56" fill="#c9b8ff" />
          {phase === "open" && <g><circle cx="60" cy="40" r="11" fill="#8f6bff" /><path d="M60 31 L62 37.5 L68.5 40 L62 42.5 L60 49 L58 42.5 L51.5 40 L58 37.5 Z" fill="#fff" /></g>}
          <g ref={lid}>
            <rect x="10" y="32" width="100" height="18" rx="6" fill="#7c4dff" />
            <rect x="53" y="32" width="14" height="18" fill="#e3d9ff" />
            <path d="M60 32 C50 14 34 18 40 28 C44 33 54 32 60 32 Z M60 32 C70 14 86 18 80 28 C76 33 66 32 60 32 Z" fill="#e3d9ff" />
          </g>
        </svg>
      </div>
      {phase === "open"
        ? <p className="relative mt-auto flex h-12 items-center justify-center gap-2 rounded-full bg-white/10 text-[14.5px] font-bold">Next box in {countdown(nextReset("daily", now) - now)}</p>
        : <button type="button" onClick={open} disabled={phase === "shaking" || !!busy} className="hub-shine relative mt-auto flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[16px] font-extrabold text-[#0a0a0a] transition hover:-translate-y-0.5 disabled:opacity-80">{phase === "shaking" ? "Opening…" : "Open the box"}</button>}
    </section>
  );
}
