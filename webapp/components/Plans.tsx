"use client";

import { PLANS } from "@/content/appData";
import { openTopUp } from "@/lib/billing";
import { planOf, seatsUsed, useApp } from "@/lib/store";
import Icon from "./Icon";
import { openUpgrade } from "./overlays";

const TOP = new Set(["plus", "max"]);
const dateShort = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Free, Pro and Max (Ultra shown as coming later). Picking a plan opens Top up, paid by card or USDC. */
export function PlansGrid({ onPick }: { onPick?: () => void }) {
  const s = useApp()!;
  const cur = planOf(s);
  const rank = (id: string) => PLANS.findIndex((p) => p.id === id);
  const pick = (id: string) => { onPick?.(); openTopUp({ product: "plan", id }); };
  return (
    <div data-plans className="@container grid gap-3">
      <div className="grid gap-3 @2xl:grid-cols-3">
        {PLANS.filter((p) => !p.later).map((p) => {
          const on = p.id === cur.id;
          const lower = rank(p.id) < rank(cur.id);
          const pop = p.id === "pro";
          return (
            <div key={p.id} data-plan={p.id} className={`relative flex flex-col overflow-hidden rounded-[22px] p-4 ring-1 sm:p-5 ${on ? "bg-grape text-white ring-grape" : pop ? "bg-card pt-9 text-ink ring-2 ring-grape sm:pt-10" : "bg-card text-ink ring-line"}`}>
              {pop && !on && <span className="label absolute inset-x-0 top-0 bg-grape py-1.5 text-center text-[8.5px] text-white">Most popular</span>}
              <div className="flex flex-wrap items-center gap-2"><span className="display text-[26px] leading-none">{p.name}</span><span className={`label rounded-full px-2 py-1 text-[8.5px] ${on ? "bg-white/20" : "bg-tint text-brand-ink"}`}>{p.seats} seat{p.seats === 1 ? "" : "s"}</span></div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span data-price className="display tab-num text-[32px] leading-none">${p.usd}</span>
                <span className={`text-[13px] font-semibold ${on ? "text-white/75" : "text-ink/55"}`}>{p.usd ? "/ month" : "forever"}</span>
              </div>
              <p className={`mt-2 text-[13.5px] leading-snug ${on ? "text-white/85" : "text-ink/70"}`}>{p.for}</p>
              <ul className={`mt-2 grid gap-1 text-[13px] ${on ? "text-white/90" : "text-ink/80"}`}>{p.points.map((pt) => <li key={pt} className="flex items-start gap-2"><Icon name="check" size={13} className={`mt-[3px] shrink-0 ${on ? "" : "text-brand-ink"}`} />{pt}</li>)}</ul>
              <div className="mt-auto pt-4">
                {on ? (
                  p.usd ? <button data-renew={p.id} onClick={() => pick(p.id)} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white/20 text-[13.5px] font-bold transition hover:bg-white/30"><Icon name="check" size={13} />Current · Renew</button>
                    : <span className="label inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[9px]"><Icon name="check" size={11} />Current plan</span>
                ) : lower ? <span className="text-[12px] text-ink/45">{p.usd ? `Can start after your ${cur.name} plan` : "Where everyone starts"}</span>
                  : <button data-upgrade={p.id} onClick={() => pick(p.id)} className="btn btn-brand btn-sm !h-11 w-full">Get {p.name} · ${p.usd}</button>}
              </div>
            </div>
          );
        })}
      </div>
      {PLANS.filter((p) => p.later).map((p) => (
        <div key={p.id} data-plan={p.id} className="flex flex-wrap items-center gap-3 rounded-[22px] bg-tint p-4 text-ink">
          <span className="display text-[22px] leading-none">{p.name}</span>
          <span className="label rounded-full bg-card px-2 py-1 text-[8.5px] text-brand-ink">Coming later</span>
          <span className="min-w-[180px] flex-1 text-[13px] text-ink/65">${p.usd} a month. {p.points.join(", ")}.</span>
        </div>
      ))}
      <p className="text-[12px] text-ink/50">{seatsUsed(s)} of {cur.seats} seat{cur.seats === 1 ? "" : "s"} used. Plans run 30 days at a time and we remind you before they end. Pay by card or with USDC on Solana.</p>
    </div>
  );
}

/** Current plan with an Upgrade plan button that opens the plans sheet. Used on Team. */
export function PlanSummary() {
  const s = useApp()!;
  const cur = planOf(s);
  const used = seatsUsed(s);
  return (
    <div data-plan-summary className="flex flex-wrap items-center gap-3 rounded-[22px] bg-card p-4 ring-1 ring-line sm:p-5">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-grape text-white"><Icon name="star" size={19} /></span>
      <div className="min-w-0 flex-1"><div className="text-[16px] font-bold text-ink">{cur.name} plan</div><div className="text-[13px] text-ink/60">{used} of {cur.seats} seat{cur.seats === 1 ? "" : "s"} used{cur.expiresAt ? ` · runs until ${dateShort(cur.expiresAt)}` : ""}</div></div>
      <button data-upgrade-plan onClick={() => openUpgrade("plans")} className="btn btn-brand btn-sm !h-10">{TOP.has(cur.id) ? "See plans" : "Upgrade plan"}</button>
    </div>
  );
}
