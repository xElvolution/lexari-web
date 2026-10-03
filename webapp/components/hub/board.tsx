"use client";

import Face from "@shared/components/Face";
import type { ColorKey } from "@shared/components/avatar";
import type { State } from "@/lib/store";
import { ACHIEVEMENTS, countdown, earnedSince, hubOf, nextReset, weekStart } from "@/lib/hub";
import { AgentFace } from "@/components/faces";
import Icon from "@/components/Icon";
import { DemoTag } from "@/components/ui";
import { Coin } from "./coin";

const RIVALS: { name: string; seed: number; color: ColorKey; base: number }[] = [
  { name: "nova.sol", seed: 31, color: "pink", base: 940 }, { name: "kemi", seed: 44, color: "teal", base: 720 },
  { name: "atlas", seed: 8, color: "orange", base: 560 }, { name: "yuki_builds", seed: 62, color: "sky", base: 430 },
  { name: "dayo", seed: 19, color: "green", base: 310 }, { name: "mx", seed: 75, color: "yellow", base: 205 },
  { name: "pilar", seed: 90, color: "red", base: 120 },
];
const ROW = 58;

/** This week's top earners. Your row slides into place as you earn. */
export function Leaderboard({ s, now }: { s: State; now: number }) {
  const wk = weekStart(now);
  const day = Math.max(1, Math.ceil((now - wk) / 864e5));
  const you = earnedSince(s, wk);
  const youRow = { id: "you", name: s.agent?.you ? `${s.agent.you} (you)` : "You", coins: you, face: <AgentFace look={s.agent?.look} size={32} />, me: true };
  const rows = s.prefs.demoLabels === false
    ? [youRow]
    : [
      ...RIVALS.map((r, i) => ({ id: r.name, name: r.name, coins: Math.round((r.base * day) / 7 + ((wk / 864e5 + i * 7) % 13) * 3), face: <Face seed={r.seed} variant={{ color: r.color }} size={32} />, me: false })),
      youRow,
    ].sort((a, b) => b.coins - a.coins);
  const rank = rows.findIndex((r) => r.me) + 1;
  return (
    <section data-rise className="rounded-[30px] bg-card p-5 ring-1 ring-line sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label flex items-center gap-2 text-[10px] text-brand-ink">Leaderboard {s.prefs.demoLabels !== false && <DemoTag />}</p>
          <h2 className="display mt-1 text-[36px] leading-none text-ink sm:text-[42px]">You&apos;re #{rank}.</h2>
          <p className="mt-2 text-[13.5px] text-ink/60">Coins earned this week. New week in {countdown(nextReset("weekly", now) - now)}.</p>
        </div>
      </div>
      <ol className="relative mt-4" style={{ height: rows.length * ROW }}>
        {rows.map((r, i) => (
          <li key={r.id} className={`absolute inset-x-0 flex h-[52px] items-center gap-3 rounded-2xl px-3 transition-[top,background-color] duration-700 [transition-timing-function:cubic-bezier(.3,1.3,.5,1)] ${r.me ? "bg-grape text-white shadow-[0_6px_0_#3514b0]" : i < 3 ? "bg-tint text-ink" : "text-ink"}`} style={{ top: i * ROW }}>
            <span className={`display w-7 shrink-0 text-center text-[22px] leading-none ${r.me ? "text-white" : i < 3 ? "text-brand-ink" : "text-ink/40"}`}>{i + 1}</span>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${r.me ? "bg-white/15" : "bg-[var(--face-tile)] ring-1 ring-line"}`}>{r.face}</span>
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{r.name}</span>
            {i === 0 && <Icon name="star" size={16} className={r.me ? "text-white" : "text-brand-ink"} />}
            <span className="flex shrink-0 items-center gap-1 text-[14px] font-extrabold tabular-nums"><Coin size={16} />{r.coins.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Badges you collect along the way. */
export function Achievements({ s, now }: { s: State; now: number }) {
  const h = hubOf(s);
  const list = ACHIEVEMENTS.map((a) => ({ ...a, got: a.test(s, h, now) }));
  const n = list.filter((a) => a.got).length;
  return (
    <section data-rise className="rounded-[30px] bg-card p-5 ring-1 ring-line sm:p-7">
      <p className="label text-[10px] text-brand-ink">Achievements</p>
      <h2 className="display mt-1 text-[36px] leading-none text-ink sm:text-[42px]">{n} of {list.length}</h2>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-tint"><div className="h-full rounded-full bg-grape transition-[width] duration-700" style={{ width: `${(n / list.length) * 100}%` }} /></div>
      <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {list.map((a) => (
          <li key={a.id} className={`relative flex flex-col items-center rounded-[20px] p-3 text-center ${a.got ? "bg-tint" : "bg-tint/50"}`} title={a.body}>
            <span className={`relative grid h-14 w-14 place-items-center ${a.got ? "text-white" : "text-ink/30"}`}>
              <svg viewBox="0 0 56 56" width="56" height="56" className="absolute inset-0" aria-hidden><path d="M28 3 L50 15.5 V40.5 L28 53 L6 40.5 V15.5 Z" fill={a.got ? "#5b2bff" : "none"} stroke={a.got ? "#3514b0" : "currentColor"} strokeWidth="2.5" strokeDasharray={a.got ? undefined : "4 4"} strokeLinejoin="round" /></svg>
              <Icon name={a.icon} size={22} className="relative" />
              {a.got && <span className="hub-shine absolute inset-1 rounded-full" aria-hidden />}
            </span>
            <span className={`mt-2 text-[13px] font-bold leading-tight ${a.got ? "text-ink" : "text-ink/45"}`}>{a.title}</span>
            <span className="mt-0.5 text-[11.5px] leading-tight text-ink/50">{a.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
