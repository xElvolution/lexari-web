"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { copy } from "@/content/copy";
import SectionIntro from "./SectionIntro";

gsap.registerPlugin(ScrollTrigger);
const M = copy.memory;
const TAG: Record<string, string> = { Style: "#5b2bff", Tools: "#c9b8ff", Team: "var(--ink)", Habit: "#8f6bff" };
const TILT = [-3, 2, -1.5, 3, 1.5, -2.5, 2.5, -1];

export default function Memory() {
  const box = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = box.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { if (num.current) num.current.textContent = String(M.counter); return; }
    const ctx = gsap.context(() => {
      const r = el.getBoundingClientRect();
      const cards = gsap.utils.toArray<HTMLElement>("[data-card]");
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 80%", end: "center 50%", scrub: 0.8 } });
      cards.forEach((c, i) => {
        const cr = c.getBoundingClientRect();
        tl.from(c, { x: r.left + r.width / 2 - (cr.left + cr.width / 2), y: r.top + r.height / 2 - (cr.top + cr.height / 2), rotate: (i % 2 ? 1 : -1) * (6 + i * 2), ease: "power3.out", duration: 1 }, i * 0.12);
      });
      const o = { v: 0 };
      tl.to(o, { v: M.counter, duration: 1.8, ease: "none", onUpdate: () => { if (num.current) num.current.textContent = String(Math.round(o.v)); } }, 0);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section id="memory" className="sheet scroll-mt-16 overflow-hidden bg-alt pb-28 pt-24 sm:pb-40 sm:pt-32">
      <div className="pointer-events-none absolute right-[-10%] top-10 h-[480px] w-[480px] rounded-full bg-[var(--glow)] blur-[140px]" />
      <div className="relative mx-auto grid max-w-[1320px] gap-14 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <div>
          <SectionIntro label={M.label} title={M.title} body={M.body} tone="base" />
          <div className="reveal mt-10 flex items-end gap-4">
            <span ref={num} className="display text-[clamp(5rem,12vw,9rem)] tabular-nums text-brand-ink">0</span>
            <span className="pb-4 text-[15px] leading-snug text-ink/70">{M.counterLabel}</span>
          </div>
        </div>
        <div ref={box} className="grid grid-cols-2 gap-3 sm:gap-4">
          {M.cards.map((c, i) => (
            <div key={c.text} data-card className="relative rounded-2xl bg-card p-4 pt-5 text-ink shadow-[0_18px_30px_-18px_rgba(20,0,80,.45)] ring-1 ring-line sm:p-5 sm:pt-6" style={{ transform: `rotate(${TILT[i]}deg)` }}>
              <span className="absolute inset-x-0 top-0 h-2 rounded-t-2xl" style={{ background: TAG[c.tag] }} />
              <span className="absolute right-4 top-4 h-3 w-3 rounded-full bg-ink/15" />
              <span className="label text-[9.5px] text-ink/55">note {String(i + 1).padStart(3, "0")} · {c.tag}</span>
              <p className="display mt-2 text-[19px] leading-[1.02] text-ink sm:text-[25px]">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
