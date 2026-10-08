/**
 * The one place that turns a confirmed payment into what was bought, for every rail (card provider webhook, USDC on
 * Solana, the dev grant). Idempotent: a payment row flips from pending to paid once, and only that flip grants.
 * Plans are written to plan_purchases (which server/plans.ts already reads for seats); credits to credit_ledger with
 * the cached balance in billing_settings.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { PLANS, isPeriod, planById, type Period } from "@/content/appData";
import { DEFAULT_SPEND_LIMIT_USD, MICROS } from "@/content/billing";
import { db } from "../db";
import { billingSettings, creditLedger, payments } from "../db/billingSchema";
import { planPurchases } from "../db/schema";
import { recordEvent } from "../events";
import { notify } from "../notify";
import { itemFromSku, type Item } from "./catalog";
import { usdToMicros } from "./math";
import { schedulePlan } from "./schedule";

export type Granted = { paymentId: string; product: "plan" | "credits"; sku: string; already: boolean; plan?: { id: string; period: Period; startsAt: number; expiresAt: number }; creditsUsd?: number };
type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

/** The live purchases a new one is scheduled against (inside the caller's transaction). */
export async function livePurchases(tx: Tx | ReturnType<typeof db>, userId: string, now = Date.now()) {
  const rows = await tx.select().from(planPurchases).where(and(eq(planPurchases.userId, userId), gt(planPurchases.expiresAt, new Date(now))));
  return rows.map((a) => ({ id: a.id, plan: a.plan, seats: planById(a.plan).seats, period: (isPeriod(a.period) ? a.period : "monthly") as Period, startsAt: (a.startsAt ?? a.createdAt).getTime(), expiresAt: a.expiresAt.getTime() }));
}

/**
 * Writes a plan purchase (any rail, or the balance): schedules it against what's active, pauses smaller plans an
 * upgrade replaces (they resume afterwards with the days they had left), and inserts the plan_purchases row.
 */
export async function grantPlan(tx: Tx, userId: string, item: Item, src: { tx: string; amount: number; payer: string; paymentId?: string | null }) {
  const now = Date.now();
  const when = schedulePlan(now, { id: item.planId!, seats: item.seats ?? 1, period: item.period ?? "monthly" }, await livePurchases(tx, userId, now));
  for (const s of when.shift) await tx.update(planPurchases).set({ startsAt: new Date(s.startsAt), expiresAt: new Date(s.expiresAt) }).where(and(eq(planPurchases.id, s.id), eq(planPurchases.userId, userId)));
  const [row] = await tx.insert(planPurchases).values({
    userId, plan: item.planId!, tx: src.tx, amount: src.amount, payer: src.payer, period: item.period ?? "monthly",
    startsAt: new Date(when.startsAt), expiresAt: new Date(when.expiresAt), paymentId: src.paymentId ?? null,
  }).returning({ id: planPurchases.id });
  return { ...when, purchaseId: row.id };
}

/** "Payment confirmed" for a plan: the notification and the Hub event, after the transaction commits. */
export async function announcePlan(userId: string, ref: string, plan: { id: string; period: Period; startsAt: number; expiresAt: number }, via: string) {
  const name = PLANS.find((x) => x.id === plan.id)?.name ?? "your plan";
  const later = plan.startsAt > Date.now() + 60_000;
  const d = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(plan.period === "yearly" ? { year: "numeric" } : {}) });
  const label = `${name} ${plan.period === "yearly" ? "yearly" : "monthly"}`;
  await recordEvent(userId, "plan", { ref }).catch(() => {});
  await notify(userId, {
    kind: "payment", title: `${via}: ${label}`, url: "/settings#billing", key: `pay:${ref}`,
    body: later ? `${label} starts on ${d(plan.startsAt)}, right after your current plan.` : `You're on ${label} until ${d(plan.expiresAt)}.${plan.period === "yearly" ? " Your usage refills every month." : " Your usage pools are full."}`,
  });
}

export async function markPaid(paymentId: string, proof: { txSig?: string; providerRef?: string; payer?: string }): Promise<Granted> {
  const database = db();
  const out = await database.transaction(async (tx) => {
    const [p] = await tx.update(payments).set({ status: "paid", paidAt: new Date(), ...(proof.txSig ? { txSig: proof.txSig } : {}), ...(proof.payer ? { payer: proof.payer } : {}) })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "pending"))).returning();
    if (!p) {
      const [cur] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
      if (!cur) throw new Error("payment not found");
      return { paymentId, product: cur.product as "plan" | "credits", sku: cur.sku, already: true, userId: cur.userId };
    }
    const item = itemFromSku(p.sku);
    if (item.product === "plan" && item.planId) {
      // Already paid: the purchase is granted even when it would be blocked at checkout (it is booked after what's active).
      const when = await grantPlan(tx, p.userId, item, { tx: proof.txSig || `${p.rail}:${proof.providerRef || p.providerRef || p.id}`, amount: p.amountMinor, payer: proof.payer || p.payer || "", paymentId: p.id });
      return { paymentId, product: "plan" as const, sku: p.sku, already: false, userId: p.userId, plan: { id: item.planId, period: item.period ?? "monthly", startsAt: when.startsAt, expiresAt: when.expiresAt } };
    }
    const micros = usdToMicros(item.creditsUsd ?? 0);
    await tx.insert(billingSettings).values({ userId: p.userId, spendLimit: usdToMicros(DEFAULT_SPEND_LIMIT_USD) }).onConflictDoNothing();
    await tx.update(billingSettings).set({ creditMicros: sql`${billingSettings.creditMicros} + ${micros}`, updatedAt: new Date() }).where(eq(billingSettings.userId, p.userId));
    await tx.insert(creditLedger).values({ userId: p.userId, delta: micros, reason: p.rail === "card" ? "topup_card" : p.provider === "dev" ? "dev_grant" : "topup_crypto", ref: `payment:${p.id}` });
    return { paymentId, product: "credits" as const, sku: p.sku, already: false, userId: p.userId, creditsUsd: micros / MICROS };
  });
  const { userId, ...granted } = out;
  if (!granted.already) {
    if (granted.product === "plan" && granted.plan) {
      await announcePlan(userId, paymentId, granted.plan, "Payment confirmed");
    } else {
      await notify(userId, { kind: "payment", title: `Topped up $${granted.creditsUsd} of credits`, body: "They're used after your included usage, within your spend limit.", url: "/settings#billing", key: `pay:${paymentId}` });
    }
  }
  return granted;
}
