"use client";

import { specialistBySlug } from "@/content/appData";
import { PALETTE } from "@shared/components/avatar";
import type React from "react";
import type { Card } from "@/lib/pay";
import Icon from "../Icon";

/**
 * A payment card for one agent. Until a card is really issued this is a preview:
 * the number, expiry and CVV stay masked, so nothing made-up looks like a real card.
 */
export default function CardVisual({ id, name, className = "", card = null, onCopy }: { id: string; name: string; className?: string; card?: Card | null; onCopy?: (value: string, what: string) => void }) {
  // Masked unless the full details were fetched after your PIN or wallet confirm.
  const full = !!card?.number;
  const num = full ? card!.number.replace(/(.{4})/g, "$1 ").trim() : card ? `•••• •••• •••• ${card.last4}` : "•••• •••• •••• ••••";
  const exp = full ? `${String(card!.expMonth).padStart(2, "0")}/${String(card!.expYear).slice(-2)}` : "••/••";
  const tap = (v: string, what: string) => (full && onCopy ? { role: "button" as const, tabIndex: 0, "data-copy": what, onClick: (e: React.MouseEvent) => { e.stopPropagation(); onCopy(v, what); }, className: "cursor-copy rounded-md outline-none ring-white/60 transition hover:bg-white/10 focus-visible:ring-2" } : {});
  const sp = specialistBySlug(id);
  const accent = sp ? PALETTE[sp.color].fill : "#c9b8ff";
  const bg = id === "home" ? "linear-gradient(135deg,#6a3dff 0%,#5b2bff 45%,#2a0f9a 100%)" : `radial-gradient(120% 140% at 100% 0%, color-mix(in oklab, ${accent} 55%, transparent) 0%, transparent 55%), linear-gradient(135deg,#1a1726 0%,#0a0a0a 100%)`;
  return (
    <div className={`@container relative flex aspect-[1.586] w-full max-w-[360px] flex-col overflow-hidden rounded-[20px] p-[6%] text-white shadow-[0_24px_50px_-24px_rgba(91,43,255,.7)] ring-1 ring-white/10 ${className}`} style={{ background: bg }} aria-label={card ? `${card.test ? "Test devnet card" : "Card"} for ${name} ending ${card.last4}${card.frozen ? ", frozen" : ""}` : `Card preview for ${name}. No card has been issued.`}>
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-2 -top-24 h-56 w-56 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full border border-white/[.07]" />
      <div aria-hidden className="card-sheen pointer-events-none absolute inset-0" />
      <div className="relative flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-[2cqw]"><span className="grid h-[clamp(18px,6.5cqw,24px)] w-[clamp(18px,6.5cqw,24px)] shrink-0 place-items-center rounded-[7px] bg-white"><span className="h-[30%] w-[30%] rounded-full bg-[#0a0a0a]" /></span><span className="display text-[clamp(15px,5.6cqw,20px)] leading-none">lexari</span></div>
        <div className="flex shrink-0 items-center gap-[2cqw]"><span className={`label whitespace-nowrap rounded-full px-2 py-0.5 text-[clamp(6.5px,2.2cqw,8px)] ${card?.test ? "bg-[#ffd84d] text-[#0a0a0a]" : "bg-white/15"}`}>{card ? (card.test ? "Virtual · test" : card.frozen ? "Frozen" : "Virtual") : "Preview"}</span>
          <svg width="18" height="18" style={{ width: "clamp(14px,5cqw,18px)", height: "clamp(14px,5cqw,18px)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="rotate-90 opacity-80" aria-hidden><path d="M8.5 16.5a6 6 0 0 1 0-9M12 19a9.5 9.5 0 0 0 0-14M15.5 21.5a13 13 0 0 0 0-19" /></svg>
        </div>
      </div>
      <div className="mt-[5%] h-[16%] w-[14%] shrink-0 rounded-md bg-[linear-gradient(135deg,#f3f0ff,#b9a6ff)] opacity-90 [box-shadow:inset_0_0_0_1px_rgba(0,0,0,.15)]" aria-hidden>
        <div className="grid h-full grid-cols-3 grid-rows-3 gap-px p-[3px] opacity-40">{Array.from({ length: 9 }).map((_, i) => <i key={i} className="rounded-[1px] border border-black/40" />)}</div>
      </div>
      <div className="mt-[4%]"><span {...tap(card?.number || "", "card number")} className={`tab-num inline-block whitespace-nowrap font-mono text-[clamp(12px,6.4cqw,22px)] leading-tight tracking-[0.08em] text-white/85 ${full && onCopy ? "-mx-1 cursor-copy rounded-md px-1 hover:bg-white/10" : ""}`}>{num}</span></div>
      <div className="relative mt-auto flex items-end justify-between gap-[3cqw] whitespace-nowrap">
        <div className="min-w-0"><div className="label text-[clamp(6px,2cqw,7.5px)] text-white/60">Card holder</div><div {...tap(name, "name")} className={`truncate font-mono text-[clamp(10px,3.6cqw,13px)] font-semibold uppercase tracking-wider ${full && onCopy ? "cursor-copy rounded hover:bg-white/10" : ""}`}>{name}</div></div>
        <div className="shrink-0"><div className="label text-[clamp(6px,2cqw,7.5px)] text-white/60">Valid thru</div><div {...tap(exp, "expiry")} className={`font-mono text-[clamp(10px,3.6cqw,13px)] text-white/85 ${full && onCopy ? "cursor-copy rounded hover:bg-white/10" : ""}`}>{exp}</div></div>
        <div className="shrink-0"><div className="label text-[clamp(6px,2cqw,7.5px)] text-white/60">CVV</div><div {...tap(card?.cvv || "", "CVV")} className={`font-mono text-[clamp(10px,3.6cqw,13px)] text-white/85 ${full && onCopy ? "cursor-copy rounded hover:bg-white/10" : ""}`}>{full ? card!.cvv : "•••"}</div></div>
        <div className="flex shrink-0 flex-col items-end" aria-hidden>
          <span className="flex"><i className="h-[clamp(16px,6.5cqw,24px)] w-[clamp(16px,6.5cqw,24px)] rounded-full bg-white/90" /><i className="-ml-[2.6cqw] h-[clamp(16px,6.5cqw,24px)] w-[clamp(16px,6.5cqw,24px)] rounded-full bg-lilac/80 mix-blend-screen" /></span>
          <span className="label mt-0.5 text-[clamp(5.5px,1.8cqw,6.5px)] text-white/60">{card?.test ? "Devnet" : "Network"}</span>
        </div>
      </div>
      {card?.frozen && (
        <div className="absolute inset-0 grid place-items-center bg-white/20 backdrop-blur-[3px]">
          <span className="flex items-center gap-2 rounded-full bg-[#0a0a0a]/85 px-3.5 py-2 text-[13px] font-bold"><Icon name="pause" size={14} />Frozen</span>
        </div>
      )}
    </div>
  );
}
