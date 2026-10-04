"use client";

import { useState } from "react";
import { PLANS, solLabel, type PlanId } from "@/content/appData";
import { payForPlan } from "@/lib/pay";
import { planOf, seatsUsed, setPlan, toast, useApp } from "@/lib/store";
import Icon from "./Icon";

/** Free, Pro, Pro Plus and Max with the current plan marked. Upgrading pays devnet SOL to the treasury (checked on chain). */
export function PlansGrid({ compact = false, onUpgraded }: { compact?: boolean; onUpgraded?: () => void }) {
  const s = useApp()!;
  const cur = planOf(s);
  const [busy, setBusy] = useState<string | null>(null);
  const rank = (id: string) => PLANS.findIndex((p) => p.id === id);
  const up = async (id: PlanId) => {
    const plan = PLANS.find((p) => p.id === id)!;
    setBusy(id);
    const r = await payForPlan(plan);
    setBusy(null);
    if (!r.ok) { if (!r.cancelled && r.error) toast({ text: r.error, face: "home" }); return; }
    setPlan(r.plan.id as PlanId, r.plan.seats, r.plan.expiresAt);
    toast({ text: `You're on ${r.plan.name}. ${r.plan.seats} seats unlocked.`, face: "home" });
    onUpgraded?.();
  };
  return (
    <div data-plans className={`grid gap-2.5 ${compact ? "" : "sm:grid-cols-2"}`}>
      {PLANS.map((p) => {
        const on = p.id === cur.id;
        const lower = rank(p.id) < rank(cur.id);
        return (
          <div key={p.id} data-plan={p.id} className={`relative rounded-[20px] p-4 ring-1 ${on ? "bg-grape text-white ring-grape" : "bg-card text-ink ring-line"}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="display text-[24px] leading-none">{p.name}</span>
              <span className={`text-[13px] font-bold ${on ? "text-white/90" : "text-brand-ink"}`}>{p.lamports ? `${solLabel(p.lamports)} / 30 days` : "Free"}</span>
            </div>
            <p className={`mt-1 text-[13px] leading-snug ${on ? "text-white/85" : "text-ink/65"}`}>{p.seats === 1 ? "1 agent: your own" : `${p.seats} seats`} · {p.for}</p>
            {!compact && <ul className={`mt-2 space-y-0.5 text-[12.5px] ${on ? "text-white/85" : "text-ink/70"}`}>{p.points.map((pt) => <li key={pt}>· {pt}</li>)}</ul>}
            <div className="mt-3">
              {on ? <span className="label inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[9px]"><Icon name="check" size={11} />Current plan{cur.expiresAt ? ` · until ${new Date(cur.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</span>
                : lower || !p.lamports ? <span className="text-[12px] text-ink/45">{p.lamports ? "Included in your plan" : "Always included"}</span>
                : <button data-upgrade={p.id} onClick={() => up(p.id)} disabled={!!busy} className="btn btn-brand btn-sm !h-10 w-full disabled:opacity-60">{busy === p.id ? "Finish the payment…" : `Upgrade to ${p.name}`}</button>}
            </div>
          </div>
        );
      })}
      <p className="text-[12px] text-ink/50 sm:col-span-2">{seatsUsed(s)} of {cur.seats} seat{cur.seats === 1 ? "" : "s"} used. Paid in devnet SOL (test money) and checked on Solana.</p>
    </div>
  );
}
