/** Everything the app shows about models and billing, in one read. */
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { PLANS } from "@/content/appData";
import { RENEW_REMIND_DAYS, type SpendMode } from "@/content/billing";
import { LAMINA, MODELS } from "@/content/models";
import { cluster, treasury, usdcMint } from "../config";
import { db } from "../db";
import { payments, usageLedger } from "../db/billingSchema";
import { agents, chats, planPurchases } from "../db/schema";
import { modelReady } from "../engram/cortex";
import { gatewayReady } from "../engram/gateway";
import { notify } from "../notify";
import { cryptoReady } from "./crypto";
import { creditsAvailable } from "./math";
import { cycleFor, snapshot } from "./meter";
import { cardProvider } from "./payments/card";

export async function billingState(userId: string) {
  const database = db();
  const cycle = await cycleFor(userId);
  const [snap, agentRows, chatRows, pays, usage, queued] = await Promise.all([
    snapshot(database, userId, cycle),
    database.select({ slug: agents.slug, model: agents.model }).from(agents).where(eq(agents.userId, userId)),
    database.select({ slug: chats.slug, model: chats.model }).from(chats).where(and(eq(chats.userId, userId), isNotNull(chats.model))),
    database.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)).limit(12),
    database.select().from(usageLedger).where(eq(usageLedger.userId, userId)).orderBy(desc(usageLedger.createdAt)).limit(12),
    database.select({ plan: planPurchases.plan, startsAt: planPurchases.startsAt, expiresAt: planPurchases.expiresAt }).from(planPurchases).where(eq(planPurchases.userId, userId)).orderBy(desc(planPurchases.expiresAt)).limit(5),
  ]);
  const { period, settings, meter } = snap;
  const now = Date.now();
  const next = queued.find((q) => q.startsAt && q.startsAt.getTime() > now);
  const info = PLANS.find((p) => p.id === cycle.plan.id) ?? PLANS[0];
  // Lexari runs the billing cycle itself: a reminder a few days before a paid cycle ends, unless a renewal is queued.
  if (cycle.paid && cycle.plan.purchaseId && !next && cycle.end.getTime() - now < RENEW_REMIND_DAYS * 86_400_000) {
    void notify(userId, { kind: "payment", key: `renew:${cycle.plan.purchaseId}`, url: "/settings#billing", title: `${info.name} renews on ${cycle.end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, body: "Pay for the next 30 days by card or USDC to keep your usage and seats." });
  }
  const card = cardProvider();
  return {
    plan: { id: cycle.plan.id, name: info.name, seats: cycle.plan.seats, usd: info.usd, startsAt: cycle.paid ? cycle.start.getTime() : null, endsAt: cycle.paid ? cycle.end.getTime() : null, next: next ? { id: next.plan, startsAt: next.startsAt!.getTime() } : null },
    usage: {
      lamina: { used: period.laminaUsed, limit: period.laminaLimit },
      premium: { used: period.premiumUsed, limit: period.premiumLimit },
      // Free: the Lamina meter above is today's allowance (shown as a percentage); it refills at resetsAt.
      free: cycle.paid ? null : { resetsAt: cycle.end.getTime() },
      cycleStart: cycle.start.getTime(), cycleEnd: cycle.end.getTime(),
    },
    credits: { balance: Math.max(0, settings.creditMicros), spent: cycle.paid ? period.creditsUsed : meter.creditsSpent, available: creditsAvailable(meter) },
    spend: { mode: settings.spendMode as SpendMode, limit: settings.spendLimit },
    models: {
      gateway: gatewayReady(),
      available: Object.fromEntries(MODELS.map((m) => [m.id, modelReady(m)])),
      laminaVia: gatewayReady() ? "gateway" : "relay",
      agents: Object.fromEntries(agentRows.map((a) => [a.slug, a.model || LAMINA.id])),
      chats: Object.fromEntries(chatRows.map((c) => [c.slug, c.model!])),
    },
    rails: {
      card: card ? { ready: true, label: card.label } : { ready: false, label: "Card" },
      crypto: { ready: cryptoReady(), mint: usdcMint(), treasury: treasury(), cluster: cluster() },
    },
    payments: pays.map((p) => ({ id: p.id, rail: p.rail, test: p.provider === "dev", product: p.product, sku: p.sku, status: p.status === "pending" && p.expiresAt && p.expiresAt.getTime() < now ? "expired" : p.status, amountMinor: p.amountMinor, currency: p.currency, txSig: p.txSig, at: p.createdAt.getTime(), paidAt: p.paidAt?.getTime() ?? null })),
    recent: usage.map((u) => ({ at: u.createdAt.getTime(), model: u.requestedModel, pool: u.pool, billed: u.billedMicros, cost: u.costMicros, tokens: u.promptTokens + u.completionTokens, agent: u.agentSlug, kind: u.kind })),
    dev: process.env.NODE_ENV !== "production" && process.env.LEXARI_DEV_BILLING === "1",
  };
}
export type BillingState = Awaited<ReturnType<typeof billingState>>;
