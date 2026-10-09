"use client";

import { useState } from "react";
import { PLANS, perMonth, planPrice, yearSaving, type Period, type PlanId } from "@/content/appData";
import { useBilling } from "@/lib/billing";
import { planOf, seatsUsed, useApp } from "@/lib/store";
import Icon from "./Icon";
import { openUpgrade } from "./overlays";
import { buyPlan, offerNote, offerOf } from "./planAction";

const TOP = new Set(["plus", "max"]);
const dateShort = (ms: number, year = false) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
/** A smaller plan bought now is booked to start when the current one ends. Never names the current plan (it may be an older plan that is no longer sold). */
export const queuedNote = (endsAt: number | null | undefined) => endsAt ? `Starts when your current plan ends on ${dateShort(endsAt)}` : "Starts when your current plan ends";

/** Monthly / Yearly segmented switch. The grape thumb slides between the two; Yearly carries a "2 months free" pill. */
export function PeriodToggle({ period, onChange, className = "" }: { period: Period; onChange: (p: Period) => void; className?: string }) {
  const keys = (e: React.KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); onChange(period === "monthly" ? "yearly" : "monthly"); } };
  return (
    <div data-period-toggle role="radiogroup" aria-label="Billing period" onKeyDown={keys} className={`relative grid h-12 w-full grid-cols-2 rounded-full bg-tint p-1 ring-1 ring-line ${className}`}>
      <span aria-hidden data-period-thumb className="period-thumb absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full bg-grape shadow-[0_8px_18px_-8px_rgba(91,43,255,.9)]" style={{ transform: period === "yearly" ? "translateX(100%)" : "translateX(0)" }} />
      {(["monthly", "yearly"] as const).map((p) => (
        <button key={p} type="button" role="radio" aria-checked={period === p} tabIndex={period === p ? 0 : -1} data-period={p} onClick={() => onChange(p)}
          className={`relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[14px] max-[430px]:gap-1 font-bold transition-colors duration-300 ${period === p ? "text-white" : "text-ink/65 hover:text-ink"}`}>
          {p === "monthly" ? "Monthly" : "Yearly"}
          {p === "yearly" && <span data-free-pill className={`label whitespace-nowrap rounded-full px-1.5 py-[3px] text-[8px] leading-none max-[430px]:!text-[9px] max-[430px]:!tracking-[.02em] transition-colors duration-300 ${period === p ? "bg-white text-[#137a3d]" : "bg-[#1fbf6a] text-white"}`}>2 months free</span>}
        </button>
      ))}
    </div>
  );
}

