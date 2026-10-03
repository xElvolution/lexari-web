"use client";

import type { State } from "@/lib/store";
import { ACHIEVEMENTS, countdown, earnedSince, hubOf, nextReset, weekStart } from "@/lib/hub";
import { AgentFace } from "@/components/faces";
import Icon from "@/components/Icon";
import { Coin } from "./coin";

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
