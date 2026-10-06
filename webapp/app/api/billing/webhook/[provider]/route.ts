import { and, eq } from "drizzle-orm";
import { markPaid } from "@/server/billing/entitlements";
import { cardProviderById } from "@/server/billing/payments/card";
import { db } from "@/server/db";
import { payments } from "@/server/db/billingSchema";
import { jsonError } from "@/server/http";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ provider: string }> };

/** Card provider webhooks. The adapter verifies the signature on the raw body; only then is the payment granted, once. */
export async function POST(req: Request, ctx: Ctx) {
  const { provider: id } = await ctx.params;
  const provider = cardProviderById(id);
  if (!provider) return jsonError(404, "Not found.");
  const raw = await req.text();
  let ev;
  try { ev = await provider.verifyWebhook(req, raw); } catch (e) { console.error(`[billing] ${id} webhook: ${(e as Error).message}`); return jsonError(400, "Bad signature."); }
  if (!ev) return jsonError(400, "Bad signature.");
  const [p] = await db().select().from(payments).where(and(eq(payments.provider, id), eq(payments.providerRef, ev.providerRef))).limit(1);
  if (!p) return Response.json({ ok: true, ignored: "unknown reference" });
  if (ev.status === "paid") {
    if (ev.amountMinor !== undefined && ev.amountMinor < p.amountMinor) { console.error(`[billing] ${id} paid less than the price for ${p.id}`); return Response.json({ ok: true, ignored: "amount" }); }
    await markPaid(p.id, { providerRef: ev.providerRef });
  } else if (ev.status === "failed") {
    await db().update(payments).set({ status: "failed" }).where(and(eq(payments.id, p.id), eq(payments.status, "pending")));
  }
  return Response.json({ ok: true });
}
