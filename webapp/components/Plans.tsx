"use client";

import { useState } from "react";
import { PLANS, YEAR_SAVE_PCT, planPrice, solLabel, type Period, type PlanId } from "@/content/appData";
import { payForPlan } from "@/lib/pay";
import { planOf, seatsUsed, setPlan, toast, useApp } from "@/lib/store";
import Icon from "./Icon";
import { celebrate } from "./Celebrate";
import { openUpgrade } from "./overlays";

/** Monthly / Yearly switch. Yearly is 10 months' price for 12. */
export function PeriodToggle({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex rounded-full bg-tint p-1" role="radiogroup" aria-label="Billing period">
      {(["month", "year"] as const).map((p) => (
        <button key={p} role="radio" aria-checked={period === p} data-period={p} onClick={() => onChange(p)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold transition ${period === p ? "bg-card text-ink shadow-sm" : "text-ink/60 hover:text-ink"}`}>
          {p === "month" ? "Monthly" : "Yearly"}{p === "year" && <span className="label rounded-full bg-[#1fbf6a] px-1.5 py-0.5 text-[8px] text-white">−{YEAR_SAVE_PCT}%</span>}
        </button>
      ))}
    </div>
  );
}

/** Pro, Pro Plus and Max (Free shown as your starting point). Upgrading pays devnet SOL to the treasury (checked on chain). */
export function PlansGrid({ onUpgraded }: { compact?: boolean; onUpgraded?: () => void }) {
  const s = useApp()!;
  const cur = planOf(s);
  const [busy, setBusy] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const rank = (id: string) => PLANS.findIndex((p) => p.id === id);
  const up = async (id: PlanId) => {
    const plan = PLANS.find((p) => p.id === id)!;
    setBusy(id);
    const r = await payForPlan(plan, period);
    setBusy(null);
    if (!r.ok) { if (!r.cancelled && r.error) toast({ text: r.error, face: "home" }); return; }
    setPlan(r.plan.id as PlanId, r.plan.seats, r.plan.expiresAt);
    onUpgraded?.();
    celebrate({ confetti: "big", title: `You're on ${r.plan.name}`, body: `${r.plan.seats} seats unlocked. Hire away.`, tx: r.tx });
  };
  return (
    <div data-plans className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodToggle period={period} onChange={setPeriod} />
        <span className="text-[12.5px] font-semibold text-ink/55">{period === "year" ? "2 months free, billed once a year" : "Billed every 30 days"}</span>
      </div>
      {PLANS.filter((p) => p.lamports).map((p) => {
        const on = p.id === cur.id;
        const lower = rank(p.id) < rank(cur.id);
        const price = planPrice(p, period);
        const pop = p.id === "pro";
        return (
          <div key={p.id} data-plan={p.id} className={`relative overflow-hidden rounded-[22px] p-4 ring-1 sm:p-5 ${on ? "bg-grape text-white ring-grape" : pop ? "bg-card text-ink ring-2 ring-grape" : "bg-card text-ink ring-line"}`}>
            {pop && !on && <span className="label absolute right-4 top-4 rounded-full bg-grape px-2 py-1 text-[8px] text-white">Most popular</span>}
            <div className="flex items-center gap-2"><span className="display text-[26px] leading-none">{p.name}</span><span className={`label rounded-full px-2 py-1 text-[8.5px] ${on ? "bg-white/20" : "bg-tint text-brand-ink"}`}>{p.seats} seats</span></div>
            <div className="mt-3 flex items-baseline gap-2">
              <span data-price className="display tab-num text-[30px] leading-none">{solLabel(price)}</span>
              <span className={`text-[13px] font-semibold ${on ? "text-white/75" : "text-ink/55"}`}>/ {period === "year" ? "year" : "month"}</span>
            </div>
            {period === "year" && <p className={`mt-1 text-[12.5px] font-semibold ${on ? "text-white/85" : "text-[#1a9c57]"}`}>{solLabel(Math.round(price / 12))} a month · save {solLabel(p.lamports * 12 - price)}</p>}
            <p className={`mt-2 text-[13.5px] leading-snug ${on ? "text-white/85" : "text-ink/70"}`}>{p.for}</p>
            <ul className={`mt-2 grid gap-1 text-[13px] ${on ? "text-white/90" : "text-ink/80"}`}>{p.points.map((pt) => <li key={pt} className="flex items-center gap-2"><Icon name="check" size={13} className={on ? "" : "text-brand-ink"} />{pt}</li>)}</ul>
            <div className="mt-4">
              {on ? <span className="label inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[9px]"><Icon name="check" size={11} />Current plan{cur.expiresAt ? ` · until ${new Date(cur.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</span>
                : lower ? <span className="text-[12px] text-ink/45">Included in your plan</span>
                : <button data-upgrade={p.id} onClick={() => up(p.id)} disabled={!!busy} className="btn btn-brand btn-sm !h-11 w-full disabled:opacity-60">{busy === p.id ? "Finish the payment…" : `Pay ${solLabel(price)} · ${p.name}`}</button>}
            </div>
          </div>
        );
      })}
      <p className="text-[12px] text-ink/50">{seatsUsed(s)} of {cur.seats} seat{cur.seats === 1 ? "" : "s"} used. Free includes your own agent. Paid in devnet SOL (test money) and checked on Solana.</p>
    </div>
  );
}

/** Current plan with an Upgrade plan button that opens the plans sheet. Used on Team and Billing. */
export function PlanSummary() {
  const s = useApp()!;
  const cur = planOf(s);
  const used = seatsUsed(s);
  return (
    <div data-plan-summary className="flex flex-wrap items-center gap-3 rounded-[22px] bg-card p-4 ring-1 ring-line sm:p-5">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-grape text-white"><Icon name="star" size={19} /></span>
      <div className="min-w-0 flex-1"><div className="text-[16px] font-bold text-ink">{cur.name} plan</div><div className="text-[13px] text-ink/60">{used} of {cur.seats} seat{cur.seats === 1 ? "" : "s"} used{cur.expiresAt ? ` · renews by ${new Date(cur.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</div></div>
      <button data-upgrade-plan onClick={() => openUpgrade("plans")} className="btn btn-brand btn-sm !h-10">{cur.id === "max" ? "See plans" : "Upgrade plan"}</button>
    </div>
  );
}
