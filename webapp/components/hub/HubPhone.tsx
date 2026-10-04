"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { MASK, setHideBalance, useHideBalance } from "@/lib/privacy";
import { isCreated, isLocked, primaryOf, refreshHub, toast, type State } from "@/lib/store";
import {
  ACHIEVEMENTS, MAX_LEVEL, PERKS, STREAK_PAY, TIERS, checkedInToday, coinsOf, countdown, earnedSince, hub, hubOf, inviteCode, levelOf, nextReset,
  questsView, streakOf, useHubBusy, weekStart, xpFor, type Period, type QuestView,
} from "@/lib/hub";
import { WEBAPP_URL } from "@shared/sites";
import Icon from "@/components/Icon";
import { AgentTile, WhoFace } from "@/components/faces";
import { LevelBadge } from "./top";
import { Orbit, SHARE } from "./referral";
import { myAgents } from "@/components/agents";
import { openAgent, openUpgrade } from "@/components/overlays";
import { Coin, Rise, flyCoins } from "./coin";
import BoxModal from "./BoxModal";


/* Native phone layout for the Hub (≤430px). Same actions as the desktop Hub, compact rows and cards. */

const card = "rounded-[18px] bg-card ring-1 ring-line";
const h2 = "text-[1.0625rem] font-bold leading-tight text-ink";
const meta = "text-[12.5px] leading-snug text-ink/60";
const pill = "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-3.5 text-[13px] font-bold transition disabled:opacity-50";

type SheetId = "train" | "invite" | "badges";
const SHEET_FOR: Record<string, SheetId> = { "#level": "train", "#invite": "invite", "#achievements": "badges" };

