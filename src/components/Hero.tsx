"use client";

import { useState } from "react";
import { copy, APP } from "@/content/copy";
import Badge from "./Badge";

const H = copy.hero;

export default function Hero() {
  const [name, setName] = useState(H.badge.defaultName);
  return (
    <section id="top" className="grain relative overflow-hidden bg-grape pb-24 text-white sm:pb-32">
      <div className="carpet pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,#000,transparent_85%)]" />
      <div className="pointer-events-none absolute -left-40 top-1/3 h-[520px] w-[520px] rounded-full bg-[#7d52ff] blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-[380px] w-[380px] rounded-full bg-[#ff8a3d]/30 blur-[120px]" />

      <div className="relative mx-auto grid max-w-[1320px] px-5 [grid-template-areas:'head'_'badge'_'rest'] sm:px-8 lg:min-h-[100svh] lg:grid-cols-[1.2fr_.8fr] lg:grid-rows-[1fr_auto_auto_1fr] lg:gap-x-10 lg:[grid-template-areas:'._badge'_'head_badge'_'rest_badge'_'._badge']">
        {/* badge column first on mobile */}
        <div className="mt-4 flex justify-center [grid-area:badge] lg:mt-0">
          <div className="flex flex-col items-center">
            <Badge name={name} setName={setName} />
            <p className="label mt-5 text-center text-[10px] text-white/70">{H.badge.hint}</p>
          </div>
        </div>

        <div className="pt-24 [grid-area:head] lg:pt-28">
          <p className="flex w-fit items-center gap-2 rounded-full bg-plum/35 px-3.5 py-2 text-[13px] font-semibold text-white/90 ring-1 ring-white/20">
            <span className="h-2 w-2 rounded-full bg-candy shadow-[0_0_0_4px_rgba(255,168,234,.25)]" />{H.kicker}
          </p>
          <h1 className="display mt-6 text-[clamp(4.4rem,11.5vw,10.5rem)]">
            <span className="block">{H.title[0]}</span>
            <span className="block text-candy">{H.title[1]}</span>
          </h1>
        </div>
        <div className="[grid-area:rest] lg:pb-12">
          <p className="mt-7 max-w-[36rem] text-[17px] leading-[1.6] text-white/85 sm:text-[19px]">{H.body}</p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <a href={`${APP}/?name=${encodeURIComponent(name)}`} className="btn btn-candy">{H.primary} {name || "your agent"} <span aria-hidden>→</span></a>
            <a href="#desk" className="btn btn-line text-white">{H.secondary}</a>
          </div>
          <dl className="mt-12 grid max-w-[36rem] grid-cols-3 border-t-2 border-white/20 pt-5">
            {H.proof.map((p, i) => (
              <div key={p.k} className={`pr-3 ${i ? "border-l-2 border-white/20 pl-4" : ""}`}>
                <dt className="display text-[clamp(2rem,4vw,3rem)] text-white">{p.k}</dt>
                <dd className="mt-1 text-[13px] leading-snug text-white/70">{p.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
