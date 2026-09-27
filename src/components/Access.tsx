"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { copy } from "@/content/copy";
import SectionIntro from "./SectionIntro";

gsap.registerPlugin(ScrollTrigger);
const O = copy.access;

export default function Access() {
  const letter = useRef<HTMLDivElement>(null);
  const pen = useRef<SVGPathElement>(null);
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    const p = pen.current; if (!p) return;
    const len = p.getTotalLength();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setSigned(true); return; }
    gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    const t = gsap.to(p, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: letter.current, start: "top 70%", end: "bottom 75%", scrub: 0.5, onUpdate: (s) => setSigned(s.progress > 0.95) } });
    return () => { t.scrollTrigger?.kill(); t.kill(); };
  }, []);

  return (
    <section id="access" className="sheet scroll-mt-16 overflow-hidden bg-alt pb-28 pt-24 text-ink sm:pb-36 sm:pt-32">
      <div className="pointer-events-none absolute -left-40 bottom-0 h-[500px] w-[500px] rounded-full bg-[var(--glow)] blur-[140px]" />
      <div className="relative mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_.85fr] lg:items-center">
          <div>
            <SectionIntro label={O.label} title={O.title} body={O.body} tone="base" />
            <p className="reveal mt-6 flex w-fit gap-2 rounded-xl border-2 border-dashed border-brand-ink/70 px-4 py-3 text-[14px] font-semibold text-brand-ink">{O.placeholder}</p>
            <div className="reveal mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/signin" className="btn btn-brand">Sign in with Google</a>
              <a href="/signin" className="btn btn-line text-ink">Use a crypto wallet</a>
            </div>
          </div>

          {/* an offer letter that signs itself as you scroll */}
          <div ref={letter} className="reveal relative rounded-[28px] bg-card p-6 text-ink shadow-[0_14px_0_#5b2bff] ring-1 ring-line sm:p-8" style={{ transform: "rotate(1.5deg)" }}>
            <div className="flex items-center justify-between">
              <span className="display text-[34px] sm:text-[40px]">{O.letter.head}</span>
              <span className="label rounded-full bg-grape px-2.5 py-1 text-[9px] text-white">day one</span>
            </div>
            <dl className="mt-6 grid gap-3 border-y-2 border-dashed border-line py-5 text-[15px]">
              {O.letter.lines.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-ink/55">{k}</dt><dd className="text-right font-bold">{v}</dd></div>)}
            </dl>
            <div className="relative mt-4 h-[96px]">
              <svg viewBox="0 0 320 90" className="absolute inset-0 h-full w-full" aria-hidden>
                <path ref={pen} d="M10 62 C 30 20, 48 20, 44 58 S 70 76, 84 40 S 104 18, 110 52 C 114 70, 128 70, 138 46 C 146 28, 160 30, 158 52 C 156 70, 176 66, 186 44 C 194 28, 206 36, 204 54 C 204 66, 222 60, 236 42 C 250 26, 262 36, 258 52 L 300 40" fill="none" stroke="var(--brand-ink)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="absolute inset-x-0 bottom-0 border-t-2 border-ink/25" />
            </div>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className="text-ink/60">{O.letter.sign}</span>
              <span className={`rounded-full bg-grape px-3 py-1.5 font-bold text-white transition-all duration-500 ${signed ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>✓ {O.letter.signed}</span>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {O.chapters.map((c) => (
            <div key={c.n} className="reveal rounded-[26px] bg-card p-6 ring-1 ring-line">
              <span className="display text-[44px] text-brand-ink">{c.n}</span>
              <h3 className="display mt-3 text-[28px] text-ink">{c.head}</h3>
              <p className="mt-3 text-[15.5px] leading-relaxed text-ink/75">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
