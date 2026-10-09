"use client";

import { useState } from "react";
import { DEFAULT_SPEND_LIMIT_USD, MICROS, SPEND_PRESETS, type SpendMode } from "@/content/billing";
import { friendly } from "@/lib/api";
import { closeBillingSheet, setSpend, useBilling } from "@/lib/billing";
import { toast } from "@/lib/store";
import Icon from "../Icon";
import { Sheet, money } from "./parts";
import { useMask } from "@/lib/privacy";

/** Monthly spend limit on extra credits: Disabled, Fixed or Unlimited (the same three states Cursor uses). */
export default function SpendSheet() {
  const mask = useMask();
  const { state } = useBilling();
  const [mode, setMode] = useState<SpendMode>(state?.spend.mode ?? "fixed");
  const start = state ? Math.round(state.spend.limit / MICROS) : DEFAULT_SPEND_LIMIT_USD;
  const [limit, setLimit] = useState<number>(start);
  const [custom, setCustom] = useState(!(SPEND_PRESETS as readonly number[]).includes(start));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await setSpend(mode, mode === "fixed" ? limit : undefined); toast({ text: mode === "fixed" ? `Spend limit set to $${limit} a cycle` : mode === "unlimited" ? "No spend limit on extra credits" : "Extra credits are paused" }); closeBillingSheet(); }
    catch (e) { toast({ text: friendly(e, "Couldn't save the limit.") }); }
    finally { setBusy(false); }
  };
  const modes: [SpendMode, string, string][] = [
    ["fixed", "Fixed", "Credits stop at an amount each cycle."],
    ["unlimited", "Unlimited", "Credits run until the balance is used."],
    ["disabled", "Disabled", "Never use credits automatically."],
  ];
  return (
    <Sheet label="spend-limit" title="Spend limit" sub="Extra credits are used after your included usage. The limit caps what they can spend each billing cycle." icon={<Icon name="settings" size={20} />} onClose={closeBillingSheet}
      footer={<button onClick={save} disabled={busy || (mode === "fixed" && !(limit >= 1))} className="btn btn-brand btn-sm w-full disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>}>
      <div className="grid gap-2" role="radiogroup" aria-label="Spend limit">
        {modes.map(([k, t, d]) => (
          <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`flex items-center gap-3 rounded-[18px] p-3.5 text-left transition ${mode === k ? "bg-grape/10 ring-2 ring-grape" : "bg-card ring-1 ring-line hover:ring-grape/50"}`}>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${mode === k ? "bg-grape" : "ring-2 ring-ink/25"}`}>{mode === k && <i className="h-2 w-2 rounded-full bg-white" />}</span>
            <span><span className="block text-[15px] font-bold text-ink">{t}</span><span className="block text-[12.5px] text-ink/60">{d}</span></span>
          </button>
        ))}
      </div>
      {mode === "fixed" && (
        <div className="mt-4">
          <h3 className="label mb-2 text-[9.5px] text-ink/50">Limit per cycle</h3>
          <div className="flex flex-wrap gap-2">
            {SPEND_PRESETS.map((v) => <button key={v} onClick={() => { setLimit(v); setCustom(false); }} aria-pressed={!custom && limit === v} className={`h-10 rounded-full px-4 text-[14px] font-bold tabular-nums transition ${!custom && limit === v ? "bg-ink text-[var(--bg)]" : "bg-tint text-ink hover:bg-grape hover:text-white"}`}>${v}</button>)}
            <button onClick={() => setCustom(true)} aria-pressed={custom} className={`h-10 rounded-full px-4 text-[14px] font-bold transition ${custom ? "bg-ink text-[var(--bg)]" : "bg-tint text-ink hover:bg-grape hover:text-white"}`}>Custom</button>
          </div>
          {custom && <label className="mt-3 flex items-center gap-2"><span className="text-[15px] font-bold text-ink">$</span><input type="number" inputMode="numeric" min={1} max={10000} value={Number.isFinite(limit) ? limit : ""} onChange={(e) => setLimit(Math.max(0, Math.min(10_000, Math.round(Number(e.target.value)))))} aria-label="Custom limit in dollars" className="field !w-32 !py-2" /></label>}
          {state && <p className="mt-3 text-[12.5px] text-ink/55">{mask(money(state.credits.spent, { cents: true }))} of credits used this cycle. Balance {mask(money(state.credits.balance, { cents: true }))}.</p>}
        </div>
      )}
    </Sheet>
  );
}
