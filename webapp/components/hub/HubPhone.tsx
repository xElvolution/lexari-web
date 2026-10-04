"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MASK, setHideBalance, useHideBalance } from "@/lib/privacy";
import { hubReady, isCreated, primaryOf, refreshHub, setPrimary, toast, type State } from "@/lib/store";
import {
  MAX_LEVEL, STREAK_PAY, TIERS, checkedInToday, coinsOf, countdown, earnedSince, hub, hubOf, inviteCode, levelOf, nextReset,
  questsView, streakOf, useHubBusy, weekStart, xpFor, type Period, type QuestView,
} from "@/lib/hub";
import { WEBAPP_URL } from "@shared/sites";
import Icon from "@/components/Icon";
import { AgentTile } from "@/components/faces";
import { myAgents } from "@/components/agents";
import { burst } from "@/components/fly";
import { openAgent } from "@/components/overlays";
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
  if (!s.live && !hubReady()) return <HubLoading />;
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
          <span className="ml-auto text-right text-[12px] leading-tight text-white/75">+{week.toLocaleString("en-US")} this week<br />{h.lifetime.toLocaleString("en-US")} all time</span>
        </div>
        <div className="mt-3 flex gap-2 text-[12px] font-semibold">
          <span className="rounded-full bg-white/15 px-2.5 py-1">🔥 {streak}-day streak</span>
          <span className="rounded-full bg-white/15 px-2.5 py-1">{myAgents(s).length} on your team</span>
        </div>
      </section>

      <CheckInRow s={s} now={now} />
      <div className="grid grid-cols-2 gap-3">
        <BoxCard s={s} now={now} />
        <LevelCard s={s} onTrain={() => { setTrain(true); setTimeout(() => document.getElementById("level")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }} />
      </div>
      <QuestList s={s} now={now} />
      {train && <TrainList s={s} />}
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
    flyCoins(btn.current, r.coins); burst(btn.current, 14);
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
  const won = opened ? h.ledger.find((e) => e.reason === "Mystery box")?.delta ?? 0 : 0;
  const busy = useHubBusy();
  const [shake] = useState(false);
  const [modal, setModal] = useState<"" | "real" | "preview">("");
  const el = useRef<HTMLButtonElement>(null);
  const open = () => setModal("real");
  const run = async () => {
    if (modal === "preview") { const c = won || 60; return { ok: true, coins: c }; }
    const r = await hub.openBox(now || Date.now());
    if (r.ok) { flyCoins(el.current, r.coins); burst(el.current, 16); }
    return r;
  };
  return (
    <section id="box" className="flex scroll-mt-20 flex-col rounded-[18px] bg-[#0a0a0a] p-3.5 text-white ring-1 ring-white/10">
      <span className={`text-[26px] leading-none ${shake ? "hub-wobble-fast" : opened ? "" : "hub-wobble"}`} aria-hidden>🎁</span>
      <div className="mt-2 text-[15px] font-bold">Mystery box</div>
      <div className="text-[12px] leading-snug text-white/60">{opened ? `Won ${won || "?"} · next in ${countdown(nextReset("daily", now) - now)}` : "15 to 250 coins, once a day"}</div>
      <div className="mt-auto pt-3">
        {opened ? <button type="button" data-box-replay onClick={() => setModal("preview")} className={`${pill} w-full bg-white/10 text-white/80`}>Opened · replay</button>
          : <button ref={el} type="button" data-box-card-open onClick={open} disabled={!!busy} className={`${pill} w-full bg-white text-[#0a0a0a]`}>{busy === "box" ? "Opening…" : "Open"}</button>}
      </div>
      <BoxModal open={!!modal} preview={modal === "preview"} onOpen={run} onClose={() => setModal("")} />
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
    flyCoins(btn.current, r.coins); burst(btn.current, 12);
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

function TrainList({ s }: { s: State }) {
  // Only agents you made can level up, and only the primary one trains.
  const team = myAgents(s).filter((a) => isCreated(s, a.id));
  const primary = primaryOf(s);
  const coins = coinsOf(s);
  const busy = useHubBusy();
  const train = (id: string, name: string, amount: number, el: HTMLElement) => void hub.train(id, amount).then((r) => {
    if (!r.ok) { toast({ text: r.error || "Could not train.", face: "home" }); return; }
    burst(el, 12);
    toast({ text: r.levelsGained > 0 ? `${name} reached level ${r.level}!` : `${name} +${amount} XP`, face: "home" });
  });
  return (
    <section id="level" className={`${card} scroll-mt-20 p-3.5`}>
      <div className="flex items-center justify-between"><h2 className={h2}>Train your agents</h2><span className="flex items-center gap-1 text-[12.5px] font-bold text-ink/70"><Coin size={13} />{coins}</span></div>
      <p className={`${meta} mt-0.5`}>Coins become XP for your primary agent. Each level unlocks a perk. It needs its minted ID card to level up. Hired specialists don&apos;t level up.</p>
      <ul className="mt-1 divide-y divide-[var(--line)]">
        {team.map((a) => {
          const { level, xp } = levelOf(s, a.id);
          const need = level >= MAX_LEVEL ? 0 : xpFor(level);
          const pct = level >= MAX_LEVEL ? 100 : Math.round((xp / need) * 100);
          const amount = Math.min(25, coins);
          return (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <AgentTile id={a.id} look={a.id === "home" ? s.agent?.look : undefined} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><span className="truncate text-[14.5px] font-semibold text-ink">{a.name}</span><span className="text-[11.5px] font-bold text-brand-ink">Lv {level}</span></div>
                <div className="mt-1 flex items-center gap-2"><span className="h-1 flex-1 overflow-hidden rounded-full bg-tint"><span className="block h-full rounded-full bg-grape" style={{ width: `${pct}%` }} /></span><span className="text-[11px] tabular-nums text-ink/50">{level >= MAX_LEVEL ? "max" : `${xp}/${need}`}</span></div>
              </div>
              {a.id !== primary ? <button type="button" data-make-primary={a.id} onClick={() => { setPrimary(a.id); toast({ text: `${a.name} is now your primary agent`, face: "home" }); }} className={`${pill} bg-tint text-brand-ink`}>Make primary</button>
                : !(s.live?.levels.find((l) => l.slug === a.id)?.asset || s.meta[a.id]?.nft?.tokenId)
                ? <button type="button" onClick={() => openAgent(a.id)} className={`${pill} bg-tint text-brand-ink`}>Mint ID</button>
                : <button type="button" disabled={!!busy || level >= MAX_LEVEL || amount <= 0} onClick={(e) => train(a.id, a.name, amount, e.currentTarget)} className={`${pill} bg-grape text-white`}>{busy === "train" ? "…" : `+${amount || 25} XP`}</button>}
            </li>
          );
        })}
      </ul>
    </section>
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
    flyCoins(el, r.coins); burst(el, 14); toast({ text: `${TIERS[i].title} · +${r.coins} coins`, face: "home" });
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
function HubLoading() {
  useEffect(() => { void refreshHub(); }, []);
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
