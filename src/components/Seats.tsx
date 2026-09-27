"use client";

import { useState } from "react";
import { copy, APP } from "@/content/copy";
import SectionIntro from "./SectionIntro";
import Face from "./Face";

const S = copy.seats;
const START = [0, 1, 6, 37]; // sample: specialists already hired on each plan
const COLS = ["grid-cols-1", "grid-cols-5", "grid-cols-5 sm:grid-cols-10", "grid-cols-10 sm:grid-cols-20"];

export default function Seats() {
  const [plan, setPlan] = useState(1);
  const [hired, setHired] = useState(START);
  const P = S.plans[plan];
  const taken = 1 + hired[plan];
  const full = taken >= P.seats;
  const hire = () => !full && setHired((h) => h.map((v, i) => (i === plan ? v + 1 : v)));
  const big = P.seats <= 5;

  return (
    <section id="seats" className="sheet scroll-mt-16 bg-frost pb-28 pt-24 sm:pb-36 sm:pt-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <SectionIntro label={S.label} title={S.title} body={S.body} why={S.why} />

        <div className="reveal mt-12 flex flex-wrap gap-2" role="tablist">
          {S.plans.map((p, i) => (
            <button key={p.name} role="tab" aria-selected={plan === i} onClick={() => setPlan(i)} className={`rounded-full px-5 py-3 text-[15px] font-bold transition-all ${plan === i ? "bg-plum text-candy shadow-[0_5px_0_#5b2bff]" : "bg-frost-2 text-plum hover:bg-orchid/60"}`}>
              {p.name} <span className="ml-1 opacity-60">{p.seats}</span>
            </button>
          ))}
        </div>

        <div className="reveal mt-6 grid gap-5 lg:grid-cols-[1.45fr_.55fr]">
          {/* the floor plan */}
          <div className="relative overflow-hidden rounded-[30px] bg-white p-4 shadow-[0_2px_0_#d8ccff] ring-2 ring-frost-2 sm:p-7">
            <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(#ece6ff_1px,transparent_1px),linear-gradient(90deg,#ece6ff_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="relative flex items-center justify-between">
              <span className="label text-plum/60">floor plan · {P.name}</span>
              <span className="label text-grape">{taken} / {P.seats} desks</span>
            </div>
            <div key={plan} className={`relative mt-5 grid gap-1.5 sm:gap-2.5 ${COLS[plan]} ${plan === 0 ? "mx-auto max-w-[220px]" : ""}`}>
              {Array.from({ length: P.seats }).map((_, i) => {
                const state = i === 0 ? "home" : i < taken ? "hired" : "open";
                return (
                  <div key={i} className={`pop relative grid aspect-square place-items-center rounded-[22%] transition-colors ${state === "home" ? "bg-grape" : state === "hired" ? "bg-candy" : "border-2 border-dashed border-plum/20 bg-white/70"}`} style={{ animationDelay: `${Math.min(i, 40) * 12}ms` }}>
                    {big && state !== "open" && <Face size={plan === 0 ? 120 : 56} hue={state === "home" ? 300 : 262} track={state === "home"} className={plan === 0 ? "" : "!h-[58%] !w-[58%]"} />}
                    {big && state === "open" && <span className="text-[22px] text-plum/25">+</span>}
                    {big && <span className={`label absolute bottom-1.5 hidden text-[8px] sm:block ${state === "home" ? "text-white/80" : "text-plum/50"}`}>{String(i + 1).padStart(2, "0")}</span>}
                  </div>
                );
              })}
            </div>
            <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-plum/70">
              <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded bg-grape" />{S.legend.home}</span>
              <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded bg-candy" />{S.legend.hired}</span>
              <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded border-2 border-dashed border-plum/25" />{S.legend.open}</span>
              <button onClick={hire} disabled={full} className="btn btn-grape ml-auto !h-11 !px-5 !text-[14px] disabled:opacity-40">{full ? "Floor is full" : `+ ${S.hireButton}`}</button>
            </div>
            {full && <p className="relative mt-3 text-[13px] font-semibold text-flare">{S.fullNote}</p>}
          </div>

          {/* plan details */}
          <div className="flex flex-col rounded-[30px] bg-plum p-6 text-white sm:p-7">
            <span className="label text-candy">{P.name} plan</span>
            <div className="mt-3 flex items-baseline gap-2"><span className="display text-[88px] leading-[0.8]">{P.seats}</span><span className="text-white/65">{P.seats === 1 ? "seat" : "seats"}</span></div>
            <p className="mt-5 text-[16px] leading-relaxed text-white/85">{P.for}</p>
            <ul className="mt-5 grid gap-2.5 text-[15px]">
              {P.points.map((pt) => <li key={pt} className="flex gap-2.5"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-candy" />{pt}</li>)}
            </ul>
            <a href={APP} className="btn btn-candy mt-8 lg:mt-auto">Start on {P.name}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
