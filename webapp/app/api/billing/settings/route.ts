import { z } from "zod";
import { DEFAULT_SPEND_LIMIT_USD } from "@/content/billing";
import { usdToMicros } from "@/server/billing/math";
import { billingState } from "@/server/billing/state";
import { db } from "@/server/db";
import { billingSettings } from "@/server/db/billingSchema";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { eq } from "drizzle-orm";
import { requireStepUp } from "@/server/security";

export const runtime = "nodejs";

const body = z.object({ spendMode: z.enum(["disabled", "fixed", "unlimited"]), spendLimitUsd: z.number().int().min(1).max(10_000).optional() });

/** The monthly spend limit on extra credits. Changes apply to the next turn. */
export const PUT = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const limit = usdToMicros(b.spendLimitUsd ?? DEFAULT_SPEND_LIMIT_USD);
  const [cur] = await db().select({ mode: billingSettings.spendMode, limit: billingSettings.spendLimit }).from(billingSettings).where(eq(billingSettings.userId, user.userId)).limit(1);
  const curLimit = cur?.limit ?? usdToMicros(DEFAULT_SPEND_LIMIT_USD);
  const raises = (b.spendMode === "unlimited" && cur?.mode !== "unlimited") || (b.spendMode === "fixed" && !!b.spendLimitUsd && limit > curLimit && cur?.mode !== "unlimited");
  if (raises) requireStepUp(user, "raise your spend limit");
  await db().insert(billingSettings).values({ userId: user.userId, spendMode: b.spendMode, spendLimit: limit })
    .onConflictDoUpdate({ target: billingSettings.userId, set: { spendMode: b.spendMode, ...(b.spendLimitUsd ? { spendLimit: limit } : {}), updatedAt: new Date() } });
  return Response.json(await billingState(user.userId));
});
