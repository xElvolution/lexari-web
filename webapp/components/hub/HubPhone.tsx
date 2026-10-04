"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { SHARE } from "./referral";
import { myAgents } from "@/components/agents";
import { openAgent, openUpgrade } from "@/components/overlays";
import { Coin, flyCoins } from "./coin";
import BoxModal from "./BoxModal";


/* Native phone layout for the Hub (≤430px). Same actions as the desktop Hub, compact rows and cards. */

const card = "rounded-[18px] bg-card ring-1 ring-line";
const h2 = "text-[1.0625rem] font-bold leading-tight text-ink";
const meta = "text-[12.5px] leading-snug text-ink/60";
const pill = "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-3.5 text-[13px] font-bold transition disabled:opacity-50";

export default function HubPhone({ s, now }: { s: State; now: number }) {
  const h = hubOf(s);
  const coins = coinsOf(s);
  const streak = streakOf(s, now);
  const week = earnedSince(s, weekStart(now));
  const [train, setTrain] = useState<{ id?: string; won?: number } | null>(null);
  const hide = useHideBalance();
  const ready = questsView(s, now).filter((q) => q.done && !q.claimed).length + TIERS.filter((t, i) => hubOf(s).invited.length >= t.friends && !hubOf(s).tiers.includes(i)).length;
  if (!s.live) return <HubLoading />; // never a fake 0 while the onchain state loads
  return (
    <div id="top" className="space-y-3 pb-2">
      <header className="flex items-end justify-between gap-3 pt-1">
        <div><p className="label text-[9.5px] text-brand-ink">Hub</p><h1 className="mt-1 text-[1.375rem] font-extrabold leading-none tracking-tight text-ink">Earn and level up</h1></div>
      </header>
      <nav aria-label="Hub sections" className="no-bar -mx-4 flex gap-1.5 overflow-x-auto px-4">
        {([["#checkin", "Check in"], ["#quests", "Quests"], ["#level", "Train"], ["#invite", "Invite"], ["#achievements", "Badges"]] as const).map(([href, l]) => <a key={href} href={href} className="shrink-0 rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-ink/80 ring-1 ring-line">{l}</a>)}
      </nav>

      {/* balance */}
      <section data-hub-hero className="relative overflow-hidden rounded-[20px] bg-grape p-4 text-white shadow-[0_14px_30px_-18px_rgba(91,43,255,.9)]">
        <span className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border-[22px] border-white/[.07]" />
        <div className="flex items-center gap-2"><p className="label text-[9px] text-white/70">Your balance</p><button data-hide-balance onClick={() => setHideBalance(!hide)} aria-label={hide ? "Show balance" : "Hide balance"} aria-pressed={hide} className="relative grid h-6 w-6 place-items-center rounded-full bg-white/15"><Icon name={hide ? "eyeoff" : "eye"} size={13} /></button></div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span data-coin-target className="inline-grid"><Coin size={30} /></span>
          <span data-balance className="text-[1.75rem] font-extrabold leading-none tabular-nums" aria-live="polite">{hide ? MASK : coins.toLocaleString("en-US")}</span>
          <span className="ml-auto text-right text-[12px] leading-tight text-white/75">+{hide ? MASK : week.toLocaleString("en-US")} this week<br />{hide ? MASK : h.lifetime.toLocaleString("en-US")} all time</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-semibold">
          <span className="rounded-full bg-white/15 px-2.5 py-1">🔥 {streak}-day streak</span>
          {ready > 0 ? <a href="#quests" className="rounded-full bg-white px-2.5 py-1 text-[#3514b0]">{ready} reward{ready === 1 ? "" : "s"} ready</a> : <a href="#quests" className="rounded-full bg-white/15 px-2.5 py-1">See quests</a>}
          <a href="#level" className="rounded-full bg-white/15 px-2.5 py-1">Level up</a>
        </div>
        <ul data-hub-team className="no-bar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1" aria-label="Your team">
          {myAgents(s).filter((a) => isCreated(s, a.id)).slice(0, 8).map((a) => (
            <li key={a.id} className="relative shrink-0">
              <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#0a0a0a] ring-1 ring-white/15"><WhoFace who={a.id} look={a.id === "home" ? s.agent?.look : null} size={36} /></span>
              <LevelBadge level={levelOf(s, a.id).level} small className="absolute -bottom-1.5 -right-1.5 !h-[22px] !w-[22px] [&_svg]:!h-[22px] [&_svg]:!w-[22px] [&>span]:!text-[10px]" />
            </li>
          ))}
        </ul>
      </section>

      {!s.live.program.live && <p role="status" className="rounded-[16px] bg-tint px-3.5 py-2.5 text-[13px] font-semibold text-ink/75 ring-1 ring-line">Rewards open soon: the Lexari program is not live on Solana yet. Your progress still counts.</p>}
      <CheckInRow s={s} now={now} />
      <BoxCard s={s} now={now} />
      <QuestList s={s} now={now} />
      <TrainSection s={s} onSheet={(id, won) => setTrain({ id, won })} />
      {train && <TrainSheet s={s} first={train.id} won0={train.won} onClose={() => setTrain(null)} />}
      <InviteSection s={s} />
      <AchievementsRow s={s} now={now} />
    </div>
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
    <section id="box" data-box-opened={opened ? "" : undefined} className="flex scroll-mt-20 items-center gap-3 rounded-[18px] bg-[#0a0a0a] p-3.5 text-white ring-1 ring-white/10">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/10 text-[22px] leading-none ${opened ? "" : "hub-wobble"}`} aria-hidden>🎁</span>
      <div className="min-w-0 flex-1"><div className="text-[15px] font-bold">Mystery box</div><div className="text-[12px] leading-snug text-white/60">{opened ? `Opened today${won ? ` · won ${won}` : ""}` : "15 to 250 coins, once a day"}</div></div>
      {opened ? <span data-box-next className={`${pill} bg-white/10 tabular-nums text-white/75`}>Next {countdown(nextReset("daily", now) - now).replace(/ \d+s$/, "")}</span>
        : <button ref={el} type="button" data-box-card-open onClick={() => setModal(true)} disabled={!!busy} className={`${pill} bg-white text-[#0a0a0a]`}>{busy === "box" ? "Opening…" : "Open"}</button>}
      <BoxModal open={modal} onOpen={run} onClose={() => setModal(false)} />
    </section>
  );
}

/** Train your agents (phone): pick an agent, see its level and XP, top up with +25 / +100 XP packs or level up in one go, and the perks road. */
function TrainSection({ s, onSheet }: { s: State; onSheet: (id: string, won?: number) => void }) {
  const primary = primaryOf(s);
  const team = myAgents(s).filter((a) => isCreated(s, a.id)).sort((a, b) => (a.id === primary ? -1 : b.id === primary ? 1 : 0));
  const [pick, setPick] = useState(primary);
  const [all, setAll] = useState(false);
  const busy = useHubBusy();
  const agent = team.find((a) => a.id === pick) ?? team[0];
  if (!agent) return null;
  const coins = coinsOf(s);
  const { level, xp } = levelOf(s, agent.id);
  const max = level >= MAX_LEVEL;
  const need = max ? 0 : xpFor(level);
  const pct = max ? 100 : Math.round((xp / need) * 100);
  const toNext = Math.max(0, need - xp);
  const minted = !!(s.live?.levels.find((l) => l.slug === agent.id)?.asset || s.meta[agent.id]?.nft?.tokenId);
  const pack = (n: number) => void hub.train(agent.id, n).then((r) => {
    if (!r.ok) { toast({ text: r.error || "Not enough coins. Do a quest first.", face: "home" }); return; }
    if (r.levelsGained > 0) onSheet(agent.id, r.level);
    else toast({ text: `${agent.name} +${Math.min(n, coins)} XP`, face: "home" });
  });
  const nextPerk = PERKS.find((p) => p.level > level);
  const perks = all ? PERKS : PERKS.filter((p) => p.level >= Math.max(2, level) ).slice(0, 3);
  return (
    <section id="level" data-train-section className={`${card} scroll-mt-20 p-3.5`}>
      <div className="flex items-center justify-between gap-2"><h2 className={h2}>Train your agents</h2><span className="flex items-center gap-1 rounded-full bg-tint px-2.5 py-1 text-[12px] font-bold tabular-nums text-ink"><Coin size={13} />{coins.toLocaleString("en-US")}</span></div>
      {team.length > 1 && (
        <div className="no-bar -mx-3.5 mt-2 flex gap-1.5 overflow-x-auto px-3.5" role="radiogroup" aria-label="Agent to train">
          {team.map((a) => <button key={a.id} role="radio" aria-checked={a.id === agent.id} onClick={() => setPick(a.id)} className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12.5px] font-bold transition ${a.id === agent.id ? "bg-grape text-white" : "bg-tint text-ink/75"}`}><AgentTile id={a.id} look={a.id === "home" ? s.agent?.look : undefined} size={24} status={false} ring={false} />{a.name}<span className="opacity-70">Lv {levelOf(s, a.id).level}</span></button>)}
        </div>
      )}
      <button type="button" data-level-card onClick={() => onSheet(agent.id)} className="mt-3 flex w-full items-center gap-3 rounded-[14px] bg-[#0a0a0a] p-2.5 text-left text-white">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#141414] ring-1 ring-white/10"><WhoFace who={agent.id} look={agent.id === "home" ? s.agent?.look : null} size={40} animated /><LevelBadge level={level} small className="absolute -bottom-1.5 -right-1.5" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-bold">{agent.name}</span><span className="mt-1 flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#c9b8ff,#5b2bff)]" style={{ width: `${pct}%` }} /></span><span className="text-[11px] tabular-nums text-white/65">{max ? "max" : `${xp}/${need}`}</span></span></span>
        <Icon name="right" size={16} className="shrink-0 text-white/50" />
      </button>
      {!max && (minted ? (
        <div data-train-packs className="mt-2 grid grid-cols-3 gap-1.5">
          {[25, 100].map((n) => <button key={n} type="button" onClick={() => pack(n)} disabled={!!busy || coins <= 0} className="flex h-11 flex-col items-center justify-center rounded-[12px] bg-tint text-[13px] font-bold text-ink disabled:opacity-45"><span>+{n} XP</span><span className="flex items-center gap-0.5 text-[10.5px] font-semibold text-ink/55"><Coin size={10} />{n}</span></button>)}
          <button type="button" data-train-open onClick={() => onSheet(agent.id)} disabled={!!busy} className="flex h-11 flex-col items-center justify-center rounded-[12px] bg-grape text-[13px] font-extrabold text-white disabled:opacity-45"><span>Level up</span><span className="flex items-center gap-0.5 text-[10.5px] font-semibold text-white/75"><Coin size={10} />{toNext}</span></button>
        </div>
      ) : <button type="button" onClick={() => openAgent(agent.id)} className={`${pill} mt-2 w-full bg-grape text-white`}>Mint ID card to level up</button>)}
      <div className="mt-3 flex items-baseline justify-between"><h3 className="text-[13.5px] font-bold text-ink">Perks</h3>{nextPerk && <span className="text-[11.5px] font-semibold text-ink/55">Next: {nextPerk.title} at Lv {nextPerk.level}</span>}</div>
      <ol data-perks className="mt-1.5 space-y-1">
        {perks.map((p) => { const got = level >= p.level; return (
          <li key={p.level} className={`flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 ${p === nextPerk ? "bg-tint ring-1 ring-grape/40" : ""}`}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${got ? "bg-grape text-white" : "bg-card text-ink/50 ring-1 ring-line"}`}>{got ? <Icon name="check" size={12} stroke={3} /> : p.level}</span>
            <span className="min-w-0 flex-1"><span className={`block text-[13px] font-bold leading-tight ${got || p === nextPerk ? "text-ink" : "text-ink/55"}`}>{p.title}</span><span className="block truncate text-[11.5px] text-ink/55">{p.body}</span></span>
            <span className={`label shrink-0 text-[8px] ${got ? "text-brand-ink" : "text-ink/40"}`}>{got ? "Unlocked" : `Lv ${p.level}`}</span>
          </li>
        ); })}
      </ol>
      <button type="button" onClick={() => setAll(!all)} className="mt-1 w-full text-center text-[12.5px] font-bold text-brand-ink">{all ? "Show less" : `All ${PERKS.length} perks`}</button>
    </section>
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
 * Level up pop-up: a hero card with the agent's face big in the middle. It floats while it waits, bounces and smiles
 * wider while the level-up signs and confirms, then pops with a burst when the new level lands. Cost, your coins and
 * one button (Level up / Not enough coins / Upgrade plan / Mint ID card) underneath.
 */
function TrainSheet({ s, onClose, first, won0 }: { s: State; onClose: () => void; first?: string; won0?: number }) {
  // Only agents you made level up (hired specialists never do); your primary agent comes first.
  const primary = primaryOf(s);
  const team = myAgents(s).filter((a) => isCreated(s, a.id)).sort((a, b) => (a.id === primary ? -1 : b.id === primary ? 1 : 0));
  const [pick, setPick] = useState(first || primary);
  const [won, setWon] = useState<{ level: number; n: number } | null>(won0 ? { level: won0, n: 1 } : null);
  const firstPick = useRef(true);
  const agent = team.find((a) => a.id === pick) ?? team[0];
  const coins = coinsOf(s);
  const busy = useHubBusy();
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  useEffect(() => { if (firstPick.current) { firstPick.current = false; return; } setWon(null); }, [pick]);
  if (!agent) return null;
  const { level, xp } = levelOf(s, agent.id);
  const max = level >= MAX_LEVEL;
  const need = max ? 0 : xpFor(level);
  const leveling = busy === "train";
  const pct = max ? 100 : leveling ? 100 : Math.round((xp / need) * 100);
  const cost = Math.max(0, need - xp);
  const minted = !!(s.live?.levels.find((l) => l.slug === agent.id)?.asset || s.meta[agent.id]?.nft?.tokenId);
  const locked = isLocked(s, agent.id);
  const short = coins < cost;
  const perk = won ? PERKS.find((p) => p.level === won.level) : undefined;
  const up = () => void hub.train(agent.id, cost).then((r) => {
    if (!r.ok) { toast({ text: r.error || "Could not level up.", face: "home" }); return; }
    navigator.vibrate?.([20, 40, 30]);
    if (r.levelsGained > 0) setWon((w) => ({ level: r.level, n: (w?.n ?? 0) + 1 }));
    else toast({ text: `${agent.name} +${cost} XP`, face: "home" });
  });
  const face = leveling || won ? "happy" : "idle";
  return (
    <div data-train-sheet-bg className="fixed inset-0 z-[85] flex items-end justify-center bg-black/65 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Level up" data-train-sheet className="pop pb-safe-dlg w-full max-w-[460px] rounded-t-[28px] bg-card p-4 ring-1 ring-line">
        <div className="flex items-center justify-between"><h2 className="text-[1.125rem] font-bold text-ink">Level up</h2><button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={18} /></button></div>
        {team.length > 1 && (
          <div className="no-bar -mx-4 mt-1 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Agent to level up">
            {team.map((a) => <button key={a.id} role="radio" aria-checked={a.id === agent.id} onClick={() => setPick(a.id)} className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[13px] font-bold transition ${a.id === agent.id ? "bg-grape text-white" : "bg-tint text-ink/75"}`}><AgentTile id={a.id} look={a.id === "home" ? s.agent?.look : undefined} size={26} status={false} ring={false} />{a.name}</button>)}
          </div>
        )}
        <div data-level-hero className="relative mt-3 overflow-hidden rounded-[24px] bg-[radial-gradient(120%_90%_at_50%_30%,#6a3dff_0%,#3514b0_55%,#12062e_100%)] px-4 pb-4 pt-3 text-center text-white">
          <span className={`hub-rays pointer-events-none absolute left-1/2 top-[52%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 ${leveling || won ? "opacity-100" : "opacity-40"}`} style={{ background: "repeating-conic-gradient(from 0deg, rgba(255,255,255,.14) 0deg 9deg, transparent 9deg 22deg)", maskImage: "radial-gradient(circle, #000 12%, transparent 52%)", WebkitMaskImage: "radial-gradient(circle, #000 12%, transparent 52%)" }} />
          <div className="relative flex items-center justify-center gap-2">
            <span className={`grid h-8 w-8 place-items-center rounded-full bg-[#ffd84d] text-[#3514b0] shadow-[0_0_18px_rgba(255,216,77,.7)] ${leveling || won ? "lv-arrow" : ""}`}><LevelUpMark /></span>
            <span key={`lv-${level}-${won?.n ?? 0}`} data-level-num className={`display text-[40px] leading-none tabular-nums ${won ? "lv-pop" : ""}`}>Level {level}</span>
          </div>
          <div className="relative mx-auto mt-3 grid h-[168px] w-[168px] place-items-center">
            {won && <span key={`burst-${won.n}`} className="lv-burst pointer-events-none absolute inset-0" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ background: BURST[i % BURST.length], ["--a" as string]: `${i * 20}deg`, ["--d" as string]: `${88 + (i % 3) * 18}px` } as React.CSSProperties} />)}</span>}
            <span key={`face-${won?.n ?? 0}`} data-level-face={face} className={`grid h-[156px] w-[156px] place-items-center rounded-full bg-[#0a0a0a] ring-4 ${won ? "lv-pop ring-[#ffd84d]" : "ring-white/25"} ${leveling ? "lv-bounce" : won ? "" : "lv-float"}`}>
              <WhoFace who={agent.id} look={agent.id === "home" ? s.agent?.look : null} size={128} animated state={face} />
            </span>
          </div>
          <p className="relative mt-1 text-[16px] font-bold">{won ? `${agent.name} reached level ${won.level}!` : leveling ? `${agent.name} is levelling up…` : agent.name}</p>
          {won && perk && <p data-level-perk className="relative mt-0.5 text-[12.5px] text-white/80">Perk unlocked: <b className="text-white">{perk.title}</b> · {perk.body}</p>}
          <div className="relative mt-3 flex items-center gap-2">
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15"><span data-level-xp className="block h-full rounded-full bg-[linear-gradient(90deg,#ffd84d,#ffffff)] transition-[width] duration-[1200ms] ease-out" style={{ width: `${pct}%` }} /></span>
            <span className="text-[11.5px] font-semibold tabular-nums text-white/75">{max ? "max" : `${xp}/${need} XP`}</span>
          </div>
        </div>
        {!max && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-tint px-3 py-2"><div className="label text-[8.5px] text-ink/50">Cost to level {level + 1}</div><div data-train-cost className="mt-0.5 flex items-center gap-1 text-[16px] font-bold tabular-nums text-ink"><Coin size={15} />{cost} coins</div></div>
            <div className="rounded-[14px] bg-tint px-3 py-2"><div className="label text-[8.5px] text-ink/50">You have</div><div className="mt-0.5 flex items-center gap-1 text-[16px] font-bold tabular-nums text-ink"><Coin size={15} />{coins.toLocaleString("en-US")}</div></div>
          </div>
        )}
        <div className="mt-3">
          {max ? <button disabled className="btn btn-line btn-sm w-full text-ink">Max level</button>
            : locked ? <button data-train-upgrade onClick={() => { onClose(); openUpgrade("full"); }} className="btn btn-brand btn-sm w-full">Upgrade plan</button>
            : !minted ? <button onClick={() => { onClose(); openAgent(agent.id); }} className="btn btn-brand btn-sm w-full">Mint ID card to level up</button>
            : short ? <button data-train-short disabled className="btn btn-line btn-sm w-full text-ink/60">Not enough coins</button>
            : <button data-train-go onClick={up} disabled={!!busy} className="btn btn-brand btn-sm w-full disabled:opacity-60">{leveling ? "Levelling up…" : <><LevelUpMark size={15} />Level up · <Coin size={14} />{cost}</>}</button>}
          {!max && !locked && minted && short && <p className="mt-2 text-center text-[12.5px] text-ink/55">{cost - coins} more coins needed. <a href="#quests" onClick={onClose} className="font-bold text-brand-ink">Do a quest</a></p>}
          {locked && <p className="mt-2 text-center text-[12.5px] text-ink/55">{agent.name} is past your plan&apos;s seats.</p>}
        </div>
      </div>
    </div>
  );
}

/** Invite friends (phone): your code and link, copy and share buttons, how many joined, and the milestone rewards to claim. */
function InviteSection({ s }: { s: State }) {
  const h = hubOf(s);
  const code = inviteCode(s);
  const link = `${WEBAPP_URL}/signin?ref=${code}`;
  const msg = `I've got my own AI agent on Lexari. Join with my code ${code} and we both get coins.`;
  const busy = useHubBusy();
  const [copied, setCopied] = useState(false);
  const copy = (what: "code" | "link") => { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(what === "code" ? code : link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); toast({ text: what === "code" ? `Code ${code} copied` : "Invite link copied", face: "home" }); }, () => toast({ text: "Couldn't copy. Long-press the code instead.", face: "home" })); };
  const more = () => { if (navigator.share) navigator.share({ title: "Lexari", text: msg, url: link }).catch(() => {}); else copy("link"); };
  const friends = h.invited.length;
  const next = TIERS.find((t) => friends < t.friends);
  const claim = (i: number, el: HTMLElement) => void hub.claimTier(i).then((r) => {
    if (!r.ok) { toast({ text: r.error || "That reward is not ready.", face: "home" }); return; }
    flyCoins(el, r.coins); toast({ text: `${TIERS[i].title} · +${r.coins} coins`, face: "home" });
  });
  return (
    <section id="invite" data-invite-section className="scroll-mt-20 overflow-hidden rounded-[18px] bg-[#0a0a0a] p-3.5 text-white ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-grape"><Icon name="users" size={18} /></span>
        <div className="min-w-0 flex-1"><div className="text-[15px] font-bold">Invite friends</div><div className="text-[12px] leading-snug text-white/60">{friends} joined{next ? ` · ${next.friends - friends} more for +${next.reward}` : " · every milestone reached"}</div></div>
      </div>
      <div className="relative mt-3 flex items-center gap-2 rounded-[14px] bg-white p-2.5 pl-3.5 text-[#0a0a0a]">
        <button type="button" onClick={() => copy("code")} className="min-w-0 flex-1 text-left" aria-label={`Copy code ${code}`}><span className="label block text-[8px] text-black/50">Your code</span><span className="block truncate font-mono text-[18px] font-extrabold tracking-wider text-[#3514b0]">{code || "—"}</span><span className="block truncate font-mono text-[10.5px] text-black/45">{link.replace(/^https?:\/\//, "")}</span></button>
        <button type="button" data-invite-copy onClick={() => copy("link")} className={`${pill} !h-9 ${copied ? "bg-[#0a0a0a]" : "bg-grape"} text-white`}><Icon name={copied ? "check" : "copy"} size={14} />{copied ? "Copied" : "Copy link"}</button>
      </div>
      <div className="no-bar -mx-3.5 mt-2.5 flex gap-1.5 overflow-x-auto px-3.5">
        {SHARE.map((x) => <a key={x.id} href={x.href(msg, link)} target="_blank" rel="noreferrer" className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/10 pl-2.5 pr-3 text-[12.5px] font-bold ring-1 ring-white/15"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{x.glyph}</svg>{x.label}</a>)}
        <button type="button" onClick={more} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[12.5px] font-bold ring-1 ring-white/15"><Icon name="more" size={14} />More</button>
      </div>
      <ol data-invite-tiers className="mt-3 grid grid-cols-4 gap-1.5">
        {TIERS.map((t, i) => {
          const reached = friends >= t.friends; const got = h.tiers.includes(i);
          return (
            <li key={t.friends} className={`flex flex-col items-center rounded-[12px] px-1 py-2 text-center ${reached && !got ? "bg-grape/30 ring-1 ring-grape" : "bg-white/[.06]"}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-full ${got ? "bg-white text-grape" : reached ? "bg-grape text-white" : "bg-white/10 text-white/45"}`}>{got ? <Icon name="check" size={13} stroke={3} /> : <Icon name="box" size={13} />}</span>
              <span className="mt-1 text-[11px] font-bold leading-tight">{t.friends} {t.friends === 1 ? "friend" : "friends"}</span>
              <span className="flex items-center gap-0.5 text-[11px] font-extrabold tabular-nums text-white/80"><Coin size={10} />{t.reward.toLocaleString("en-US")}</span>
              {reached && !got ? <button type="button" onClick={(e) => claim(i, e.currentTarget)} disabled={!!busy} className="mt-1 h-6 rounded-full bg-white px-2.5 text-[11px] font-extrabold text-[#0a0a0a] disabled:opacity-60">{busy === `tier:${i}` ? "…" : "Claim"}</button>
                : <span className="mt-1 h-6 text-[10px] font-semibold leading-6 text-white/45">{got ? "Collected" : t.title.split(" ")[0]}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Achievements (phone): badges you collect, in a compact grid. */
function AchievementsRow({ s, now }: { s: State; now: number }) {
  const h = hubOf(s);
  const list = ACHIEVEMENTS.map((a) => ({ ...a, got: a.test(s, h, now) }));
  const n = list.filter((a) => a.got).length;
  return (
    <section id="achievements" data-achievements className={`${card} scroll-mt-20 p-3.5`}>
      <div className="flex items-center justify-between"><h2 className={h2}>Achievements</h2><span className="text-[12.5px] font-bold tabular-nums text-brand-ink">{n} of {list.length}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint"><div className="h-full rounded-full bg-grape" style={{ width: `${(n / list.length) * 100}%` }} /></div>
      <ul className="mt-3 grid grid-cols-4 gap-1.5">
        {list.map((a) => (
          <li key={a.id} className={`flex flex-col items-center rounded-[12px] px-1 py-2 text-center ${a.got ? "bg-tint" : "bg-tint/50"}`} title={a.body}>
            <span className={`relative grid h-9 w-9 place-items-center ${a.got ? "text-white" : "text-ink/30"}`}>
              <svg viewBox="0 0 56 56" width="36" height="36" className="absolute inset-0" aria-hidden><path d="M28 3 L50 15.5 V40.5 L28 53 L6 40.5 V15.5 Z" fill={a.got ? "#5b2bff" : "none"} stroke={a.got ? "#3514b0" : "currentColor"} strokeWidth="3" strokeDasharray={a.got ? undefined : "4 4"} strokeLinejoin="round" /></svg>
              <Icon name={a.icon} size={15} className="relative" />
            </span>
            <span className={`mt-1 text-[11px] font-bold leading-tight ${a.got ? "text-ink" : "text-ink/45"}`}>{a.title}</span>
          </li>
        ))}
      </ul>
    </section>
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
