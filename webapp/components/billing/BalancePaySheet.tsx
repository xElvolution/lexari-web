"use client";

import { useEffect, useRef, useState } from "react";
import { friendly } from "@/lib/api";
import { parkPay, resumePay, shortOf, topUpFor, usePayReq } from "@/lib/balance";
import { refreshBilling, useBilling } from "@/lib/billing";
import { moneyChanged } from "@/lib/money";
import Icon from "../Icon";
import { Sheet, Spinner, money } from "./parts";

/** Confirms a purchase paid from your Lexari balance. Short? Top up first, then it finishes on its own. */
export default function BalancePaySheet() {
  const open = usePayReq();
  if (!open) return null;
  return <PaySheetBody key={open.req.title + (open.auto ?? "")} />;
}

function PaySheetBody() {
  const open = usePayReq()!;
  const { req } = open;
  const { state } = useBilling();
  const [usd, setUsd] = useState(open.auto ?? req.usd);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const balance = state?.credits.balance ?? null;
  const price = Math.round(usd * 1e6);
  const short = balance !== null && balance < price;
  const fired = useRef(false);

  const toTopUp = (s: { needMicros: number; haveMicros: number; shortMicros: number }) => {
    const parked = parkPay();
    if (!parked) return;
    topUpFor(s, req.doing || req.title, () => { void refreshBilling().then(() => resumePay(parked, usd)); }, () => parked.done({ ok: false }));
  };
  const pay = async () => {
    setErr("");
    if (short && balance !== null) { toTopUp({ needMicros: price, haveMicros: balance, shortMicros: price - balance }); return; }
    setBusy(true);
    try {
      const result = await req.run(usd);
      moneyChanged();
      open.done({ ok: true, result, usd });
    } catch (e) {
      const s = shortOf(e);
      if (s) { void refreshBilling(); toTopUp(s); return; }
      setErr(friendly(e, "That didn't go through. Nothing was charged."));
    } finally { setBusy(false); }
  };
  // Back from Top up: carry on with the purchase without another tap.
  useEffect(() => {
    if (open.auto === undefined || fired.current || balance === null) return;
    fired.current = true;
    if (balance >= price) void pay();
  }, [open.auto, balance]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet label="pay-balance" title={req.title} sub={req.what} icon={<Icon name="wallet" size={20} />} onClose={() => !busy && open.done({ ok: false })} closable={!busy}
      footer={
        <button data-pay-balance onClick={() => void pay()} disabled={busy || balance === null} className="btn btn-brand btn-sm w-full disabled:opacity-60">
          {busy ? <><Spinner className="mr-2" />Paying…</> : short ? `Top up and ${req.kind === "fund" ? "fund" : "continue"}` : req.cta ? req.cta(usd) : `Pay ${money(price, { cents: !Number.isInteger(usd) })} from balance`}
        </button>
      }>
      {/* room above and below for the primary agent's gold ring, its glow and the status dot: the sheet body scrolls, so anything past its edge is clipped */}
      {req.art && <div data-pay-art className="mb-1 flex justify-center pb-5 pt-7">{req.art}</div>}
      {req.amounts && (
        <div className="mb-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Amount">
          {req.amounts.map((v) => (
            <button key={v} role="radio" aria-checked={usd === v} data-amount={v} disabled={busy} onClick={() => setUsd(v)} className={`rounded-[16px] py-3 text-center transition ${usd === v ? "bg-grape text-white ring-1 ring-grape" : "bg-card ring-1 ring-line hover:ring-grape/50"}`}>
              <span className="display block text-[24px] leading-none tabular-nums">${v}</span>
            </button>
          ))}
        </div>
      )}
      <dl data-pay-summary className="space-y-2 rounded-[18px] bg-tint p-3.5 text-[14px]">
        <div className="flex justify-between gap-3"><dt className="text-ink/65">Price</dt><dd className="tab-num font-bold text-ink">{money(price, { cents: true })}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink/65">Your balance</dt><dd data-pay-have className={`tab-num font-semibold ${short ? "text-[#c2410c]" : "text-ink"}`}>{balance === null ? "…" : money(balance, { cents: true })}</dd></div>
        <div className="flex justify-between gap-3 border-t border-line pt-2"><dt className="text-ink/65">{short ? "You need" : "After this"}</dt><dd className="tab-num font-bold text-ink">{balance === null ? "…" : short ? `${money(price - balance, { cents: true })} more` : money(balance - price, { cents: true })}</dd></div>
      </dl>
      {req.note && <p className="mt-3 flex gap-2 text-[12.5px] leading-snug text-ink/65"><Icon name="info" size={14} className="mt-0.5 shrink-0 text-brand-ink" />{req.note}</p>}
      {err && <p role="alert" className="mt-3 text-[13px] text-[#e5484d]">{err}</p>}
    </Sheet>
  );
}
