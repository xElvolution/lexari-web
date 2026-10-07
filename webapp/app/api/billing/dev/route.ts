import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { itemFor } from "@/server/billing/catalog";
import { markPaid } from "@/server/billing/entitlements";
import { billingState } from "@/server/billing/state";
import { db } from "@/server/db";
import { billingSettings, payments, usageHolds, usageLedger, usagePeriods } from "@/server/db/billingSchema";
import { planPurchases } from "@/server/db/schema";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/**
 * LOCAL DEVELOPMENT ONLY. Grants a plan or credits without paying (through the same entitlements service), resets
 * usage, or fills a pool, so plan switching and out-of-usage states can be tested. It answers 404 unless the server
 * runs `next dev` (NODE_ENV is always "production" under `next start`) AND LEXARI_DEV_BILLING=1.
 */
const on = () => process.env.NODE_ENV !== "production" && process.env.LEXARI_DEV_BILLING === "1";
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan"), id: z.enum(["pro", "plus"]) }),
  z.object({ action: z.literal("credits"), usd: z.number().int().min(1).max(100) }),
  z.object({ action: z.literal("free") }),
  z.object({ action: z.literal("use"), pool: z.enum(["lamina", "premium"]), share: z.number().min(0).max(1) }),
  z.object({ action: z.literal("reset") }),
]);

export const POST = withUser(async (user, req) => {
  if (!on()) return jsonError(404, "Not found.");
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const database = db();
  if (b.action === "plan" || b.action === "credits") {
    const item = b.action === "plan" ? itemFor("plan", b.id) : { product: "credits" as const, sku: `credits-${b.usd}`, usd: b.usd };
    if (b.action === "credits" && ![5, 10, 25].includes(b.usd)) return jsonError(400, "Use 5, 10 or 25.");
    const [p] = await database.insert(payments).values({ userId: user.userId, rail: "crypto", provider: "dev", product: item.product, sku: item.sku, amountMinor: item.usd * 1_000_000, currency: "USDC", meta: { dev: true } }).returning();
    await markPaid(p.id, { txSig: `dev-${p.id}` });
  } else if (b.action === "free") {
    await database.delete(planPurchases).where(eq(planPurchases.userId, user.userId));
  } else if (b.action === "use") {
    const col = b.pool === "lamina" ? { laminaUsed: sql`round(${usagePeriods.laminaLimit} * ${b.share}::numeric)` } : { premiumUsed: sql`round(${usagePeriods.premiumLimit} * ${b.share}::numeric)` };
    await database.update(usagePeriods).set(col).where(and(eq(usagePeriods.userId, user.userId), sql`${usagePeriods.periodEnd} > now()`));
  } else {
    await database.delete(usageLedger).where(eq(usageLedger.userId, user.userId));
    await database.delete(usageHolds).where(eq(usageHolds.userId, user.userId));
    await database.delete(usagePeriods).where(eq(usagePeriods.userId, user.userId));
    await database.update(billingSettings).set({ creditMicros: 0 }).where(eq(billingSettings.userId, user.userId));
  }
  return Response.json(await billingState(user.userId));
});
