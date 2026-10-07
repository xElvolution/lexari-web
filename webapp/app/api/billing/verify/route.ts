import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { verifyCryptoPayment } from "@/server/billing/crypto";
import { markPaid } from "@/server/billing/entitlements";
import { cardProviderById } from "@/server/billing/payments/card";
import { billingState } from "@/server/billing/state";
import { db } from "@/server/db";
import { payments } from "@/server/db/billingSchema";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

const body = z.object({ paymentId: z.string().uuid(), sig: z.string().min(64).max(100).regex(/^[1-9A-HJ-NP-Za-km-z]+$/).optional() });

/**
 * Checks a payment and grants it once it is confirmed. Crypto: on chain (by signature, or by its reference key).
 * Card: asks the provider (when it supports a status check); otherwise the webhook grants it and this just reports.
 */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const [p] = await db().select().from(payments).where(and(eq(payments.id, b.paymentId), eq(payments.userId, user.userId))).limit(1);
  if (!p) return jsonError(404, "There is no such payment.");
  if (p.rail === "crypto") {
    const granted = await verifyCryptoPayment(user.userId, p.id, b.sig);
    return Response.json({ status: "paid", granted, state: await billingState(user.userId) });
  }
  if (p.status === "pending" && p.providerRef) {
    const provider = cardProviderById(p.provider);
    const r = provider?.fetchStatus ? await provider.fetchStatus(p.providerRef) : null;
    if (r?.status === "paid" && r.providerRef === p.providerRef && (r.amountMinor === undefined || r.amountMinor >= p.amountMinor)) {
      const granted = await markPaid(p.id, { providerRef: p.providerRef });
      return Response.json({ status: "paid", granted, state: await billingState(user.userId) });
    }
    if (r?.status === "failed") await db().update(payments).set({ status: "failed" }).where(and(eq(payments.id, p.id), eq(payments.status, "pending")));
  }
  const [cur] = await db().select({ status: payments.status }).from(payments).where(eq(payments.id, p.id)).limit(1);
  return Response.json({ status: cur?.status ?? p.status, state: await billingState(user.userId) });
});
