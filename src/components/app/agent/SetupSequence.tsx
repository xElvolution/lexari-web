"use client";

import { useEffect, useRef, useState } from "react";
import Face from "../../Face";
import BgArt from "../../BgArt";
import type { Variant } from "../../avatar";
import Icon from "../Icon";

const STEPS = ["Setting up its computer", "Giving it memory", "Loading its skills", "Ready"];
const AT = [0.08, 0.36, 0.64, 0.97]; // progress at which each step ticks

/**
 * The short "your agent is being made" sequence: its own face thinking inside a progress ring,
 * four steps ticking off, then a happy face and a hand-off to the finish screen. About 2.5s.
 */
export default function SetupSequence({ name, v, bg, onDone, ms = 2300, tone = "card" }: { name: string; v: Variant; bg?: string; onDone: () => void; ms?: number; tone?: "card" | "page" }) {
  const [p, setP] = useState(0);
  const [ready, setReady] = useState(false);
  const done = useRef(onDone); done.current = onDone;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduce ? 900 : ms;
    let raf = 0, hold: ReturnType<typeof setTimeout> | undefined; const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / total);
      setP(1 - Math.pow(1 - k, 2.2) * (1 - k * 0.15)); // eases out, never stalls
      if (k < 1) raf = requestAnimationFrame(tick);
      else { setP(1); setReady(true); hold = setTimeout(() => done.current(), reduce ? 250 : 750); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); if (hold) clearTimeout(hold); };
  }, [ms]);

  const R = 86, C = 2 * Math.PI * R;
  const ink = tone === "page" ? "text-ink" : "text-ink";
  return (
    <div data-setup data-ready={ready} role="status" aria-live="polite" aria-label={ready ? `${name} is ready` : `Setting up ${name}`} className={`grid place-items-center py-8 text-center ${ink}`}>
      <div className="relative grid h-[200px] w-[200px] place-items-center">
        <span className={`absolute inset-6 rounded-full bg-[var(--glow)] blur-2xl transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-60"}`} />
        <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-grape)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} />
        </svg>
        <span className={`relative grid h-[148px] w-[148px] place-items-center overflow-hidden rounded-full bg-[#0a0a0a] ring-1 ring-white/10 transition-transform duration-500 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] ${ready ? "scale-[1.04]" : ""}`}>
          <BgArt id={bg ?? "black"} />
          <span className="relative"><Face variant={{ ...v, plain: false }} size={118} state={ready ? "happy" : "thinking"} animated /></span>
        </span>
        {ready && <span className="ring-out pointer-events-none absolute inset-6 rounded-full border-2 border-grape" />}
      </div>
      <p className="display mt-5 text-[28px] leading-none sm:text-[32px]">{ready ? `${name} is ready.` : `Making ${name}…`}</p>
      <ul className="mt-5 w-full max-w-[290px] space-y-2 text-left">
        {STEPS.map((l, i) => {
          const on = p >= AT[i], cur = !on && (i === 0 || p >= AT[i - 1]);
          return (
            <li key={l} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-[14px] font-semibold transition-all duration-300 ${on ? "bg-tint text-ink" : cur ? "text-ink/80" : "text-ink/35"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition-all duration-300 ${on ? "bg-grape text-white" : "ring-2 ring-inset ring-line"}`}>
                {on ? <span className="pop grid place-items-center"><Icon name="check" size={13} stroke={3.2} /></span> : cur ? <span className="h-2 w-2 rounded-full bg-grape live-dot" /> : null}
              </span>
              {l}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 h-1 w-full max-w-[290px] overflow-hidden rounded-full bg-tint" aria-hidden><div className="h-full rounded-full bg-grape" style={{ width: `${p * 100}%` }} /></div>
    </div>
  );
}
