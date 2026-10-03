"use client";

import { useState } from "react";
import { copy, SIGNIN } from "@/content/copy";
import SectionIntro from "./SectionIntro";
import Face from "@shared/components/Face";

const S = copy.seats;
const START = [0, 1, 6, 37]; // sample: specialists already hired on each plan
const COLS = ["grid-cols-1", "grid-cols-5", "grid-cols-5 sm:grid-cols-10", "grid-cols-10 sm:grid-cols-20"];
// every desk keeps the same generated face across plans, so avatars never flicker
const seatSeed = (i: number) => i * 7 + 3;

export default function Seats() {
  const [plan, setPlan] = useState(1);
  const [hired, setHired] = useState(START);
  const P = S.plans[plan];
  const taken = 1 + hired[plan];
  const full = taken >= P.seats;
  const hire = () => !full && setHired((h) => h.map((v, i) => (i === plan ? v + 1 : v)));
  const big = P.seats <= 5;

  return (
    <section id="seats" className="sheet scroll-mt-16 bg-base pb-28 pt-24 sm:pb-36 sm:pt-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <SectionIntro label={S.label} title={S.title} body={S.body} why={S.why} />

        <div className="reveal mt-12 flex flex-wrap gap-2" role="tablist">
          {S.plans.map((p, i) => (
            <button key={p.name} role="tab" aria-selected={plan === i} onClick={() => setPlan(i)} className={`rounded-full px-5 py-3 text-[15px] font-bold transition-all ${plan === i ? "bg-grape text-white shadow-[0_5px_0_#3514b0]" : "bg-tint text-ink hover:bg-grape/20"}`}>
              {p.name} <span className="ml-1 opacity-60">{p.seats}</span>
            </button>
          ))}
        </div>

        <div className="reveal mt-6 grid gap-5 lg:grid-cols-[1.45fr_.55fr]">
          {/* the floor plan */}
          <div className="relative overflow-hidden rounded-[30px] bg-card p-4 ring-2 ring-tint sm:p-7">
            <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:28px_28px] opacity-70" />
            <div className="relative flex items-center justify-between">
              <span className="label text-ink/60">floor plan · {P.name}</span>
              <span className="label text-brand-ink">{taken} / {P.seats} desks</span>
            </div>
            <div key={plan} className={`relative mt-5 grid gap-1.5 sm:gap-2.5 ${COLS[plan]} ${plan === 0 ? "mx-auto max-w-[220px]" : ""}`}>
              {Array.from({ length: P.seats }).map((_, i) => {
                const state = i === 0 ? "home" : i < taken ? "hired" : "open";
                return (
                  <div key={i} className={`pop relative grid aspect-square place-items-center rounded-[22%] transition-colors ${state === "home" ? "bg-grape" : state === "hired" ? "bg-tint ring-2 ring-grape/45" : "border-2 border-dashed border-ink/20 bg-base/60"}`} style={{ animationDelay: `${Math.min(i, 40) * 12}ms` }}>
                    {state === "home" && <Face size={120} track={big} className="!h-[74%] !w-[74%]" />}
                    {state === "hired" && <Face seed={seatSeed(i)} size={80} className="!h-[74%] !w-[74%]" />}
                    {big && state === "open" && <span className="text-[22px] text-ink/25">+</span>}
                    {big && <span className={`label absolute leading-none ${plan === 0 ? "block" : "hidden sm:block"} ${state === "home" ? "text-white/80" : "text-ink/50"}`} style={{ right: "12%", bottom: "10%", fontSize: plan === 0 ? 12 : 9 }}>{String(i + 1).padStart(2, "0")}</span>}
                  </div>
                );
              })}
            </div>
            <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink/70">
              <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded bg-grape" />{S.legend.home}</span>
              <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded bg-tint ring-2 ring-grape/45" />{S.legend.hired}</span>
              <span className="flex items-center gap-2"><i className="h-3.5 w-3.5 rounded border-2 border-dashed border-ink/25" />{S.legend.open}</span>
              <button onClick={hire} disabled={full} className="btn btn-brand ml-auto !h-11 !px-5 !text-[14px] disabled:opacity-40">{full ? "Floor is full" : `+ ${S.hireButton}`}</button>
            </div>
            {full && <p className="relative mt-3 text-[13px] font-semibold text-brand-ink">{S.fullNote}</p>}
          </div>

          {/* plan details */}
          <div className="grain relative flex flex-col overflow-hidden rounded-[30px] bg-grape p-6 text-white sm:p-7">
            <span className="label text-white/75">{P.name} plan</span>
            <div className="mt-3 flex items-baseline gap-2"><span className="display text-[88px] leading-[0.8]">{P.seats}</span><span className="text-white/75">{P.seats === 1 ? "seat" : "seats"}</span></div>
            <p className="mt-5 text-[16px] leading-relaxed text-white/90">{P.for}</p>
            <ul className="mt-5 grid gap-2.5 text-[15px]">
              {P.points.map((pt) => <li key={pt} className="flex gap-2.5"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-white" />{pt}</li>)}
            </ul>
            <a href={SIGNIN} className="btn btn-white relative z-10 mt-8 lg:mt-auto">Start on {P.name}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
