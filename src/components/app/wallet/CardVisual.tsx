"use client";

import { specialistBySlug } from "@/content/appData";
import { PALETTE } from "@/components/avatar";
import type { Card } from "@/lib/store";
import Icon from "../Icon";

const group4 = (n: string) => n.replace(/(\d{4})(?=\d)/g, "$1 ");

/** A virtual card. Number and CVV stay masked unless revealed. Demo numbers only. */
export default function CardVisual({ id, name, card, reveal, className = "" }: { id: string; name: string; card: Card; reveal: boolean; className?: string }) {
  const sp = specialistBySlug(id);
  const accent = sp ? PALETTE[sp.color].fill : "#c9b8ff";
  const bg = id === "home" ? "linear-gradient(135deg,#6a3dff 0%,#5b2bff 45%,#2a0f9a 100%)" : `radial-gradient(120% 140% at 100% 0%, color-mix(in oklab, ${accent} 55%, transparent) 0%, transparent 55%), linear-gradient(135deg,#1a1726 0%,#0a0a0a 100%)`;
  return (
    <div className={`@container relative flex aspect-[1.586] w-full max-w-[380px] flex-col overflow-hidden rounded-[22px] p-5 text-white shadow-[0_24px_50px_-24px_rgba(91,43,255,.7)] ring-1 ring-white/10 ${className}`} style={{ background: bg }}>
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-2 -top-24 h-56 w-56 rounded-full border border-white/10" />
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-[7px] bg-white"><span className="h-2 w-2 rounded-full bg-[#0a0a0a]" /></span><span className="display text-[20px] leading-none">lexari</span></div>
        <div className="flex items-center gap-2"><span className="label rounded-full bg-white/15 px-2 py-0.5 text-[8px]">Virtual · demo</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="rotate-90 opacity-80" aria-hidden><path d="M8.5 16.5a6 6 0 0 1 0-9M12 19a9.5 9.5 0 0 0 0-14M15.5 21.5a13 13 0 0 0 0-19" /></svg>
        </div>
      </div>
      <div className="mt-[5%] h-[16%] w-[14%] shrink-0 rounded-md bg-[linear-gradient(135deg,#f3f0ff,#b9a6ff)] opacity-90 [box-shadow:inset_0_0_0_1px_rgba(0,0,0,.15)]" aria-hidden>
        <div className="grid h-full grid-cols-3 grid-rows-3 gap-px p-[3px] opacity-40">{Array.from({ length: 9 }).map((_, i) => <i key={i} className="rounded-[1px] border border-black/40" />)}</div>
      </div>
      <div className="tab-num mt-[4%] whitespace-nowrap font-mono text-[clamp(12px,5.6cqw,21px)] leading-tight tracking-[0.08em]" aria-label={reveal ? `Card number ${group4(card.number)}` : `Card ending ${card.number.slice(-4)}`}>
        {reveal ? group4(card.number) : `•••• •••• •••• ${card.number.slice(-4)}`}
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="label text-[7.5px] text-white/60">Card holder</div>
          <div className="truncate font-mono text-[13px] font-semibold uppercase tracking-wider">{name}</div>
        </div>
        <div className="shrink-0"><div className="label text-[7.5px] text-white/60">Valid thru</div><div className="font-mono text-[13px]">{card.exp}</div></div>
        <div className="shrink-0"><div className="label text-[7.5px] text-white/60">CVV</div><div className="font-mono text-[13px]">{reveal ? card.cvv : "•••"}</div></div>
        <div className="flex shrink-0 flex-col items-end" aria-label="Card network (placeholder)">
          <span className="flex"><i className="h-6 w-6 rounded-full bg-white/90" /><i className="-ml-2.5 h-6 w-6 rounded-full bg-lilac/80 mix-blend-screen" /></span>
          <span className="label mt-0.5 text-[6.5px] text-white/60">Network</span>
        </div>
      </div>
      {card.frozen && (
        <div className="absolute inset-0 grid place-items-center bg-white/25 backdrop-blur-[3px]">
          <span className="flex items-center gap-2 rounded-full bg-[#0a0a0a]/85 px-3.5 py-2 text-[13px] font-bold"><Icon name="pause" size={14} />Frozen</span>
        </div>
      )}
    </div>
  );
}
