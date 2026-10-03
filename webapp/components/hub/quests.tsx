"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { gsap } from "gsap";
import { toast, type State } from "@/lib/store";
import { countdown, hub, nextReset, questsView, type Period, type QuestView } from "@/lib/hub";
import Icon from "@/components/Icon";
import { burst } from "@/components/fly";
import { Coin, flyCoins } from "./coin";

const TABS: { id: Period; label: string; blurb: string }[] = [
  { id: "daily", label: "Daily", blurb: "Small things, every day." },
  { id: "weekly", label: "Weekly", blurb: "Bigger goals across the week." },
  { id: "hard", label: "Hard", blurb: "Long challenges. Big payouts, once each." },
];

export default function Quests({ s, now }: { s: State; now: number }) {
  const all = questsView(s, now);
  const [tab, setTab] = useState<Period>(() => (all.some((q) => q.period === "daily" && q.done && !q.claimed) ? "daily" : all.some((q) => q.period === "weekly" && q.done && !q.claimed) ? "weekly" : "daily"));
  const list = all.filter((q) => q.period === tab);
  const ready = (p: Period) => all.filter((q) => q.period === p && q.done && !q.claimed).length;
  const doneCount = list.filter((q) => q.claimed).length;
  const t = TABS.find((x) => x.id === tab)!;
  return (
    <section data-rise id="quests" className="scroll-mt-24 rounded-[30px] bg-card p-5 ring-1 ring-line sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-[10px] text-brand-ink">Quests</p>
          <h2 className="display mt-1 text-[40px] leading-none text-ink sm:text-[48px]">Earn coins.</h2>
        </div>
        <div role="tablist" aria-label="Quest type" className="flex gap-1 rounded-full bg-tint p-1">
          {TABS.map((x) => (
            <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={`relative flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold transition ${tab === x.id ? (x.id === "hard" ? "bg-[#0a0a0a] text-white" : "bg-card text-ink shadow-[0_1px_0_var(--line),0_0_0_1px_var(--line)]") : "text-ink/60 hover:text-ink"}`}>
              {x.id === "hard" && <Icon name="star" size={14} />}{x.label}
              {ready(x.id) > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-grape px-1 text-[11px] text-white">{ready(x.id)}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
        <span className="text-ink/65">{t.blurb} <b className="text-ink">{doneCount}/{list.length}</b> collected.</span>
        {tab !== "hard" && <span className="flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 font-semibold tabular-nums text-ink/75"><span className="h-1.5 w-1.5 rounded-full bg-grape live-dot" />Resets in {countdown(nextReset(tab, now) - now)}</span>}
      </div>
      <ul key={tab} className={`mt-4 grid gap-2.5 ${tab === "hard" ? "md:grid-cols-2" : ""}`}>
        {list.map((q, i) => <QuestRow key={q.id} q={q} i={i} hard={tab === "hard"} />)}
      </ul>
    </section>
  );
}

function QuestRow({ q, i, hard }: { q: QuestView; i: number; hard: boolean }) {
  const btn = useRef<HTMLButtonElement>(null);
  const row = useRef<HTMLLIElement>(null);
  const pct = Math.round((q.have / q.goal) * 100);
  const claim = () => {
    const r = hub.claimQuest(q.id);
    if (!r.ok) return;
    if (row.current) gsap.fromTo(row.current, { scale: 0.98 }, { scale: 1, duration: 0.5, ease: "back.out(3)" });
    flyCoins(btn.current, r.coins); burst(btn.current, hard ? 24 : 14);
    toast({ text: `${q.title} · +${r.coins} coins`, face: "home" });
  };
  const goEl = (label: string) => q.go?.startsWith("#")
    ? <a href={q.go} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-4 text-[13.5px] font-bold ring-1 ring-current/20 transition hover:bg-grape hover:text-white hover:ring-grape">{label}<Icon name="arrow" size={14} /></a>
    : <Link href={q.go!} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-4 text-[13.5px] font-bold ring-1 ring-current/20 transition hover:bg-grape hover:text-white hover:ring-grape">{label}<Icon name="arrow" size={14} /></Link>;
  return (
    <li ref={row} className={`pop flex items-center gap-3 rounded-[22px] p-3.5 sm:gap-3.5 sm:p-4 ${hard ? "bg-[#0a0a0a] text-white ring-1 ring-grape/50" : q.claimed ? "bg-tint/60 text-ink" : "bg-tint text-ink"}`} style={{ animationDelay: `${i * 45}ms` }}>
      <span className={`grid h-10 w-10 shrink-0 sm:h-12 sm:w-12 place-items-center rounded-2xl ${q.claimed ? "bg-grape/20 text-brand-ink" : q.done ? "bg-grape text-white" : hard ? "bg-white/10 text-lilac" : "bg-card text-brand-ink ring-1 ring-line"}`}><Icon name={q.claimed ? "check" : q.icon} size={22} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2"><span className={`text-[15px] font-bold leading-tight sm:text-[16px] ${q.claimed ? "opacity-60" : ""}`}>{q.title}</span>{hard && <span className="label rounded-full bg-grape px-1.5 py-0.5 text-[8.5px] text-white">Hard</span>}</span>
        <span className={`block text-[13px] leading-snug ${hard ? "text-white/60" : "text-ink/60"}`}>{q.hint}</span>
        <span className="mt-2 flex items-center gap-2.5">
          <span className={`h-2 flex-1 overflow-hidden rounded-full ${hard ? "bg-white/10" : "bg-card ring-1 ring-line"}`}><span className="block h-full rounded-full bg-grape transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} /></span>
          <span className={`text-[12px] font-bold tabular-nums ${hard ? "text-white/70" : "text-ink/60"}`}>{q.have}/{q.goal}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className={`flex items-center gap-1 text-[14px] font-extrabold tabular-nums ${q.claimed ? "opacity-50" : ""}`}><Coin size={18} />{q.reward}</span>
        {q.claimed ? <span className={`flex h-10 items-center gap-1 px-1 text-[13px] font-bold ${hard ? "text-lilac" : "text-brand-ink"}`}><Icon name="check" size={14} stroke={3} />Collected</span>
          : q.done ? <button ref={btn} type="button" onClick={claim} className="hub-claim h-10 rounded-full bg-grape px-5 text-[14px] font-extrabold text-white transition hover:-translate-y-0.5">Claim</button>
          : q.go ? goEl("Go") : <span className={`h-10 px-1 text-[12.5px] font-semibold leading-10 ${hard ? "text-white/50" : "text-ink/45"}`}>In progress</span>}
      </span>
    </li>
  );
}
