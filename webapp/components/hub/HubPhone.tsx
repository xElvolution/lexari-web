"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { MASK, setHideBalance, useHideBalance } from "@/lib/privacy";
import { isCreated, isLocked, primaryOf, refreshHub, toast, type State } from "@/lib/store";
import {
  MAX_LEVEL, PERKS, STREAK_PAY, TIERS, checkedInToday, coinsOf, countdown, earnedSince, hub, hubOf, inviteCode, levelOf, nextReset,
  questsView, streakOf, useHubBusy, weekStart, xpFor, type Period, type QuestView,
} from "@/lib/hub";
import { WEBAPP_URL } from "@shared/sites";
import Icon from "@/components/Icon";
import { AgentTile, WhoFace } from "@/components/faces";
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
  const [train, setTrain] = useState(false);
  const hide = useHideBalance();
  if (!s.live) return <HubLoading />; // never a fake 0 while the onchain state loads
  return (
    <div id="top" className="space-y-3 pb-2">
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

      <CheckInRow s={s} now={now} />
      <div className="grid grid-cols-2 gap-3">
        <BoxCard s={s} now={now} />
        <LevelCard s={s} onTrain={() => setTrain(true)} />
      </div>
      <QuestList s={s} now={now} />
      {train && <TrainSheet s={s} onClose={() => setTrain(false)} />}
      <InviteRow s={s} />
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
    <section id="box" data-box-opened={opened ? "" : undefined} className="flex scroll-mt-20 flex-col rounded-[18px] bg-[#0a0a0a] p-3.5 text-white ring-1 ring-white/10">
      <span className={`text-[26px] leading-none ${opened ? "opacity-70" : "hub-wobble"}`} aria-hidden>🎁</span>
      <div className="mt-2 text-[15px] font-bold">Mystery box</div>
      <div className="text-[12px] leading-snug text-white/60">{opened ? `Opened today${won ? ` · won ${won}` : ""}` : "15 to 250 coins, once a day"}</div>
      <div className="mt-auto pt-3">
        {opened ? <span data-box-next className={`${pill} w-full bg-white/10 tabular-nums text-white/75`}>Next in {countdown(nextReset("daily", now) - now)}</span>
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
 * Level up pop-up: a hero card with the agent's face big in the middle. It floats while it waits, bounces and smiles
 * wider while the level-up signs and confirms, then pops with a burst when the new level lands. Cost, your coins and
 * one button (Level up / Not enough coins / Upgrade plan / Mint ID card) underneath.
 */
function TrainSheet({ s, onClose }: { s: State; onClose: () => void }) {
  // Only agents you made level up (hired specialists never do); your primary agent comes first.
  const primary = primaryOf(s);
  const team = myAgents(s).filter((a) => isCreated(s, a.id)).sort((a, b) => (a.id === primary ? -1 : b.id === primary ? 1 : 0));
  const [pick, setPick] = useState(primary);
  const [won, setWon] = useState<{ level: number; n: number } | null>(null);
  const agent = team.find((a) => a.id === pick) ?? team[0];
  const coins = coinsOf(s);
  const busy = useHubBusy();
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  useEffect(() => { setWon(null); }, [pick]);
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

function InviteRow({ s }: { s: State }) {
  const h = hubOf(s);
  const code = inviteCode(s);
  const link = `${WEBAPP_URL}/signin?ref=${code}`;
  const busy = useHubBusy();
  const copy = () => { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(() => toast({ text: "Invite link copied", face: "home" }), () => toast({ text: "Couldn't copy. Long-press the code instead.", face: "home" })); };
  const share = () => { if (navigator.share) navigator.share({ title: "Lexari", text: `Join me on Lexari with code ${code}.`, url: link }).catch(() => {}); else copy(); };
  const next = TIERS.findIndex((t) => h.invited.length < t.friends);
  const claimable = TIERS.map((t, i) => ({ t, i })).filter(({ t, i }) => h.invited.length >= t.friends && !h.tiers.includes(i));
  const claim = (i: number, el: HTMLElement) => void hub.claimTier(i).then((r) => {
    if (!r.ok) { toast({ text: r.error || "That reward is not ready.", face: "home" }); return; }
    flyCoins(el, r.coins); toast({ text: `${TIERS[i].title} · +${r.coins} coins`, face: "home" });
  });
  return (
    <section id="invite" className={`${card} scroll-mt-20 p-3.5`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-tint text-brand-ink"><Icon name="users" size={18} /></span>
        <div className="min-w-0 flex-1"><div className="text-[15px] font-bold text-ink">Invite friends</div><div className={meta}>{h.invited.length} joined{next >= 0 ? ` · ${TIERS[next].friends - h.invited.length} more for +${TIERS[next].reward}` : ""}</div></div>
        <button type="button" onClick={share} className={`${pill} bg-grape text-white`}><Icon name="arrow" size={13} />Share</button>
      </div>
      <button type="button" onClick={copy} className="mt-3 flex w-full items-center justify-between gap-2 rounded-[12px] bg-tint px-3 py-2 text-left">
        <span className="min-w-0"><span className="label block text-[8.5px] text-ink/55">Your code</span><span className="block font-mono text-[15px] font-bold tracking-wider text-brand-ink">{code || "—"}</span></span>
        <span className="text-[12.5px] font-bold text-brand-ink">Copy link</span>
      </button>
      {claimable.map(({ t, i }) => <button key={i} type="button" disabled={!!busy} onClick={(e) => claim(i, e.currentTarget)} className={`${pill} mt-2 w-full bg-grape text-white`}>Claim {t.title} · +{t.reward}</button>)}
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