export default function HubPhone({ s, now }: { s: State; now: number }) {
  const h = hubOf(s);
  const coins = coinsOf(s);
  const streak = streakOf(s, now);
  const week = earnedSince(s, weekStart(now));
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const hide = useHideBalance();
  if (!s.live) return <HubLoading />; // never a fake 0 while the onchain state loads
  // Quest "Go" links that point at a section in a sheet (#level, #invite, #achievements) open that sheet instead.
  const onLink = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest?.("a[href^='#']");
    const id = a ? SHEET_FOR[a.getAttribute("href") || ""] : undefined;
    if (id) { e.preventDefault(); setSheet(id); }
  };
  return (
    <div id="top" className="space-y-3 pb-2" onClickCapture={onLink}>
      <header className="flex items-end justify-between gap-3 pt-1">
        <div><p className="label text-[9.5px] text-brand-ink">Hub</p><h1 className="mt-1 text-[1.375rem] font-extrabold leading-none tracking-tight text-ink">Earn and level up</h1></div>
      </header>

      {/* balance */}
      <section data-hub-hero className="relative overflow-hidden rounded-[20px] bg-grape p-4 text-white shadow-[0_14px_30px_-18px_rgba(91,43,255,.9)]">
        <span className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border-[22px] border-white/[.07]" />
        <div className="flex items-center gap-2"><p className="label text-[9px] text-white/70">Your balance</p><button data-hide-balance onClick={() => setHideBalance(!hide)} aria-label={hide ? "Show balance" : "Hide balance"} aria-pressed={hide} className="relative grid h-6 w-6 place-items-center rounded-full bg-white/15"><Icon name={hide ? "eyeoff" : "eye"} size={13} /></button></div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span data-coin-target className="inline-grid"><Coin size={30} /></span>
          <span data-balance className="text-[1.75rem] font-extrabold leading-none tabular-nums" aria-live="polite">{hide ? MASK : coins.toLocaleString("en-US")}</span>
          <span className="ml-auto text-right text-[12px] leading-tight text-white/75">+{hide ? MASK : week.toLocaleString("en-US")} this week<br />{hide ? MASK : h.lifetime.toLocaleString("en-US")} all time</span>
        </div>
        <div className="mt-3 flex gap-2 text-[12px] font-semibold">
          <span className="rounded-full bg-white/15 px-2.5 py-1">🔥 {streak}-day streak</span>
          <span className="rounded-full bg-white/15 px-2.5 py-1">{myAgents(s).length} on your team</span>
        </div>
      </section>

      {!s.live.program.live && <p role="status" className="rounded-[16px] bg-tint px-3.5 py-2.5 text-[13px] font-semibold text-ink/75 ring-1 ring-line">Rewards open soon: the Lexari program is not live on Solana yet. Your progress still counts.</p>}
      <CheckInRow s={s} now={now} />
      <div className="grid grid-cols-2 gap-3">
        <BoxCard s={s} now={now} />
        <LevelCard s={s} onTrain={() => setSheet("train")} />
      </div>
      <QuestList s={s} now={now} />
      <div className="space-y-2">
        <InviteRow s={s} onOpen={() => setSheet("invite")} />
        <AchievementsRow s={s} now={now} onOpen={() => setSheet("badges")} />
      </div>
      {sheet === "train" && <TrainSheet s={s} onClose={() => setSheet(null)} />}
      {sheet === "invite" && <InviteSheet s={s} onClose={() => setSheet(null)} />}
      {sheet === "badges" && <AchievementsSheet s={s} now={now} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** Bottom sheet that fits the phone: a fixed header with the close button, the body scrolls inside, page behind stays put. */
function Sheet({ label, onClose, children, data }: { label: string; onClose: () => void; children: React.ReactNode; data?: string }) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", k);
    const html = document.documentElement; const prev = html.style.overflow; html.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); html.style.overflow = prev; };
  }, []);
  return createPortal(
    <div data-hub-sheet-bg className="fixed inset-0 z-[85] flex items-end justify-center bg-black/65 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current(); }}>
      <div role="dialog" aria-modal="true" aria-label={label} {...{ [`data-${data || "hub-sheet"}`]: "" }} data-hub-sheet className="pop flex max-h-[calc(100dvh-16px)] w-full max-w-[460px] flex-col overflow-hidden rounded-t-[28px] bg-card ring-1 ring-line">
        <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3"><h2 className="text-[1.125rem] font-bold text-ink">{label}</h2><button type="button" data-sheet-close onClick={() => close.current()} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-tint text-ink/75"><Icon name="x" size={18} /></button></div>
        <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function CheckInRow({ s, now }: { s: State; now: number }) {
  const done = checkedInToday(s, now);
  const streak = streakOf(s, now);
  const cur = done ? streak : streak + 1;
  const pay = STREAK_PAY[Math.min(STREAK_PAY.length, cur) - 1];
  const busy = useHubBusy();
  const btn = useRef<HTMLButtonElement>(null);
  const claim = () => void hub.checkIn(now || Date.now()).then((r) => {
    if (!r.ok) { toast({ text: r.error || "Already checked in today.", face: "home" }); return; }
    flyCoins(btn.current, r.coins);
    toast({ text: `Day ${r.day} checked in · +${r.coins} coins`, face: "home" });
  });
  const start = Math.max(1, cur - 6);
  return (
    <section id="checkin" className={`${card} scroll-mt-20 p-3.5`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-tint text-[20px]">🔥</span>
        <div className="min-w-0 flex-1"><div className="text-[15px] font-bold text-ink">Daily check-in</div><div className={meta}>{done ? `Done · next in ${countdown(nextReset("daily", now) - now)}` : `Day ${cur} pays ${pay} coins`}</div></div>
        {done ? <span className={`${pill} bg-tint text-ink/70`}><Icon name="check" size={14} stroke={3} />Done</span>
          : <button ref={btn} type="button" onClick={claim} disabled={!!busy} className={`${pill} bg-grape text-white`}>{busy === "checkin" ? "Signing…" : <>Check in<span className="opacity-80">+{pay}</span></>}</button>}
      </div>
      <ol className="mt-3 grid grid-cols-7 gap-1" aria-label="Streak days">
        {Array.from({ length: 7 }, (_, i) => start + i).map((d) => {
          const got = d < cur || (d === cur && done);
          return <li key={d} className={`rounded-[9px] py-1 text-center ${got ? "bg-grape text-white" : d === cur ? "bg-tint text-ink ring-1 ring-grape" : "bg-tint text-ink/55"}`}><div className="text-[9.5px] font-bold uppercase">D{d}</div><div className="text-[11.5px] font-extrabold tabular-nums">{STREAK_PAY[Math.min(STREAK_PAY.length, d) - 1]}</div></li>;
        })}
      </ol>
    </section>
  );
}

function BoxCard({ s, now }: { s: State; now: number }) {
  const h = hubOf(s);
  const opened = h.boxes.length > 0;
  const won = opened ? s.live?.box.coins ?? h.ledger.find((e) => e.reason === "Mystery box")?.delta ?? 0 : 0;
  const busy = useHubBusy();
  const [modal, setModal] = useState(false);
  const el = useRef<HTMLButtonElement>(null);
  const run = async () => {
    const r = await hub.openBox(now || Date.now());
    if (r.ok) { flyCoins(el.current, r.coins); }
    return r;
  };
  return (
    <section id="box" data-box-opened={opened ? "" : undefined} className="flex scroll-mt-20 flex-col rounded-[18px] bg-[#0a0a0a] p-3.5 text-white ring-1 ring-white/10">
      <span className={`text-[26px] leading-none ${opened ? "opacity-70" : "hub-wobble"}`} aria-hidden>🎁</span>
      <div className="mt-2 text-[15px] font-bold">Mystery box</div>
      <div className="text-[12px] leading-snug text-white/60">{opened ? `Opened today${won ? ` · won ${won}` : ""}` : "15 to 250 coins, once a day"}</div>
      <div className="mt-auto pt-3">
        {opened ? <span data-box-next className={`${pill} w-full bg-white/10 tabular-nums text-white/75`}>Next in {countdown(nextReset("daily", now) - now).replace(/ \d+s$/, "")}</span>
          : <button ref={el} type="button" data-box-card-open onClick={() => setModal(true)} disabled={!!busy} className={`${pill} w-full bg-white text-[#0a0a0a]`}>{busy === "box" ? "Opening…" : "Open"}</button>}
      </div>
      <BoxModal open={modal} onOpen={run} onClose={() => setModal(false)} />
    </section>
  );
}

function LevelCard({ s, onTrain }: { s: State; onTrain: () => void }) {
  return (
    <button type="button" onClick={onTrain} data-level-card className={`${card} flex flex-col p-3.5 text-left`}>
      <AgentTile id={primaryOf(s)} look={s.agent?.look} size={30} />
      <div className="mt-2 text-[15px] font-bold text-ink">Level up</div>
      <div className={meta}>Spend coins to level up your agent.</div>
      <span data-train-agents className={`${pill} mt-auto w-full bg-tint text-brand-ink`} style={{ marginTop: "auto" }}>Train agents</span>
    </button>
  );
}

const TABS: { id: Period; label: string }[] = [{ id: "daily", label: "Daily" }, { id: "weekly", label: "Weekly" }, { id: "hard", label: "Hard" }];

function QuestList({ s, now }: { s: State; now: number }) {
  const all = questsView(s, now);
  const [tab, setTab] = useState<Period>("daily");
  const list = all.filter((q) => q.period === tab);
  const ready = (p: Period) => all.filter((q) => q.period === p && q.done && !q.claimed).length;
  return (
    <section id="quests" className={`${card} scroll-mt-20 p-3.5`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={h2}>Quests</h2>
        {tab !== "hard" && <span className="text-[12px] tabular-nums text-ink/55">Resets in {countdown(nextReset(tab, now) - now)}</span>}
      </div>
      <div role="tablist" aria-label="Quest type" className="mt-2.5 grid grid-cols-3 gap-1 rounded-full bg-tint p-1">
        {TABS.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={`flex h-8 items-center justify-center gap-1 rounded-full text-[13px] font-bold transition ${tab === x.id ? "bg-card text-ink shadow-[0_1px_0_var(--line),0_0_0_1px_var(--line)]" : "text-ink/60"}`}>
            {x.label}{ready(x.id) > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-grape px-1 text-[10px] text-white">{ready(x.id)}</span>}
          </button>
        ))}
      </div>
      <ul className="mt-1 divide-y divide-[var(--line)]">{list.map((q) => <QuestItem key={q.id} q={q} />)}</ul>
    </section>
  );
}

function QuestItem({ q }: { q: QuestView }) {
  const busy = useHubBusy();
  const btn = useRef<HTMLButtonElement>(null);
  const claim = () => void hub.claimQuest(q.id).then((r) => {
    if (!r.ok) { toast({ text: r.error || "That quest is not ready.", face: "home" }); return; }
    flyCoins(btn.current, r.coins);
    toast({ text: `${q.title} · +${r.coins} coins`, face: "home" });
  });
  const pct = Math.round((q.have / q.goal) * 100);
  const go = q.go || "#top";
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${q.claimed ? "bg-grape text-white" : "bg-tint text-brand-ink"}`}><Icon name={q.claimed ? "check" : q.icon} size={15} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><span className="truncate text-[14.5px] font-semibold text-ink">{q.title}</span><span className="flex shrink-0 items-center gap-0.5 text-[12px] font-bold text-brand-ink"><Coin size={12} />{q.reward}</span></div>
        <div className="flex items-center gap-2"><span className={`${meta} truncate`}>{q.hint}</span></div>
        <div className="mt-1 flex items-center gap-2"><span className="h-1 flex-1 overflow-hidden rounded-full bg-tint"><span className="block h-full rounded-full bg-grape" style={{ width: `${pct}%` }} /></span><span className="text-[11px] tabular-nums text-ink/50">{q.have}/{q.goal}</span></div>
      </div>
      {q.claimed ? <span className={`${pill} bg-tint text-ink/55`}>Done</span>
        : q.done ? <button ref={btn} type="button" onClick={claim} disabled={!!busy} className={`${pill} bg-grape text-white`}>{busy === `quest:${q.id}` ? "…" : "Claim"}</button>
        : go.startsWith("#") ? <a href={go} className={`${pill} bg-tint text-ink/75`}>Go</a> : <Link href={go} className={`${pill} bg-tint text-ink/75`}>Go</Link>}
    </li>
  );
}

const BURST = ["#ffd84d", "#c9b8ff", "#ffffff", "#8f6bff", "#ff9ec7", "#7ef0c4"];
/** Double chevron: the level-up symbol. */
const LevelUpMark = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 13l6-6 6 6" /><path d="M6 19l6-6 6 6" /></svg>;

/**
 * Train your agents (phone pop-up): everything the desktop train section has. Agent picker, the agent's face with its
 * level badge, XP bar, +25 / +100 XP packs and Level up, the hint line, and all the perks. The face bounces and smiles
 * while a level-up signs, then pops with a burst when the new level lands.
 */
function TrainSheet({ s, onClose }: { s: State; onClose: () => void }) {
  // Only agents you made level up (hired specialists never do); your primary agent comes first.
  const primary = primaryOf(s);
  const team = myAgents(s).filter((a) => isCreated(s, a.id)).sort((a, b) => (a.id === primary ? -1 : b.id === primary ? 1 : 0));
  const [pick, setPick] = useState(primary);
  const [won, setWon] = useState<{ level: number; n: number } | null>(null);
  const [rises, setRises] = useState<{ k: number; t: string }[]>([]);
  const agent = team.find((a) => a.id === pick) ?? team[0];
  const coins = coinsOf(s);
  const busy = useHubBusy();
  if (!agent) return <Sheet label="Train your agents" onClose={onClose} data="train-sheet"><p className="py-6 text-center text-[14px] text-ink/60">Make an agent to start training.</p></Sheet>;
  const { level, xp } = levelOf(s, agent.id);
  const max = level >= MAX_LEVEL;
  const need = max ? 0 : xpFor(level);
  const leveling = busy === "train";
  const pct = max ? 100 : Math.round((xp / need) * 100);
  const toNext = Math.max(0, need - xp);
  const minted = !!(s.live?.levels.find((l) => l.slug === agent.id)?.asset || s.meta[agent.id]?.nft?.tokenId);
  const locked = isLocked(s, agent.id);
  const perk = won ? PERKS.find((p) => p.level === won.level) : undefined;
  const nextPerk = PERKS.find((p) => p.level > level);
  const train = (n: number) => void hub.train(agent.id, n).then((r) => {
    if (!r.ok) { toast({ text: r.error || "Not enough coins. Do a quest first.", face: "home" }); return; }
    const k = Date.now(); setRises((x) => [...x.slice(-2), { k, t: `+${Math.min(n, coins)} XP` }]);
    setTimeout(() => setRises((x) => x.filter((y) => y.k !== k)), 1200);
    if (r.levelsGained > 0) { navigator.vibrate?.([20, 40, 30]); setWon((w) => ({ level: r.level, n: (w?.n ?? 0) + 1 })); }
  });
  const face = leveling || won ? "happy" : "idle";
  return (
    <Sheet label="Train your agents" onClose={onClose} data="train-sheet">
      <div className="flex items-center justify-between gap-2"><p className="text-[13px] leading-snug text-ink/60">Coins become XP. Every level unlocks a perk.</p><span className="flex shrink-0 items-center gap-1 rounded-full bg-tint px-2.5 py-1 text-[12.5px] font-bold tabular-nums text-ink"><Coin size={13} />{coins.toLocaleString("en-US")}</span></div>
      {team.length > 1 && (
        <div className="no-bar -mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 py-1.5" role="radiogroup" aria-label="Agent to train">
          {team.map((a) => <button key={a.id} role="radio" aria-checked={a.id === agent.id} onClick={() => { setPick(a.id); setWon(null); }} className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[13px] font-bold transition ${a.id === agent.id ? "bg-grape text-white" : "bg-tint text-ink/75"}`}><AgentTile id={a.id} look={a.id === "home" ? s.agent?.look : undefined} size={26} status={false} ring={false} />{a.name}<span className="opacity-70">Lv {levelOf(s, a.id).level}</span></button>)}
        </div>
      )}
      <div data-level-hero className="relative mt-3 overflow-hidden rounded-[22px] bg-[radial-gradient(120%_90%_at_50%_30%,#6a3dff_0%,#3514b0_55%,#12062e_100%)] px-3.5 pb-3.5 pt-3 text-center text-white">
        <span className={`hub-rays pointer-events-none absolute left-1/2 top-[40%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 ${leveling || won ? "opacity-100" : "opacity-40"}`} style={{ background: "repeating-conic-gradient(from 0deg, rgba(255,255,255,.14) 0deg 9deg, transparent 9deg 22deg)", maskImage: "radial-gradient(circle, #000 12%, transparent 52%)", WebkitMaskImage: "radial-gradient(circle, #000 12%, transparent 52%)" }} />
        <div className="relative flex items-center justify-center gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-full bg-[#ffd84d] text-[#3514b0] shadow-[0_0_18px_rgba(255,216,77,.7)] ${leveling || won ? "lv-arrow" : ""}`}><LevelUpMark size={16} /></span>
          <span key={`lv-${level}-${won?.n ?? 0}`} data-level-num className={`display text-[30px] leading-none tabular-nums ${won ? "lv-pop" : ""}`}>Level {level}</span>
        </div>
        <div className="relative mx-auto mt-3 grid h-[136px] w-[136px] place-items-center">
          {won && <span key={`burst-${won.n}`} className="lv-burst pointer-events-none absolute inset-0" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ background: BURST[i % BURST.length], ["--a" as string]: `${i * 20}deg`, ["--d" as string]: `${76 + (i % 3) * 16}px` } as React.CSSProperties} />)}</span>}
          <span key={`face-${won?.n ?? 0}`} data-level-face={face} className={`grid h-[124px] w-[124px] place-items-center rounded-full bg-[#0a0a0a] ring-4 ${won ? "lv-pop ring-[#ffd84d]" : "ring-white/25"} ${leveling ? "lv-bounce" : won ? "" : "lv-float"}`}>
            <WhoFace who={agent.id} look={agent.id === "home" ? s.agent?.look : null} size={104} animated state={face} />
          </span>
          <LevelBadge level={level} className="absolute -bottom-1 right-0" />
          {rises.map((r) => <Rise key={r.k} k={r.k} text={r.t} />)}
        </div>
        <p className="relative mt-2 text-[16px] font-bold leading-tight">{won ? `${agent.name} reached level ${won.level}!` : leveling ? `${agent.name} is levelling up…` : agent.name}</p>
        {won && perk && <p data-level-perk className="relative mt-0.5 text-[12.5px] leading-snug text-white/80">Perk unlocked: <b className="text-white">{perk.title}</b> · {perk.body}</p>}
        <div className="relative mt-2.5 flex items-center gap-2">
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15"><span data-level-xp className="block h-full rounded-full bg-[linear-gradient(90deg,#ffd84d,#ffffff)] transition-[width] duration-700 ease-out" style={{ width: `${leveling ? 100 : pct}%` }} /></span>
          <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-white/75">{max ? "max" : `${xp}/${need} XP`}</span>
        </div>
        <p className="relative mt-1.5 text-[12.5px] font-semibold tabular-nums text-white/65">{max ? "Max level. A legend." : `${toNext} XP to level ${level + 1}`}</p>
        {!max && (
          <div data-train-packs className="relative mt-3 grid grid-cols-3 gap-1.5">
            {[25, 100].map((n) => <button key={n} type="button" onClick={() => train(n)} disabled={!!busy || coins <= 0 || locked || !minted} className="flex h-12 flex-col items-center justify-center rounded-[14px] bg-white/10 text-[14px] font-bold ring-1 ring-white/15 disabled:opacity-40"><span>+{n} XP</span><span className="flex items-center gap-0.5 text-[11px] font-semibold text-white/60"><Coin size={11} />{n}</span></button>)}
            <button type="button" data-train-go onClick={() => train(toNext)} disabled={!!busy || coins < toNext || locked || !minted} className="flex h-12 flex-col items-center justify-center rounded-[14px] bg-[#ffd84d] text-[14px] font-extrabold text-[#2a0f8f] shadow-[0_4px_0_#b8960f] disabled:opacity-45 disabled:shadow-none"><span>{leveling ? "Levelling…" : "Level up"}</span><span className="flex items-center gap-0.5 text-[11px] font-semibold text-[#2a0f8f]/70"><Coin size={11} />{toNext}</span></button>
          </div>
        )}
      </div>
      {!max && (
        <div data-train-hint className="mt-2.5 text-center text-[12.5px] leading-snug text-ink/60">
          {locked ? <>{agent.name} is past your plan&apos;s seats. <button type="button" data-train-upgrade onClick={() => { onClose(); openUpgrade("full"); }} className="font-bold text-brand-ink">Upgrade plan</button></>
            : !minted ? <>Mint {agent.name}&apos;s ID card first to spend XP. <button type="button" onClick={() => { onClose(); openAgent(agent.id); }} className="font-bold text-brand-ink">Open ID card</button></>
            : coins < toNext ? <>{toNext - coins} more coins to level up in one go. <a href="#quests" onClick={onClose} className="font-bold text-brand-ink">Find quests</a></>
            : <>Level up spends {toNext} coins and takes {agent.name} to level {level + 1}.</>}
        </div>
      )}
      <div className="mt-4 flex items-baseline justify-between gap-2"><h3 className="text-[15px] font-bold text-ink">Perks</h3>{nextPerk && <span className="text-right text-[12px] font-semibold leading-snug text-ink/55">Next: {nextPerk.title} at Lv {nextPerk.level}</span>}</div>
      <ol data-perks className="relative mt-2 space-y-1">
        <span className="absolute bottom-5 left-[21px] top-5 w-0.5 bg-line" aria-hidden />
        {PERKS.map((p) => {
          const got = level >= p.level; const next = p === nextPerk;
          return (
            <li key={p.level} data-perk={got ? "unlocked" : "locked"} className={`relative flex items-center gap-2.5 rounded-[14px] p-1.5 pr-2.5 ${next ? "bg-tint ring-1 ring-grape/40" : ""}`}>
              <span className={`relative ml-[3px] grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${got ? "bg-grape text-white" : next ? "bg-card text-brand-ink ring-2 ring-grape" : "bg-card text-ink/45 ring-1 ring-line"}`}>{got ? <Icon name="check" size={14} stroke={3} /> : p.level}</span>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${got ? "bg-grape/15 text-brand-ink" : "bg-tint text-ink/40"}`}><Icon name={p.icon} size={17} /></span>
              <span className="min-w-0 flex-1"><span className={`block text-[14px] font-bold leading-tight ${got || next ? "text-ink" : "text-ink/55"}`}>{p.title}</span><span className="block text-[12.5px] leading-snug text-ink/55">{p.body}</span></span>
              <span className={`label shrink-0 text-[8.5px] ${got ? "text-brand-ink" : "text-ink/45"}`}>{got ? "Unlocked" : `Lv ${p.level}`}</span>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}

/** Invite friends: a compact row on the page; the code, link, share buttons and milestones live in its sheet. */
function InviteRow({ s, onOpen }: { s: State; onOpen: () => void }) {
  const h = hubOf(s);
  const friends = h.invited.length;
  const ready = TIERS.filter((t, i) => friends >= t.friends && !h.tiers.includes(i)).length;
  const next = TIERS.find((t) => friends < t.friends);
  return (
    <button type="button" id="invite" data-invite-row onClick={onOpen} className={`${card} flex w-full scroll-mt-20 items-center gap-3 p-3.5 text-left`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-tint text-brand-ink"><Icon name="users" size={18} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold text-ink">Invite friends · {friends} joined</span><span className={`block ${meta}`}>{next ? `${next.friends - friends} more for +${next.reward} coins` : "Every milestone reached"}</span></span>
      {ready > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-grape px-1.5 text-[11px] font-bold text-white">{ready}</span>}
      <Icon name="right" size={16} className="shrink-0 text-ink/40" />
    </button>
  );
}

function InviteSheet({ s, onClose }: { s: State; onClose: () => void }) {
  const h = hubOf(s);
  const code = inviteCode(s);
  const link = `${WEBAPP_URL}/signin?ref=${code}`;
  const msg = `I've got my own AI agent on Lexari. Join with my code ${code} and we both get coins.`;
  const busy = useHubBusy();
  const [copied, setCopied] = useState(false);
  const copy = (what: "code" | "link") => { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(what === "code" ? code : link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); toast({ text: what === "code" ? `Code ${code} copied` : "Invite link copied", face: "home" }); }, () => toast({ text: "Couldn't copy. Long-press the code instead.", face: "home" })); };
  const friends = h.invited.length;
  const next = TIERS.find((t) => friends < t.friends);
  const claim = (i: number, el: HTMLElement) => void hub.claimTier(i).then((r) => {
    if (!r.ok) { toast({ text: r.error || "That reward is not ready.", face: "home" }); return; }
    flyCoins(el, r.coins); toast({ text: `${TIERS[i].title} · +${r.coins} coins`, face: "home" });
  });
  const [menu, setMenu] = useState(false);
  const share = () => { if (navigator.share) navigator.share({ title: "Lexari", text: msg, url: link }).catch(() => {}); else setMenu((m) => !m); };
  return (
    <Sheet label="Invite friends" onClose={onClose} data="invite-sheet">
      <div data-invite-banner className="relative overflow-hidden rounded-[22px] bg-[#0a0a0a] px-4 pb-4 pt-2 text-center text-white ring-1 ring-white/10">
        <span className="pointer-events-none absolute -left-16 top-6 h-56 w-56 rounded-full bg-grape/50 blur-[70px]" />
        <span className="pointer-events-none absolute -right-14 bottom-0 h-48 w-48 rounded-full bg-[#8f6bff]/30 blur-[70px]" />
        <Orbit s={s} onCopy={() => copy("link")} className="[zoom:.72]" />
        <p className="label relative text-[9px] text-lilac">Invite friends</p>
        <h3 className="display relative mt-1 text-[30px] leading-[0.95]">Fill your orbit.</h3>
        <p className="relative mx-auto mt-2 max-w-[300px] text-[13px] leading-snug text-white/70">Friends who join with your code start with 50 coins. You collect a bonus at each milestone. {friends} joined{next ? ` · ${next.friends - friends} more for +${next.reward}` : ""}.</p>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-[16px] bg-tint p-2 pl-3.5">
        <button type="button" onClick={() => copy("code")} className="min-w-0 flex-1 text-left" aria-label={`Copy code ${code}`}>
          <span className="label block text-[8.5px] text-ink/50">Your code</span>
          <span className="block font-mono text-[18px] font-extrabold tracking-wider text-brand-ink">{code || "—"}</span>
          <span className="block break-all font-mono text-[11px] leading-snug text-ink/50">{link.replace(/^https?:\/\//, "")}</span>
        </button>
        <button type="button" data-invite-copy onClick={() => copy("link")} aria-label="Copy invite link" className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${copied ? "bg-grape text-white" : "bg-card text-ink/75 ring-1 ring-line"}`}><Icon name={copied ? "check" : "copy"} size={16} /></button>
      </div>
      <button type="button" data-invite-share onClick={share} className="btn btn-brand mt-2.5 w-full"><Icon name="arrow" size={16} />Share invite</button>
      {menu && (
        <div data-share-menu className="mt-2 grid grid-cols-2 gap-1.5 rounded-[16px] bg-tint p-1.5">
          {SHARE.map((x) => <a key={x.id} href={x.href(msg, link)} target="_blank" rel="noreferrer" onClick={() => setMenu(false)} className="flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-card text-[13px] font-bold text-ink ring-1 ring-line"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{x.glyph}</svg>{x.label}</a>)}
        </div>
      )}
      <h3 className="mt-4 text-[15px] font-bold text-ink">Milestones</h3>
      <ol data-invite-tiers className="mt-2 space-y-1">
        {TIERS.map((t, i) => {
          const reached = friends >= t.friends; const got = h.tiers.includes(i);
          return (
            <li key={t.friends} className={`flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 ${reached && !got ? "bg-grape/10 ring-1 ring-grape" : "bg-tint"}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${got ? "bg-grape text-white" : reached ? "bg-grape text-white" : "bg-card text-ink/45 ring-1 ring-line"}`}>{got ? <Icon name="check" size={15} stroke={3} /> : <Icon name="box" size={15} />}</span>
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold leading-tight text-ink">{t.title}</span><span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink/60">{t.friends} {t.friends === 1 ? "friend" : "friends"} · <Coin size={11} />{t.reward.toLocaleString("en-US")}</span></span>
              {reached && !got ? <button type="button" onClick={(e) => claim(i, e.currentTarget)} disabled={!!busy} className={`${pill} bg-grape text-white`}>{busy === `tier:${i}` ? "…" : "Claim"}</button>
                : <span className={`shrink-0 text-[12px] font-semibold ${got ? "text-brand-ink" : "text-ink/50"}`}>{got ? "Collected" : `${t.friends - friends} to go`}</span>}
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}

/** Achievements: a compact row on the page; the badge grid and progress live in its sheet. */
function AchievementsRow({ s, now, onOpen }: { s: State; now: number; onOpen: () => void }) {
  const h = hubOf(s);
  const n = ACHIEVEMENTS.filter((a) => a.test(s, h, now)).length;
  return (
    <button type="button" id="achievements" data-achievements-row onClick={onOpen} className={`${card} flex w-full scroll-mt-20 items-center gap-3 p-3.5 text-left`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-tint text-brand-ink"><Icon name="star" size={18} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold text-ink">Achievements · {n} of {ACHIEVEMENTS.length}</span><span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-tint"><span className="block h-full rounded-full bg-grape" style={{ width: `${(n / ACHIEVEMENTS.length) * 100}%` }} /></span></span>
      <Icon name="right" size={16} className="shrink-0 text-ink/40" />
    </button>
  );
}

function AchievementsSheet({ s, now, onClose }: { s: State; now: number; onClose: () => void }) {
  const h = hubOf(s);
  const list = ACHIEVEMENTS.map((a) => ({ ...a, got: a.test(s, h, now) }));
  const n = list.filter((a) => a.got).length;
  return (
    <Sheet label="Achievements" onClose={onClose} data="badges-sheet">
      <div className="flex items-center justify-between"><p className="text-[13px] text-ink/60">Badges you collect as you go.</p><span className="text-[13px] font-bold tabular-nums text-brand-ink">{n} of {list.length}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-tint"><div className="h-full rounded-full bg-grape" style={{ width: `${(n / list.length) * 100}%` }} /></div>
      <ul data-achievements className="mt-3 grid grid-cols-2 gap-2">
        {list.map((a) => (
          <li key={a.id} data-badge={a.got ? "got" : "locked"} className={`flex items-center gap-2.5 rounded-[14px] p-2.5 ${a.got ? "bg-tint" : "bg-tint/50"}`}>
            <span className={`relative grid h-10 w-10 shrink-0 place-items-center ${a.got ? "text-white" : "text-ink/30"}`}>
              <svg viewBox="0 0 56 56" width="40" height="40" className="absolute inset-0" aria-hidden><path d="M28 3 L50 15.5 V40.5 L28 53 L6 40.5 V15.5 Z" fill={a.got ? "#5b2bff" : "none"} stroke={a.got ? "#3514b0" : "currentColor"} strokeWidth="3" strokeDasharray={a.got ? undefined : "4 4"} strokeLinejoin="round" /></svg>
              <Icon name={a.icon} size={16} className="relative" />
            </span>
            <span className="min-w-0 flex-1"><span className={`block text-[13.5px] font-bold leading-tight ${a.got ? "text-ink" : "text-ink/50"}`}>{a.title}</span><span className="block text-[12px] leading-snug text-ink/55">{a.body}</span></span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Shown for the few seconds before the onchain Hub state arrives, so nobody sees a fake 0 balance or taps Check in twice. */
export function HubLoading() {
  // keep trying until the onchain state arrives (a failed first load used to leave a 0 balance on screen)
  useEffect(() => { void refreshHub(); const t = setInterval(() => void refreshHub(), 4000); return () => clearInterval(t); }, []);
  return (
    <div className="space-y-3 pb-2" aria-busy="true">
      <header className="pt-1"><p className="label text-[9.5px] text-brand-ink">Hub</p><h1 className="mt-1 text-[1.375rem] font-extrabold leading-none tracking-tight text-ink">Earn and level up</h1></header>
      <section className="relative overflow-hidden rounded-[20px] bg-grape p-4 text-white shadow-[0_14px_30px_-18px_rgba(91,43,255,.9)]">
        <p className="label text-[9px] text-white/70">Your balance</p>
        <div className="mt-1.5 flex items-center gap-2.5"><Coin size={30} /><span className="text-[15px] font-semibold text-white/80">Loading from Solana…</span></div>
        <div className="mt-3 h-6 w-40 animate-pulse rounded-full bg-white/15" />
      </section>
      {[0, 1, 2].map((i) => <div key={i} className={`${card} h-24 animate-pulse`} />)}
    </div>
  );
}
