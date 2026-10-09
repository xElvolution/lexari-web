"use client";

import type { BillingState } from "@/lib/billing";
import { LaminaMark, Meter, dateShort, money, pct, timeShort } from "./parts";
import { useMask } from "@/lib/privacy";
import EyeToggle from "../security/EyeToggle";

/** Lamina as a percentage on every plan (Free: today's allowance), premium in dollars on paid plans. */
export default function UsageMeters({ s, compact = false }: { s: BillingState; compact?: boolean }) {
  const mask = useMask();
  const u = s.usage;
  const paid = s.plan.id !== "free";
  return (
    <div data-usage-meters className={`grid ${compact ? "gap-3.5" : "gap-5"}`}>
      <Meter
        value={pct(u.lamina.used, u.lamina.limit)}
        label={<><LaminaMark size={15} className="text-brand-ink" />{u.free ? "Lamina today" : "Lamina"}</>}
        right={`${pct(u.lamina.used, u.lamina.limit)}%`}
        sub={u.free
          ? (u.lamina.used >= u.lamina.limit ? `Used up for today. Refills at ${timeShort(u.free.resetsAt)}.` : compact ? `Refills at ${timeShort(u.free.resetsAt)}.` : `A free allowance every day. Refills at ${timeShort(u.free.resetsAt)}.`)
          : u.lamina.used >= u.lamina.limit ? "Included Lamina is used. Lamina keeps going on your premium usage, then credits." : compact ? undefined : `Included every cycle. Resets ${dateShort(u.cycleEnd)}.`}
      />
      {paid && (
        <Meter
          value={pct(u.premium.used, u.premium.limit)}
          label="Premium models"
          right={<>{money(u.premium.used, { cents: true })} <span className="font-semibold text-ink/50">of {money(u.premium.limit)}</span></>}
          sub={compact ? undefined : "Claude Sonnet and other premium models, at API price plus 20%."}
        />
      )}
      {(s.credits.balance > 0 || !compact) && (
        <div className="flex items-center justify-between gap-3 text-[14px]">
          <span className="flex items-center gap-2 font-semibold text-ink">Extra credits<EyeToggle size={24} /></span>
          <span data-credits-balance className="font-bold tabular-nums text-ink">{mask(money(s.credits.balance, { cents: true }))}{s.credits.spent > 0 && <span className="ml-1.5 font-semibold text-ink/50">{mask(money(s.credits.spent, { cents: true }))} used this {paid ? "cycle" : "month"}</span>}</span>
        </div>
      )}
    </div>
  );
}
