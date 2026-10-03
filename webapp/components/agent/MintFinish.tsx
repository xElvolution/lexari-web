"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import type { Variant } from "@shared/components/avatar";
import type { State } from "@/lib/store";
import Icon from "../Icon";
import AgentIdCard from "./AgentIdCard";
import OnchainCard from "./OnchainCard";
import { idInfo } from "./AgentPanel";

/** Finish screen after making an agent: its ID card, a prominent "Mint on chain", and Later. */
export default function MintFinish({ s, id, v, title, sub, later, laterLabel = "Later", onMinted }: { s: State; id: string; v: Variant; title: string; sub: string; later: () => void; laterLabel?: string; onMinted?: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const info = idInfo(s, id);
  useLayoutEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-reveal]", { y: 22, opacity: 0, duration: 0.55, stagger: 0.09, ease: "power3.out", clearProps: "all" });
      gsap.from("[data-reveal-card]", { y: -40, rotate: -4, opacity: 0, duration: 0.8, ease: "back.out(1.5)", clearProps: "all" });
    }, root);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={root} data-finish className="grid gap-6 pb-4 sm:grid-cols-[auto_1fr] sm:items-start">
      <div data-reveal-card className="flex justify-center"><AgentIdCard info={info} /></div>
      <div className="space-y-4">
        <div data-reveal>
          <p className="label text-[10px] text-brand-ink">Done · desk {String(info.desk).padStart(2, "0")}</p>
          <h3 className="display mt-2 text-[34px] leading-none text-ink">{title}</h3>
          <p className="mt-2 text-[14.5px] leading-snug text-ink/70">{sub}</p>
        </div>
        <div data-reveal><OnchainCard s={s} id={id} name={info.name} role={info.role} v={v} bg={info.bg} cta="Mint on chain" prominent onMinted={onMinted} /></div>
        <div data-reveal className="flex gap-2">
          <button type="button" onClick={later} className="btn btn-line btn-sm flex-1 text-ink">{laterLabel}<Icon name="arrow" size={16} /></button>
        </div>
      </div>
    </div>
  );
}
