/** Everything the app shows about models and billing, in one read. */
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { PLANS, planPrice } from "@/content/appData";
import { RENEW_REMIND_DAYS, type SpendMode } from "@/content/billing";
import { LAMINA, MODELS } from "@/content/models";
import { cluster, treasury, usdcMint } from "../config";
import { db } from "../db";
import { creditLedger, payments, usageLedger } from "../db/billingSchema";
import { planSku } from "./catalog";
import { agents, chats, planPurchases } from "../db/schema";
import { modelReady } from "../engram/cortex";
import { gatewayReady } from "../engram/gateway";
import { notify } from "../notify";
import { cryptoReady } from "./crypto";
import { creditsAvailable } from "./math";
import { cycleFor, snapshot } from "./meter";
import { cardProvider } from "./payments/card";
import { planOffers } from "./planPurchase";
import { accountDefault, getPrefs, listKeys } from "../models";
import { secretBoxReady } from "../secretBox";

export async function billingState(userId: string) {
  const database = db();
  const cycle = await cycleFor(userId);
  const [snap, agentRows, chatRows, pays, usage, queued, offers, balancePlans, keys, def, prefs] = await Promise.all([
    snapshot(database, userId, cycle),
    database.select({ slug: agents.slug, model: agents.model }).from(agents).where(eq(agents.userId, userId)),
    database.select({ slug: chats.slug, model: chats.model }).from(chats).where(and(eq(chats.userId, userId), isNotNull(chats.model))),
    database.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)).limit(12),
    database.select().from(usageLedger).where(eq(usageLedger.userId, userId)).orderBy(desc(usageLedger.createdAt)).limit(12),
    database.select({ plan: planPurchases.plan, period: planPurchases.period, startsAt: planPurchases.startsAt, expiresAt: planPurchases.expiresAt }).from(planPurchases).where(eq(planPurchases.userId, userId)).orderBy(desc(planPurchases.expiresAt)).limit(5),
    planOffers(userId),
    database.select().from(creditLedger).where(and(eq(creditLedger.userId, userId), eq(creditLedger.reason, "plan"))).orderBy(desc(creditLedger.createdAt)).limit(12),
    listKeys(userId).catch(() => []),
    accountDefault(userId).catch(() => null),
    getPrefs(userId).catch(() => ({})),
  ]);
  const { period, settings, meter } = snap;
  const now = Date.now();
  const next = queued.filter((q) => q.startsAt && q.startsAt.getTime() > now).sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime())[0];
  const info = PLANS.find((p) => p.id === cycle.plan.id) ?? PLANS[0];
  const planPeriod = cycle.paid ? cycle.plan.period ?? "monthly" : null;
  // When the plan itself ends (for yearly, a year out; the usage cycle below is one month of it).
  const planEnds = cycle.paid ? cycle.plan.expiresAt ?? cycle.end.getTime() : null;
  // Lexari runs the billing cycle itself: a reminder a few days before the plan ends, unless a renewal is queued.
  if (cycle.paid && cycle.plan.purchaseId && planEnds && !next && planEnds - now < RENEW_REMIND_DAYS * 86_400_000) {
    void notify(userId, { kind: "payment", key: `renew:${cycle.plan.purchaseId}`, url: "/settings#billing", title: `${info.name} renews on ${new Date(planEnds).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, body: `Renew ${planPeriod === "yearly" ? "for another year" : "for the next 30 days"} from your balance to keep your usage and seats.` });
  }
  const card = cardProvider();
  return {
    plan: {
      id: cycle.plan.id, name: info.name, seats: cycle.plan.seats, period: planPeriod,
      /** what this plan cost for its period ($20 a month, $200 a year) */
      usd: planPeriod ? planPrice(info, planPeriod) : 0,
      startsAt: cycle.paid ? cycle.plan.startsAt : null,
      /** when the plan ends (renewal date); for yearly this is a year out */
      endsAt: planEnds,
      /** when the usage pools refill next (end of this month's cycle) */
      refillsAt: cycle.paid ? cycle.end.getTime() : null,
      next: next ? { id: next.plan, period: next.period === "yearly" ? "yearly" as const : "monthly" as const, startsAt: next.startsAt!.getTime() } : null,
    },
    /** what buying each plan and period would do now, keyed "pro:yearly" (start now, renew, queue or blocked) */
    offers,
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
      /** an agent's own pick, or null when it follows the account default */
      agents: Object.fromEntries(agentRows.map((a) => [a.slug, a.model || null])) as Record<string, string | null>,
      /** the account default (Settings > Models) */
      default: def || LAMINA.id,
      /** your API keys (masked) and your model switches (Settings > Models) */
      keys,
      prefs,
      /** this server can store API keys (MODEL_KEYS_SECRET set) */
      byoReady: secretBoxReady(),
      chats: Object.fromEntries(chatRows.map((c) => [c.slug, c.model!])),
    },
    rails: {
      card: card ? { ready: true, label: card.label } : { ready: false, label: "Card" },
      crypto: { ready: cryptoReady(), mint: usdcMint(), treasury: treasury(), cluster: cluster() },
    },
    payments: [
      ...pays.map((p) => ({ id: p.id, rail: p.rail, test: p.provider === "dev", product: p.product, sku: p.sku, status: p.status === "pending" && p.expiresAt && p.expiresAt.getTime() < now ? "expired" : p.status, amountMinor: p.amountMinor, currency: p.currency, txSig: p.txSig as string | null, at: p.createdAt.getTime(), paidAt: p.paidAt?.getTime() ?? null })),
      // plans paid from the Lexari balance (ref plan:<user>:<key>:<plan>:<period>), in micro dollars like USDC
      ...balancePlans.map((r) => { const [, , , id, per] = (r.ref || "").split(":"); return { id: r.id, rail: "balance", test: false, product: "plan", sku: planSku(id || "pro", per === "yearly" ? "yearly" : "monthly"), status: "paid", amountMinor: -r.delta, currency: "USD", txSig: null as string | null, at: r.createdAt.getTime(), paidAt: r.createdAt.getTime() }; }),
    ].sort((a, b) => b.at - a.at).slice(0, 12),
    recent: usage.map((u) => ({ at: u.createdAt.getTime(), model: u.requestedModel, pool: u.pool, billed: u.billedMicros, cost: u.costMicros, tokens: u.promptTokens + u.completionTokens, agent: u.agentSlug, kind: u.kind })),
    dev: process.env.NODE_ENV !== "production" && process.env.LEXARI_DEV_BILLING === "1",
  };
}
export type BillingState = Awaited<ReturnType<typeof billingState>>;
