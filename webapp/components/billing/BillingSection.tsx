"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PLANS, type PlanId } from "@/content/appData";
import { MICROS } from "@/content/billing";
import { LAMINA, PREMIUM, modelById } from "@/content/models";
import { friendly } from "@/lib/api";
import { devBilling, openModels, openSpend, openTopUp, refreshBilling, useBilling, verifyPayment, type BillingState } from "@/lib/billing";
import { setPlan, toast } from "@/lib/store";
import { celebrate } from "../Celebrate";
import Icon from "../Icon";
import { PlansGrid } from "../Plans";
import { openUpgrade } from "../overlays";
import UsageMeters from "./UsageMeters";
import { LaminaMark, ModelMark, Spinner, dateShort, money } from "./parts";

const box = "rounded-[22px] bg-card ring-1 ring-line";
const smallBtn = "inline-flex h-10 items-center gap-2 rounded-full bg-tint px-4 text-[14px] font-semibold text-ink transition hover:bg-grape hover:text-white";
const H = ({ children, right }: { children: ReactNode; right?: ReactNode }) => <div className="mb-1.5 mt-7 flex items-end justify-between gap-3"><h3 className="label text-[9.5px] text-ink/50">{children}</h3>{right}</div>;
const skuLabel = (sku: string) => {
  const [k, v, per] = sku.split("-");
  return k === "plan" ? `${PLANS.find((p) => p.id === v)?.name ?? v} plan, ${per === "yearly" ? "yearly" : "monthly"}` : `$${v} extra credits`;
};
const dateLong = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Settings, Billing: the plan, usage meters, extra credits and the spend limit, plans, payments and recent usage. */
export default function BillingSection({ children }: { children?: ReactNode }) {
  const { state: s, error } = useBilling();
  useCardReturn();
  if (!s) {
    return error
      ? <div className={`${box} p-5 text-[14px] text-ink/70`}>{error} <button onClick={() => void refreshBilling()} className="font-bold text-brand-ink">Try again</button></div>
      : <div className={`${box} grid h-48 place-items-center`}><Spinner className="text-brand-ink" /></div>;
  }
  const paid = s.plan.id !== "free";
  const home = modelById(s.models.agents.home) ?? LAMINA;
  const nextPlan = s.plan.next ? PLANS.find((p) => p.id === s.plan.next!.id) : null;
  const yearly = s.plan.period === "yearly";

  return (
    <div data-billing>
      <section data-plan-hero className="relative overflow-hidden rounded-[26px] bg-grape p-5 text-white sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-white/[.06]" />
        <span className="label text-[9px] text-white/70">Current plan</span>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span data-current-plan className="display text-[44px] leading-none max-[430px]:text-[38px]">{s.plan.name}</span>
          {paid && <span data-plan-period className="label self-center whitespace-nowrap rounded-full bg-white/20 px-2 py-1 text-[8.5px]">{yearly ? "Yearly" : "Monthly"}</span>}
          <span className="text-[15px] font-semibold text-white/80">{paid ? `$${s.plan.usd} / ${yearly ? "year" : "month"}` : "Free forever"}</span>
        </div>
        {paid && s.plan.endsAt ? (
          <dl data-plan-dates className="relative mt-3 grid max-w-[460px] grid-cols-2 gap-2 text-[12.5px]">
            <div className="min-w-0 rounded-2xl bg-white/12 px-3 py-2.5"><dt className="text-white/70">{nextPlan ? "Ends" : "Renews"}</dt><dd data-renews className="mt-0.5 truncate text-[14px] font-bold">{yearly ? dateLong(s.plan.endsAt) : dateShort(s.plan.endsAt)}</dd></div>
            <div className="min-w-0 rounded-2xl bg-white/12 px-3 py-2.5"><dt className="text-white/70">Usage refills</dt><dd data-refills className="mt-0.5 truncate text-[14px] font-bold">{s.plan.refillsAt && s.plan.refillsAt < s.plan.endsAt ? dateShort(s.plan.refillsAt) : yearly ? "Monthly" : "On renewal"}</dd></div>
          </dl>
        ) : null}
        <p className="relative mt-2 max-w-[460px] text-[13.5px] leading-snug text-white/85">
          {paid ? <>{s.plan.seats} seats.{yearly ? " Billed once a year from your balance; your Lamina and premium usage refill every month." : " Renew any time; days add on to the end."}{nextPlan ? ` ${nextPlan.name} ${s.plan.next!.period} is booked from ${dateShort(s.plan.next!.startsAt)}.` : ""}</> : "Lamina every day, your own agent, its computer and memory. Upgrade for Lamina all month and premium models."}
        </p>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <button data-open-topup onClick={() => openTopUp({ product: "credits" })} className="btn btn-white btn-sm !h-11"><Icon name="wallet" size={16} />Top up</button>
          <button data-change-plan onClick={() => openUpgrade("plans")} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-[14px] font-bold transition hover:bg-white/25">{paid ? "Renew or change plan" : "Upgrade to Pro"}</button>
        </div>
      </section>

      <H right={<span className="text-[12px] font-semibold text-ink/50">{paid ? `${yearly ? "This month" : "Cycle"} ${dateShort(s.usage.cycleStart)} to ${dateShort(s.usage.cycleEnd)}` : "Free refills every day"}</span>}>Usage</H>
      <div className={`${box} p-5`}><UsageMeters s={s} /></div>

      <div className={`${box} mt-3 divide-y divide-[var(--line)] px-5`}>
        <Line title="Spend limit" desc={s.spend.mode === "fixed" ? `Extra credits can spend up to ${money(s.spend.limit)} each ${paid ? "cycle" : "month"}.` : s.spend.mode === "unlimited" ? "Extra credits run until the balance is used." : "Extra credits are never used automatically."}>
          <button data-open-spend onClick={openSpend} className={smallBtn}>{s.spend.mode === "fixed" ? money(s.spend.limit) : s.spend.mode === "unlimited" ? "Unlimited" : "Disabled"}<Icon name="right" size={14} /></button>
        </Line>
        <Line title="Extra credits" desc="$5, $10 or $25 by card or USDC. Used after your included usage. Credits stay on Lexari and can't be withdrawn.">
          <button onClick={() => openTopUp({ product: "credits" })} className={smallBtn}><Icon name="plus" size={14} />Add</button>
        </Line>
      </div>

      <H>Models</H>
      <div className={`${box} divide-y divide-[var(--line)] px-5`}>
        <Line title="Default model" desc={`Your agent answers with ${home.label} unless a chat picks another. Change it here or from the model chip in any chat.`}>
          <button data-default-model={home.id} onClick={() => openModels("home", "home", false)} className={smallBtn}>{home.pool === "lamina" ? <LaminaMark size={14} /> : <ModelMark m={home} size={18} />}{home.short}<Icon name="right" size={14} className="rotate-90" /></button>
        </Line>
        <div className="flex items-center gap-3 py-4">
          <ModelMark m={LAMINA} size={40} />
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[15px] font-semibold text-ink">Lamina<span className="label rounded-full bg-grape px-1.5 py-0.5 text-[8px] text-white">Default</span></div><div className="text-[13px] leading-snug text-ink/60">{LAMINA.blurb}</div></div>
        </div>
        <div className="flex items-center gap-3 py-4">
          <div className="flex -space-x-2">{PREMIUM.slice(0, 3).map((m) => <span key={m.id} className="rounded-[14px] ring-2 ring-[var(--card)]"><ModelMark m={m} size={32} /></span>)}</div>
          <div className="min-w-0 flex-1"><div className="text-[15px] font-semibold text-ink">Premium models</div><div className="text-[13px] leading-snug text-ink/60">{s.models.gateway ? `${PREMIUM.map((m) => m.short).join(", ")}. Pick one per agent or per chat from the model chip.` : "Claude, Grok and Gemini are coming soon on Lexari."}</div></div>
          {!s.models.gateway && <span className="label rounded-full bg-tint px-2 py-1 text-[8.5px] text-ink/60">Soon</span>}
        </div>
      </div>

      <H>Plans</H>
      <PlansGrid />

      <Payments s={s} />
      <Recent s={s} />
      {children}
      {s.dev && <DevTools s={s} />}
    </div>
  );
}

