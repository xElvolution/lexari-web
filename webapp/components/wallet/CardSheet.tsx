"use client";

import { useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import type { Card } from "@/lib/pay";
import { payer } from "@/lib/pay";
import { txUrl } from "@/lib/nft";
import { toast, useApp } from "@/lib/store";
import Icon from "../Icon";
import PinPad from "../lock/PinPad";
import CardVisual from "./CardVisual";
import { CARD_LIMITS } from "./cards";
import { updateCard } from "./useCards";

const HIDE_AFTER = 30;
const b64 = (u: Uint8Array) => { let s = ""; u.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); };

/** Card details: masked until you view it with your PIN (or a wallet confirm when no PIN is set). Auto-hides after 30 s. */
export default function CardSheet({ agent, name, card, onClose }: { agent: string; name: string; card: Card; onClose: () => void }) {
  const s = useApp()!;
  const [full, setFull] = useState<Card | null>(null);
  const [left, setLeft] = useState(0);
  const [pin, setPin] = useState(false);
  const [confirm, setConfirm] = useState(false); // no PIN set: an explicit Confirm step, then a wallet signature
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = full ? { ...card, ...full, frozen: card.frozen, limit: card.limit, spent: card.spent } : card;
  useEffect(() => { if (!full) return; setLeft(HIDE_AFTER); const t = setInterval(() => setLeft((x) => { if (x <= 1) { setFull(null); return 0; } return x - 1; }), 1000); return () => clearInterval(t); }, [full]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const reveal = async (body: Record<string, string>) => {
    setBusy(true); setErr("");
    try { const r = await api<{ card: Card }>("/api/cards/reveal", { method: "POST", body: { agent, ...body } }); setFull(r.card); setPin(false); }
    catch (e) { setErr(friendly(e, "Couldn't open the card.")); }
    finally { setBusy(false); }
  };
  const view = async () => {
    if (s.lockOn) { setPin(true); setErr(""); return; }
    if (!confirm) { setConfirm(true); setErr(""); return; }
    setBusy(true); setErr("");
    try {
      const w = await payer(); if (!w) throw new Error("Your wallet isn't ready on this device yet.");
      const message = `Lexari: view card ${agent}\nTime: ${Date.now()}`;
      const sig = await w.signMessage(new TextEncoder().encode(message));
      setBusy(false); setConfirm(false);
      await reveal({ message, signature: b64(sig) });
    } catch (e) { setBusy(false); const m = (e as Error).message || ""; setErr(/reject|cancel|denied/i.test(m) ? "You didn't confirm. The card stays hidden." : m || "Couldn't confirm."); }
  };
  const copy = (v: string, what: string) => { navigator.clipboard?.writeText(v).then(() => toast({ text: `Copied ${what}` }), () => toast({ text: "Couldn't copy" })); };
  const act = async (patch: { frozen?: boolean; limit?: number }, done: string) => { try { await updateCard(agent, patch); toast({ text: done }); } catch (e) { toast({ text: friendly(e, "Could not update the card.") }); } };
  const pct = Math.min(100, (card.spent / Math.max(1, card.limit)) * 100);
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`${name}'s card`} data-card-sheet className="pop pb-safe-dlg max-h-[94dvh] w-full max-w-[460px] overflow-y-auto rounded-t-[26px] bg-card p-5 ring-1 ring-line sm:rounded-[26px]">
        <div className="flex items-center justify-between"><h2 className="display text-[24px] text-ink">{name}&apos;s card</h2><button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button></div>
        {pin ? (
          <div className="py-4"><PinPad title="Enter your PIN" sub="To view the full card details." error={err} busy={busy} onDone={(p) => void reveal({ pin: p })} /><button onClick={() => setPin(false)} className="mx-auto mt-4 block text-[13px] font-semibold text-ink/55">Cancel</button></div>
        ) : <>
          <div className="mt-3 flex justify-center"><CardVisual id={agent} name={name} card={shown} onCopy={copy} /></div>
          {full ? (
            <div className="mt-3 rounded-2xl bg-tint p-3">
              <div className="flex items-center justify-between text-[12.5px] font-semibold text-ink/65"><span>Tap a detail to copy it</span><span data-hide-in>Hides in {left}s</span></div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([["Card number", full.number.replace(/(.{4})/g, "$1 ").trim(), full.number], ["Expiry", `${String(full.expMonth).padStart(2, "0")}/${String(full.expYear).slice(-2)}`, `${String(full.expMonth).padStart(2, "0")}/${String(full.expYear).slice(-2)}`], ["CVV", full.cvv, full.cvv], ["Name", name.toUpperCase(), name.toUpperCase()]] as const).map(([k, v, raw]) => (
                  <button key={k} data-copy-field={k} onClick={() => copy(raw, k.toLowerCase())} className={`flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-left ring-1 ring-line hover:ring-grape ${k === "Card number" ? "col-span-2" : ""}`}>
                    <span className="min-w-0"><span className="label block text-[8px] text-ink/50">{k}</span><span className="block truncate font-mono text-[14px] font-semibold text-ink">{v}</span></span><Icon name="copy" size={14} className="shrink-0 text-ink/45" />
                  </button>
                ))}
              </div>
              <button onClick={() => setFull(null)} className="btn btn-line btn-sm mt-3 w-full text-ink"><Icon name="eyeoff" size={15} />Hide details</button>
            </div>
          ) : (
            <>
              {confirm ? (
                <div data-card-confirm className="mt-4 rounded-2xl bg-tint p-4 text-center">
                  <div className="text-[15px] font-bold text-ink">Show the full card details?</div>
                  <p className="mt-1 text-[13px] text-ink/60">The number, expiry and CVV show for 30 seconds. Make sure nobody is looking at your screen.</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setConfirm(false)} disabled={busy} className="btn btn-line btn-sm flex-1 text-ink">Cancel</button>
                    <button data-card-confirm-yes onClick={() => void view()} disabled={busy} className="btn btn-brand btn-sm flex-1 disabled:opacity-60">{busy ? "Confirming…" : "Confirm"}</button>
                  </div>
                </div>
              ) : <button data-view-card onClick={() => void view()} disabled={busy} className="btn btn-brand btn-sm mt-4 w-full disabled:opacity-60"><Icon name="eye" size={16} />View card</button>}
              <p className="mt-1.5 text-center text-[12px] text-ink/50">{s.lockOn ? "Needs your app PIN." : "Needs a quick confirm. Set an app PIN in Settings to use that instead."}</p>
              {err && <p role="alert" className="mt-2 text-center text-[13px] text-[#e5484d]">{err}</p>}
            </>
          )}
          <div className="mt-4 rounded-2xl bg-tint p-4">
            <div className="flex items-baseline justify-between text-[13.5px]"><span className="text-ink/65">Spent this month</span><span className="tab-num font-mono font-semibold text-ink">${card.spent} / ${card.limit}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-grape" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="mt-3 divide-y divide-[var(--line)] rounded-2xl px-4 ring-1 ring-line">
            <div className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><div className="text-[14.5px] font-semibold text-ink">Freeze card</div><div className="text-[12.5px] text-ink/55">Stops new purchases until you unfreeze.</div></div>
              <button role="switch" aria-checked={card.frozen} aria-label="Freeze card" onClick={() => act({ frozen: !card.frozen }, card.frozen ? "Card unfrozen" : "Card frozen")} className={`relative h-7 w-12 rounded-full transition ${card.frozen ? "bg-grape" : "bg-ink/20"}`}><i className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${card.frozen ? "left-6" : "left-1"}`} /></button></div>
            <div className="py-3"><div className="text-[14.5px] font-semibold text-ink">Monthly limit</div>
              <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Monthly limit">{CARD_LIMITS.map((l) => <button key={l} role="radio" aria-checked={card.limit === l} onClick={() => card.limit !== l && act({ limit: l }, `Limit set to $${l} a month`)} className={`rounded-xl py-1.5 text-[13px] font-bold ring-1 transition ${card.limit === l ? "bg-tint text-ink ring-2 ring-grape" : "text-ink/70 ring-line hover:ring-grape/50"}`}>${l}</button>)}</div></div>
          </div>
          <div className="mt-4"><span className="label text-[9px] text-ink/55">Recent purchases</span><p className="mt-1.5 text-[13.5px] text-ink/60">No purchases yet. When {name} buys a tool or compute, it shows here.</p></div>
          {card.tx && <a href={txUrl(card.tx)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink/55 hover:text-brand-ink">Card payment on Solana <Icon name="arrow" size={12} /></a>}
        </>}
      </div>
    </div>
  );
}