/** Free, Pro and Max (Ultra shown as coming later), monthly or yearly. Paid from your Lexari balance; short balances top up first. */
export function PlansGrid({ onPick }: { onPick?: () => void }) {
  const s = useApp()!;
  const { state: b } = useBilling();
  const cur = planOf(s);
  const curPeriod: Period = b?.plan.period ?? "monthly";
  const [period, setPeriod] = useState<Period>("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const rank = (id: string) => PLANS.findIndex((p) => p.id === id);
  const yearly = period === "yearly";
  const pick = async (id: PlanId) => {
    setBusy(id);
    onPick?.();
    try { await buyPlan(id, period, b); } finally { setBusy(null); }
  };
  return (
    <div data-plans data-period-now={period} className="@container grid gap-3">
      <div className="grid gap-2 @lg:flex @lg:items-center @lg:justify-between">
        <PeriodToggle period={period} onChange={setPeriod} className="@lg:w-[340px]" />
        <p data-period-hint className="px-1 text-center text-[12.5px] font-semibold text-ink/55 @lg:text-right">{yearly ? "Pay for 10 months, get 12. Usage refills every month." : "30 days at a time. Renew whenever you like."}</p>
      </div>
      <div className="grid gap-3 @2xl:grid-cols-3">
        {PLANS.filter((p) => !p.later).map((p) => {
          const on = p.id === cur.id;
          const samePeriod = on && (p.usd === 0 || curPeriod === period);
          const lower = rank(p.id) < rank(cur.id);
          const pop = p.id === "pro";
          const price = planPrice(p, period);
          const offer = p.usd ? offerOf(b, p.id, period) : null;
          const blocked = offer?.mode === "blocked";
          const note = p.usd ? offerNote(b, p.id, period) : "";
          return (
            <div key={p.id} data-plan={p.id} className={`relative flex min-w-0 flex-col overflow-hidden rounded-[22px] ring-1 transition-shadow ${on ? "bg-grape text-white ring-grape" : pop ? "bg-card text-ink ring-2 ring-grape" : "bg-card text-ink ring-line"}`}>
              {/* A row of its own above the padded body (not absolute), so it can never cover the title. The phone
                  stylesheet rewrites p-4, which is what let the old absolute ribbon sit on top of "Pro". */}
              {pop && !on && <span data-ribbon className="label block shrink-0 bg-grape py-1.5 text-center text-[8.5px] text-white">Most popular</span>}
              <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="display text-[26px] leading-none">{p.name}</span>
                  <span className={`label whitespace-nowrap rounded-full px-2 py-1 text-[8.5px] ${on ? "bg-white/20" : "bg-tint text-brand-ink"}`}>{p.seats} seat{p.seats === 1 ? "" : "s"}</span>
                  {on && p.usd > 0 && b?.plan.period && <span data-current-period className="label whitespace-nowrap rounded-full bg-white/20 px-2 py-1 text-[8.5px]">{b.plan.period}</span>}
                </div>
                <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
                  <span key={`${p.id}-${period}`} data-price className="price-in display tab-num text-[32px] leading-none">${price}</span>
                  <span className={`text-[13px] font-semibold ${on ? "text-white/75" : "text-ink/55"}`}>{p.usd ? (yearly ? "/ year" : "/ month") : "forever"}</span>
                </div>
                {p.usd > 0 && (
                  <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${yearly ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!yearly}>
                    <div className="overflow-hidden">
                      <div data-yearly-line className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
                        <span className={`text-[13px] font-semibold ${on ? "text-white/85" : "text-ink/70"}`}>${perMonth(p, "yearly").toFixed(2)} a month, billed yearly</span>
                        <span data-save className={`label whitespace-nowrap rounded-full px-2 py-1 text-[8.5px] ${on ? "bg-white text-[#137a3d]" : "bg-[#e7f8ee] text-[#137a3d]"}`}>Save ${yearSaving(p)}</span>
                      </div>
                    </div>
                  </div>
                )}
                <p className={`mt-2 break-words text-[13.5px] leading-snug ${on ? "text-white/85" : "text-ink/70"}`}>{p.for}</p>
                <ul className={`mt-2 grid gap-1 text-[13px] ${on ? "text-white/90" : "text-ink/80"}`}>{p.points.map((pt) => <li key={pt} className="flex min-w-0 items-start gap-2"><Icon name="check" size={13} className={`mt-[3px] shrink-0 ${on ? "" : "text-brand-ink"}`} /><span className="min-w-0">{pt}</span></li>)}</ul>
                <div className="mt-auto pt-4">
                  {p.usd === 0 ? (
                    on ? <span className="label inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[9px]"><Icon name="check" size={11} />Current plan</span>
                      : <span className="block text-[12px] leading-snug text-ink/50">Where everyone starts</span>
                  ) : blocked ? (
                    <span data-blocked={p.id} className={`block text-[12px] leading-snug ${on ? "text-white/80" : "text-ink/55"}`}>{samePeriod ? `Current plan until ${b?.plan.endsAt ? dateShort(b.plan.endsAt, true) : "it ends"}. ` : ""}{note}</span>
                  ) : on ? (
                    <>
                      <button data-renew={p.id} onClick={() => void pick(p.id)} disabled={!!busy} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white/20 text-[13.5px] font-bold transition hover:bg-white/30 disabled:opacity-60">
                        {samePeriod ? <><Icon name="check" size={13} />Current · Renew ${price}</> : `Switch to ${period} · $${price}`}
                      </button>
                      {note && <span className="mt-2 block text-[12px] leading-snug text-white/75">{note}</span>}
                    </>
                  ) : lower ? (
                    <>
                      <button data-upgrade={p.id} onClick={() => void pick(p.id)} disabled={!!busy} className="flex h-11 w-full items-center justify-center rounded-full bg-tint text-[13.5px] font-bold text-ink transition hover:bg-grape hover:text-white disabled:opacity-60">Book {p.name} · ${price}</button>
                      <span className="mt-2 block text-[12px] leading-snug text-ink/50">{note || queuedNote(cur.expiresAt)}</span>
                    </>
                  ) : (
                    <>
                      <button data-upgrade={p.id} onClick={() => void pick(p.id)} disabled={!!busy} className="btn btn-brand btn-sm !h-11 w-full disabled:opacity-60">Get {p.name} · ${price}{yearly ? " / year" : ""}</button>
                      {note && <span className="mt-2 block text-[12px] leading-snug text-ink/55">{note}</span>}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {PLANS.filter((p) => p.later).map((p) => (
        <div key={p.id} data-plan={p.id} className="flex flex-wrap items-center gap-3 rounded-[22px] bg-tint p-4 text-ink">
          <span className="display text-[22px] leading-none">{p.name}</span>
          <span className="label rounded-full bg-card px-2 py-1 text-[8.5px] text-brand-ink">Coming later</span>
          <span className="min-w-0 basis-full text-[13px] leading-snug text-ink/65">${p.usd} a month. {p.points.join(", ")}.</span>
        </div>
      ))}
      <p className="text-[12px] leading-snug text-ink/50">{seatsUsed(s)} of {cur.seats} seat{cur.seats === 1 ? "" : "s"} used. Paid from your Lexari balance; top up by card or USDC. Monthly plans run 30 days; yearly plans run a year and refill your usage every month. We remind you before a plan ends.</p>
    </div>
  );
}

/** Current plan with an Upgrade plan button that opens the plans sheet. Used on Team. */
export function PlanSummary() {
  const s = useApp()!;
  const { state: b } = useBilling();
  const cur = planOf(s);
  const used = seatsUsed(s);
  const yearly = b?.plan.period === "yearly" && b.plan.id === cur.id;
  return (
    <div data-plan-summary className="flex flex-wrap items-center gap-3 rounded-[22px] bg-card p-4 ring-1 ring-line sm:p-5">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-grape text-white"><Icon name="star" size={19} /></span>
      <div className="min-w-0 flex-1"><div className="text-[16px] font-bold text-ink">{cur.name} plan{yearly ? ", yearly" : ""}</div><div className="text-[13px] text-ink/60">{used} of {cur.seats} seat{cur.seats === 1 ? "" : "s"} used{cur.expiresAt ? ` · ${yearly ? "renews" : "runs until"} ${dateShort(cur.expiresAt, yearly)}` : ""}</div></div>
      <button data-upgrade-plan onClick={() => openUpgrade("plans")} className="btn btn-brand btn-sm !h-10">{TOP.has(cur.id) ? "See plans" : "Upgrade plan"}</button>
    </div>
  );
}