function Line({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return <div className="flex items-center gap-4 py-4"><div className="min-w-0 flex-1"><div className="text-[15px] font-semibold text-ink">{title}</div><div className="mt-0.5 text-[13px] leading-snug text-ink/60">{desc}</div></div><div className="shrink-0">{children}</div></div>;
}

function Payments({ s }: { s: BillingState }) {
  const list = s.payments.filter((p) => p.status === "paid" || p.status === "pending").slice(0, 8);
  const [checking, setChecking] = useState<string | null>(null);
  if (!list.length) return null;
  const check = async (id: string) => {
    setChecking(id);
    try { const r = await verifyPayment(id, undefined, 2); toast({ text: r.status === "paid" ? "Payment confirmed" : "Still waiting for that payment" }); }
    catch (e) { toast({ text: friendly(e, "We haven't seen that payment yet.") }); }
    finally { setChecking(null); }
  };
  return (
    <>
      <H>Payments</H>
      <ul data-payments className={`${box} divide-y divide-[var(--line)] px-5`}>
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3.5">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${p.status === "paid" ? "bg-grape/12 text-brand-ink" : "bg-tint text-ink/50"}`}><Icon name={p.product === "plan" ? "star" : "wallet"} size={16} /></span>
            <div className="min-w-0 flex-1"><div className="truncate text-[14.5px] font-semibold text-ink">{skuLabel(p.sku)}</div><div className="text-[12.5px] text-ink/55">{dateShort(p.paidAt ?? p.at)} · {p.test ? "Local test grant" : p.rail === "balance" ? "From balance" : p.rail === "card" ? "Card" : "USDC"}{p.status === "pending" ? " · waiting" : ""}</div></div>
            <span className="shrink-0 text-[14px] font-bold tabular-nums text-ink">${(p.amountMinor / MICROS).toFixed(p.amountMinor % MICROS ? 2 : 0)}</span>
            {p.status === "pending" ? <button onClick={() => check(p.id)} disabled={checking === p.id} className="shrink-0 text-[12.5px] font-bold text-brand-ink disabled:opacity-50">{checking === p.id ? "Checking…" : "Check"}</button>
              : p.txSig && !p.txSig.startsWith("dev-") && p.rail === "crypto" ? <a href={`https://explorer.solana.com/tx/${p.txSig}${s.rails.crypto.cluster === "mainnet-beta" ? "" : `?cluster=${s.rails.crypto.cluster}`}`} target="_blank" rel="noreferrer" aria-label="View on Solana Explorer" className="shrink-0 text-ink/40 hover:text-brand-ink"><Icon name="globe" size={16} /></a> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function Recent({ s }: { s: BillingState }) {
  if (!s.recent.length) return null;
  return (
    <>
      <H>Recent usage</H>
      <ul data-recent-usage className={`${box} divide-y divide-[var(--line)] px-5`}>
        {s.recent.slice(0, 8).map((r, i) => {
          const m = modelById(r.model) ?? LAMINA;
          return (
            <li key={i} className="flex items-center gap-3 py-3">
              <ModelMark m={m} size={30} />
              <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold text-ink">{m.label}{r.agent ? <span className="font-normal text-ink/55"> · {r.agent}</span> : null}</div><div className="text-[12px] text-ink/50">{new Date(r.at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{r.tokens ? ` · ${r.tokens.toLocaleString()} tokens` : ""}</div></div>
              <span className="shrink-0 text-right text-[12.5px] font-bold tabular-nums text-ink">{r.pool === "free" ? "Free" : r.pool === "lamina" ? <span className="inline-flex items-center gap-1"><LaminaMark size={12} className="text-brand-ink" />Included</span> : money(r.billed, { cents: true })}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Local development only (the server answers 404 otherwise): switch plans and fill meters without paying. */
function DevTools({ s }: { s: BillingState }) {
  const [busy, setBusy] = useState("");
  const run = async (k: string, body: Record<string, unknown>) => {
    setBusy(k);
    try {
      await devBilling(body);
      if (body.action === "plan" || body.action === "free") { const r = await refreshBilling(); if (r) setPlan(r.plan.id as PlanId, r.plan.seats, r.plan.endsAt); }
    } catch (e) { toast({ text: friendly(e, "Dev action failed.") }); }
    finally { setBusy(""); }
  };
  const b = (k: string, label: string, body: Record<string, unknown>) => <button key={k} data-dev={k} onClick={() => run(k, body)} disabled={!!busy} className="h-9 rounded-full bg-card px-3.5 text-[13px] font-bold text-ink ring-1 ring-line transition hover:ring-grape disabled:opacity-50">{busy === k ? "…" : label}</button>;
  return (
    <section data-dev-billing className="mt-7 rounded-[22px] border-2 border-dashed border-[#f5a524]/60 p-4">
      <div className="label text-[9px] text-[#c98410]">Local dev only · not in production</div>
      <p className="mt-1 text-[12.5px] text-ink/60">Grants go through the same entitlement service as real payments. Plan: {s.plan.name}. Lamina via {s.models.laminaVia}.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {b("free", "Free", { action: "free" })}{b("pro", "Grant Pro", { action: "plan", id: "pro" })}{b("proy", "Grant Pro yearly", { action: "plan", id: "pro", period: "yearly" })}{b("plus", "Grant Max", { action: "plan", id: "plus" })}
        {b("c10", "+$10 credits", { action: "credits", usd: 10 })}
        {s.usage.free ? <>{b("f90", "Today 90%", { action: "use", pool: "lamina", share: 0.9 })}{b("f100", "Use all today", { action: "use", pool: "lamina", share: 1 })}</>
          : <>{b("l90", "Lamina 90%", { action: "use", pool: "lamina", share: 0.9 })}{b("l100", "Lamina 100%", { action: "use", pool: "lamina", share: 1 })}{b("p100", "Premium 100%", { action: "use", pool: "premium", share: 1 })}</>}
        {b("reset", "Reset usage", { action: "reset" })}
      </div>
    </section>
  );
}

/** Back from a hosted card checkout (?payment=id): confirm it with the provider and celebrate. */
function useCardReturn() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("payment");
    if (!id) return;
    done.current = true;
    url.searchParams.delete("payment");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    verifyPayment(id, undefined, 4).then((r) => {
      if (r.status !== "paid") { toast({ text: "Your card payment is still processing. We'll update this page when it lands." }); return; }
      const p = r.state.payments.find((x) => x.id === id);
      if (p?.product === "plan") setPlan(r.state.plan.id as PlanId, r.state.plan.seats, r.state.plan.endsAt);
      celebrate({ confetti: p?.product === "plan" ? "big" : true, title: p ? (p.product === "plan" ? `${skuLabel(p.sku).replace(/, (monthly|yearly)$/, "")} is yours` : `${skuLabel(p.sku)} added`) : "Payment received", body: "Thanks for supporting Lexari." });
    }).catch((e) => toast({ text: friendly(e, "We couldn't confirm the card payment yet.") }));
  }, []);
}
