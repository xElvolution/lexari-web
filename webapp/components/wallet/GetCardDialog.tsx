"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { nameOf } from "../agents";
import CardVisual from "./CardVisual";
import { CARDS_LIVE, CARDS_SOON, CARD_LIMITS } from "./cards";

/** Get a card for one agent: preview, pick a monthly limit, then pay. Payment stays off until an issuer is connected. */
export default function GetCardDialog({ s, id, onClose }: { s: State; id: string; onClose: () => void }) {
  const [limit, setLimit] = useState(250);
  const box = useRef<HTMLDivElement>(null);
  const name = nameOf(s, id);
  useLayoutEffect(() => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(box.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="card-title" className="pb-safe-dlg max-h-[92svh] w-full max-w-[440px] overflow-y-auto rounded-t-[26px] bg-card p-4 ring-1 ring-line sm:rounded-[26px] sm:p-6">
        <div className="flex items-center gap-3">
          <AgentTile id={id} look={s.agent?.look} size={40} />
          <div className="min-w-0 flex-1"><h2 id="card-title" className="display truncate text-[24px] leading-none text-ink">A card for {name}</h2><p className="mt-1 text-[12.5px] text-ink/60">Virtual card · one per agent</p></div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button>
        </div>
        <CardVisual id={id} name={name} className="mx-auto mt-4" />
        <p className="mt-4 text-[14px] leading-snug text-ink/70">{name} can pay for tools, compute and subscriptions with its own card, up to the monthly limit you set. Every card is bought separately for each agent.</p>
        <div className="mt-3 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Monthly limit">
          {CARD_LIMITS.map((l) => <button key={l} role="radio" aria-checked={limit === l} onClick={() => setLimit(l)} className={`rounded-xl px-1 py-2 text-center ring-1 transition ${limit === l ? "bg-tint ring-2 ring-grape" : "ring-line hover:ring-grape/50"}`}><span className="label block text-[7.5px] text-ink/55">Limit / mo</span><span className="tab-num mt-0.5 block text-[15px] font-bold text-ink">${l}</span></button>)}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-tint px-3.5 py-2.5 text-[13.5px]"><span className="text-ink/70">Card price</span><span className="text-right font-semibold text-ink">Shown before you pay</span></div>
        {!CARDS_LIVE && <p className="mt-3 flex gap-2 rounded-2xl bg-tint p-3 text-[13px] leading-snug text-ink/75" role="status"><Icon name="info" size={16} className="mt-0.5 shrink-0 text-brand-ink" />{CARDS_SOON}</p>}
        <button disabled={!CARDS_LIVE} className="btn btn-brand btn-sm mt-4 w-full disabled:opacity-45 disabled:shadow-none">{CARDS_LIVE ? "Continue to payment" : "Cards open soon"}</button>
      </div>
    </div>
  );
}
