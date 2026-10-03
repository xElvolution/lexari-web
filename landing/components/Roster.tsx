"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { copy, APP } from "@/content/copy";
import SectionIntro from "./SectionIntro";
import Face from "@shared/components/Face";
import type { ColorKey } from "@shared/components/avatar";

gsap.registerPlugin(ScrollTrigger);
const R = copy.roster;
// one distinct color per card so the roster reads as a varied team
const ROSTER_COLORS: ColorKey[] = ["orange", "blue", "green", "yellow", "red", "teal", "pink", "sky"];
type Agent = (typeof R.agents)[number];

function Card({ a, i }: { a: Agent; i: number }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" onClick={() => setFlipped((v) => !v)} className={`flip h-[430px] w-[282px] shrink-0 snap-center text-left sm:w-[310px] ${flipped ? "is-flipped" : ""}`} aria-label={`${a.name}, ${a.job}. Tap to read more.`}>
      <div className="flip-inner">
        <div className="flip-face flex flex-col overflow-hidden rounded-[28px] bg-card text-ink shadow-[0_10px_0_#3514b0]">
          <div className="carpet relative grid h-[190px] place-items-center bg-tint">
            <Face seed={i * 11 + 5} variant={{ color: ROSTER_COLORS[i % ROSTER_COLORS.length] }} size={150} />
            <span className="display absolute left-4 top-3 text-[26px] text-ink/30">#{String(i + 1).padStart(2, "0")}</span>
            <span className="label absolute right-4 top-4 rounded-full bg-ink px-2 py-1 text-[9px] text-base">★ {a.rating}</span>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <div className="display text-[46px] text-ink">{a.name}</div>
            <div className="mt-1 text-[16px] font-semibold text-brand-ink">{a.job}</div>
            <p className="relative mt-4 rounded-2xl rounded-tl-sm border border-line bg-alt px-3.5 py-2.5 text-[14.5px] font-semibold leading-snug text-ink">&ldquo;{a.quip}&rdquo;</p>
            <div className="mt-auto flex items-center justify-between border-t-2 border-dashed border-line pt-4">
              <span className="text-[13px] text-ink/65"><b className="text-ink">{a.jobs.toLocaleString("en-US")}</b> jobs done</span>
              <span className="label rounded-full bg-grape px-2.5 py-1.5 text-[9px] text-white">flip ↻</span>
            </div>
          </div>
        </div>
        <div className="flip-face flip-back flex flex-col rounded-[28px] bg-[#0a0a0a] p-6 text-white shadow-[0_10px_0_#3514b0] ring-1 ring-white/10">
          <span className="label text-[10px] text-lilac">what {a.name} does</span>
          <p className="display mt-4 text-[27px] leading-[1.05]">{a.back}</p>
          <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-white/15 pt-4 text-[13px]">
            <div><dt className="text-white/55">Rating</dt><dd className="display text-[26px]">{a.rating}</dd></div>
            <div><dt className="text-white/55">Jobs</dt><dd className="display text-[26px]">{a.jobs.toLocaleString("en-US")}</dd></div>
          </dl>
          <span className="btn btn-brand mt-4 !h-12 !text-[15px]">Hire into a seat</span>
        </div>
      </div>
    </button>
  );
}

export default function Roster() {
  const wrap = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const r = rail.current!, w = wrap.current!;
      const dist = () => r.scrollWidth - w.clientWidth + 64;
      gsap.to(r, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: w, start: "center center", end: () => `+=${dist()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true } });
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="roster" className="sheet grain scroll-mt-16 overflow-hidden bg-grape pb-28 pt-24 text-white sm:pb-36 sm:pt-32">
      <div className="relative mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionIntro label={R.label} title={R.title} body={R.body} why={R.why} tone="grape" />
          <a href={`${APP}/marketplace`} className="reveal btn btn-white shrink-0 self-start lg:self-end">{R.cta} →</a>
        </div>
      </div>
      <div ref={wrap} className="relative mt-14 py-6">
        <div ref={rail} className="no-bar flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:px-8 lg:w-max lg:overflow-visible lg:px-[max(2rem,calc((100vw-1320px)/2+2rem))]">
          {R.agents.map((a, i) => <Card key={a.name} a={a} i={i} />)}
        </div>
        <div className="relative mx-auto mt-6 flex max-w-[1320px] flex-col gap-1 px-5 text-[13px] text-white/70 sm:flex-row sm:justify-between sm:px-8">
          <span>{R.hint}</span>{R.note && <span>{R.note}</span>}
        </div>
      </div>
    </section>
  );
}
