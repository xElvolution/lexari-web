/**
 * The one place that turns a confirmed payment into what was bought, for every rail (card provider webhook, USDC on
 * Solana, the dev grant). Idempotent: a payment row flips from pending to paid once, and only that flip grants.
 * Plans are written to plan_purchases (which server/plans.ts already reads for seats); credits to credit_ledger with
 * the cached balance in billing_settings.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { PLANS, planById } from "@/content/appData";
import { DEFAULT_SPEND_LIMIT_USD, MICROS } from "@/content/billing";
import { db } from "../db";
import { billingSettings, creditLedger, payments } from "../db/billingSchema";
import { planPurchases } from "../db/schema";
import { recordEvent } from "../events";
import { notify } from "../notify";
import { itemFromSku } from "./catalog";
import { usdToMicros } from "./math";
import { schedulePlan } from "./schedule";

export type Granted = { paymentId: string; product: "plan" | "credits"; sku: string; already: boolean; plan?: { id: string; startsAt: number; expiresAt: number }; creditsUsd?: number };

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
      const now = Date.now();
      const active = await tx.select().from(planPurchases).where(and(eq(planPurchases.userId, p.userId), gt(planPurchases.expiresAt, new Date(now))));
      const when = schedulePlan(now, { id: item.planId, seats: item.seats ?? 1 }, active.map((a) => ({ plan: a.plan, seats: planById(a.plan).seats, startsAt: (a.startsAt ?? a.createdAt).getTime(), expiresAt: a.expiresAt.getTime() })));
      await tx.insert(planPurchases).values({
        userId: p.userId, plan: item.planId, tx: proof.txSig || `${p.rail}:${proof.providerRef || p.providerRef || p.id}`, amount: p.amountMinor, payer: proof.payer || p.payer || "",
        startsAt: new Date(when.startsAt), expiresAt: new Date(when.expiresAt), paymentId: p.id,
      });
      return { paymentId, product: "plan" as const, sku: p.sku, already: false, userId: p.userId, plan: { id: item.planId, ...when } };
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
      const name = PLANS.find((x) => x.id === granted.plan!.id)?.name ?? "your plan";
      const later = granted.plan.startsAt > Date.now() + 60_000;
      await recordEvent(userId, "plan", { ref: paymentId }).catch(() => {});
      await notify(userId, { kind: "payment", title: `Payment confirmed: ${name}`, body: later ? `${name} starts on ${new Date(granted.plan.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, right after your current plan.` : `You're on ${name} until ${new Date(granted.plan.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Your usage pools are full.`, url: "/settings#billing", key: `pay:${paymentId}` });
    } else {
      await notify(userId, { kind: "payment", title: `Topped up $${granted.creditsUsd} of credits`, body: "They're used after your included usage, within your spend limit.", url: "/settings#billing", key: `pay:${paymentId}` });
    }
  }
  return granted;
}
