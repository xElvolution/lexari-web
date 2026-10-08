"use client";

/**
 * Buying a plan (monthly or yearly) from your Lexari balance: the pay sheet confirms the price, a short balance opens
 * Top up with the shortfall and then the purchase finishes on its own (the plan and period ride along in `run`).
 */
import { PLANS, perMonth, planPrice, yearSaving, type Period, type PlanId } from "@/content/appData";
import { api } from "@/lib/api";
import { payFromBalance } from "@/lib/balance";
import { applyState, type BillingState } from "@/lib/billing";
import { setPlan } from "@/lib/store";
import { celebrate } from "./Celebrate";

const fmt = (ms: number, year = false) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
const key = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
export const offerOf = (s: BillingState | null | undefined, id: string, period: Period) => s?.offers?.[`${id}:${period}`] ?? null;

/** One line on what buying this plan does now. Empty when it simply starts today. */
export function offerNote(s: BillingState | null | undefined, id: string, period: Period) {
  const o = offerOf(s, id, period);
  const name = PLANS.find((p) => p.id === id)?.name ?? "This plan";
  if (!o) return "";
  if (o.mode === "renew") return `Starts on ${fmt(o.startsAt, period === "yearly")}, when your current ${name} ends. Nothing is lost.`;
  if (o.mode === "queued") return `Starts on ${fmt(o.startsAt)}, when your current plan ends.`;
  if (o.mode === "upgrade") return "Starts now. Your current plan pauses and picks up again afterwards with the days it had left.";
  if (o.mode === "blocked" && o.bookableFrom) return `You can book this from ${fmt(o.bookableFrom, true)}, in the last month of your current plan.`;
  return "";
}

export async function buyPlan(id: PlanId, period: Period, s: BillingState | null | undefined): Promise<boolean> {
  const plan = PLANS.find((p) => p.id === id)!;
  const usd = planPrice(plan, period);
  const yearly = period === "yearly";
  const k = key(); // one key per purchase attempt: a retry or the resume after Top up never charges twice
  const note = offerNote(s, id, period);
  const r = await payFromBalance({
    kind: "plan", title: `${plan.name}, ${yearly ? "yearly" : "monthly"}`, doing: `${plan.name} ${yearly ? "yearly" : "monthly"}`,
    what: yearly ? `12 months of ${plan.name} for $${perMonth(plan, "yearly").toFixed(2)} a month. You save $${yearSaving(plan)}. Usage refills every month.` : `30 days of ${plan.name}: ${plan.for.replace(/\.$/, "")}.`,
    usd, note: note || (yearly ? "Billed once for the year from your balance. Your Lamina and premium usage refill every month." : "Billed from your balance for 30 days. Renew any time; days add on to the end."),
    cta: () => `Pay $${usd} from balance`,
    run: () => api<{ ok: true; state: BillingState; plan: { id: string; startsAt: number; expiresAt: number } | null }>("/api/billing/plan", { body: { plan: id, period, key: k } }),
  });
  if (!r.ok) return false;
  const out = r.result as { state: BillingState; plan: { id: string; startsAt: number; expiresAt: number } | null };
  applyState(out.state);
  setPlan(out.state.plan.id as PlanId, out.state.plan.seats, out.state.plan.endsAt);
  const now = !out.plan || out.plan.startsAt <= Date.now() + 60_000;
  celebrate({
    confetti: "big",
    title: now ? `You're on ${plan.name}` : `${plan.name} is booked`,
    body: now ? `${yearly ? `Yearly until ${fmt(out.plan!.expiresAt, true)}. Usage refills every month.` : `Until ${fmt(out.plan?.expiresAt ?? Date.now())}.`} ${plan.seats} seats, Lamina all month and $${plan.premiumUsd} of premium models.` : `It starts on ${fmt(out.plan!.startsAt, yearly)}. Nothing you have now is lost.`,
  });
  return true;
}
