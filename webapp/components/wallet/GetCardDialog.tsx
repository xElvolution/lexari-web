"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { State } from "@/lib/store";
import { celebrate } from "../Celebrate";
import { payForCard, type Card } from "@/lib/pay";
import { cardPriceLabel } from "@/lib/prices";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { nameOf } from "../agents";
import CardVisual from "./CardVisual";
import { CARD_LIMITS, CARD_TEST_NOTE } from "./cards";
import { putCard } from "./useCards";

/** Get a card for one agent: preview, pick a monthly limit, pay the devnet price, and the card is issued. */
export default function GetCardDialog({ s, id, onClose }: { s: State; id: string; onClose: () => void }) {
  const [limit, setLimit] = useState(250);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [tx, setTx] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const name = nameOf(s, id);
  useLayoutEffect(() => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(box.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose, busy]);
  const buy = async () => {
    setBusy(true); setErr("");
    const r = await payForCard(id, limit, name);
    setBusy(false);
    if (!r.ok) { if (!r.cancelled) setErr(r.error); return; }
    putCard(r.card); setCard(r.card); setTx(r.tx);
    celebrate({ title: `${name}'s card is ready`, body: `Test card ending ${r.card.last4}, $${r.card.limit} a month.`, tx: r.tx, art: <div className="w-[300px] max-w-full"><CardVisual id={id} name={name} card={r.card} /></div> });
    onClose(); // the pop-up takes over; the card is waiting in Cards
  };
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="card-title" className="pb-safe-dlg max-h-[92svh] w-full max-w-[440px] overflow-y-auto rounded-t-[26px] bg-card p-4 ring-1 ring-line sm:rounded-[26px] sm:p-6">
        <div className="flex items-center gap-3">
          <AgentTile id={id} look={s.agent?.look} size={40} />
          <div className="min-w-0 flex-1"><h2 id="card-title" className="display truncate text-[24px] leading-none text-ink">{card ? "Card issued" : `A card for ${name}`}</h2><p className="mt-1 text-[12.5px] text-ink/60">Virtual card · one per agent · devnet test</p></div>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button>
        </div>
        <CardVisual id={id} name={name} card={card} className="mx-auto mt-4" />
        {card ? (
          <>
            <p className="mt-4 text-[14px] leading-snug text-ink/70">{name}&apos;s card is ready with a ${card.limit} monthly limit. You can freeze it or change the limit from Cards.</p>
            <a href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-tint px-3.5 py-2.5 text-[13px]"><span className="text-ink/70">Payment</span><span className="truncate font-mono text-brand-ink">{tx.slice(0, 10)}…</span></a>
            <button onClick={onClose} className="btn btn-brand btn-sm mt-4 w-full">Done</button>
          </>
        ) : (
          <>
            <p className="mt-4 text-[14px] leading-snug text-ink/70">{name} can pay for tools, compute and subscriptions with its own card, up to the monthly limit you set.</p>
            <div className="mt-3 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Monthly spending limit">
              {CARD_LIMITS.map((l) => <button key={l} role="radio" aria-checked={limit === l} onClick={() => setLimit(l)} className={`rounded-xl px-1 py-2 text-center ring-1 transition ${limit === l ? "bg-tint ring-2 ring-grape" : "ring-line hover:ring-grape/50"}`}><span className="tab-num block text-[15px] font-bold text-ink">${l}</span><span className="block text-[11px] text-ink/55">a month</span></button>)}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-tint px-3.5 py-2.5 text-[13.5px]"><span className="text-ink/70">Card price</span><span className="text-right font-semibold text-ink">{cardPriceLabel()} · devnet</span></div>
            <p className="mt-3 flex gap-2 rounded-2xl bg-tint p-3 text-[12.5px] leading-snug text-ink/75"><Icon name="info" size={15} className="mt-0.5 shrink-0 text-brand-ink" />{CARD_TEST_NOTE}</p>
            {err && <p role="alert" className="mt-3 text-[13px] text-[#e5484d]">{err}</p>}
            <button onClick={buy} disabled={busy} className="btn btn-brand btn-sm mt-4 w-full disabled:opacity-60">{busy ? "Finish the payment…" : `Get the card · ${cardPriceLabel()}`}</button>
          </>
        )}
      </div>
    </div>
  );
}
