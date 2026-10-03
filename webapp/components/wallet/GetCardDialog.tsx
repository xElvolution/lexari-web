"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { CARD_FEE, CARD_LIMITS } from "@/content/appData";
import { issueCard, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { nameOf } from "../agents";
import CardVisual from "./CardVisual";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Get a card: pick a limit, confirm the (demo) fee, then the card is issued. Nothing is charged. */
export default function GetCardDialog({ s, id, onClose }: { s: State; id: string; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [limit, setLimit] = useState(250);
  const [agree, setAgree] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const name = nameOf(s, id);
  useLayoutEffect(() => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(card.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && step !== 3) onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose, step]);
  const confirm = () => { setStep(3); setTimeout(() => { issueCard(id, limit); setStep(4); }, 1600); };
  const issued = s.cards[id];
  const row = "flex items-center justify-between gap-3 py-2.5 text-[14.5px]";

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget && step !== 3) onClose(); }}>
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby="card-title" className="pb-safe-dlg w-full max-w-[460px] rounded-t-[28px] bg-card p-5 ring-1 ring-line sm:rounded-[28px] sm:p-6">
        <div className="flex items-center gap-3">
          <AgentTile id={id} look={s.agent?.look} size={40} />
          <div className="min-w-0 flex-1"><h2 id="card-title" className="display text-[28px] leading-none text-ink">{step === 4 ? "Card ready." : `A card for ${name}`}</h2><p className="mt-1 text-[13px] text-ink/60">{["", "Step 1 of 2 · Spending limit", "Step 2 of 2 · Confirm", "Issuing…", "Virtual card · demo"][step]}</p></div>
          {step !== 3 && <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button>}
        </div>

        {step === 1 && (
          <>
            <p className="mt-5 text-[14.5px] text-ink/70">{name} can pay for tools, compute and subscriptions with this card, up to the monthly limit you set. You can freeze or cancel it any time.</p>
            <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Monthly limit">
              {CARD_LIMITS.map((l) => <button key={l} role="radio" aria-checked={limit === l} onClick={() => setLimit(l)} className={`rounded-2xl p-3 text-left ring-1 transition ${limit === l ? "bg-tint ring-2 ring-grape" : "ring-line hover:ring-grape/50"}`}><span className="label block text-[8.5px] text-ink/55">Monthly limit</span><span className="display tab-num mt-1 block text-[26px] leading-none text-ink">{fmt(l)}</span></button>)}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-tint px-4 py-3 text-[14px]"><span className="text-ink/70">Card fee, one time</span><span className="font-bold text-ink">{CARD_FEE} <span className="text-[11.5px] font-semibold text-ink/50">placeholder</span></span></div>
            <button onClick={() => setStep(2)} className="btn btn-brand btn-sm mt-5 w-full">Continue</button>
          </>
        )}

        {step === 2 && (
          <>
            <dl className="mt-4 divide-y divide-[var(--line)] rounded-2xl px-4 ring-1 ring-line">
              <div className={row}><dt className="text-ink/60">Card for</dt><dd className="font-semibold text-ink">{name}</dd></div>
              <div className={row}><dt className="text-ink/60">Type</dt><dd className="font-semibold text-ink">Virtual card</dd></div>
              <div className={row}><dt className="text-ink/60">Monthly limit</dt><dd className="tab-num font-semibold text-ink">{fmt(limit)}</dd></div>
              <div className={row}><dt className="text-ink/60">Card fee</dt><dd className="tab-num font-bold text-ink">{CARD_FEE} <span className="text-[11.5px] font-semibold text-ink/50">placeholder</span></dd></div>
            </dl>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-tint p-3.5 text-[13.5px] text-ink/80">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5b2bff]" />
              <span>I understand this is a demo. No payment is taken and no real card is made.</span>
            </label>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setStep(1)} className="btn btn-line btn-sm text-ink">Back</button>
              <button onClick={confirm} disabled={!agree} className="btn btn-brand btn-sm flex-1 disabled:opacity-40 disabled:shadow-none">Confirm purchase · demo</button>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="grid place-items-center py-8 text-center" role="status">
            <div className="skel relative aspect-[1.586] w-full max-w-[300px] !rounded-[22px]" aria-hidden>
              <span className="absolute left-5 top-5 h-7 w-10 rounded-md bg-card/70" />
              <span className="absolute bottom-12 left-5 h-3 w-3/5 rounded-full bg-card/70" />
              <span className="absolute bottom-6 left-5 h-2.5 w-1/3 rounded-full bg-card/60" />
            </div>
            <p className="mt-5 flex items-center gap-2 text-[15px] font-semibold text-ink"><span className="typing text-grape" aria-hidden><i /> <i /> <i /></span>Issuing {name}&apos;s card…</p>
            <p className="mt-1 text-[13px] text-ink/55">Demo only. Nothing is being charged.</p>
          </div>
        )}

        {step === 4 && issued && (
          <>
            <div className="pop mt-5 flex justify-center"><CardVisual id={id} name={name} card={issued} reveal={false} /></div>
            <p className="mt-4 text-center text-[14px] text-ink/65">Monthly limit {fmt(issued.limit)}. Reveal the number, freeze or change the limit from the Cards tab.</p>
            <button onClick={onClose} className="btn btn-brand btn-sm mt-5 w-full">Done</button>
          </>
        )}
      </div>
    </div>
  );
}
