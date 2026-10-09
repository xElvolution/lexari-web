import { appOrigin } from "@/server/config";
import { clientIp, jsonError, rateLimit } from "@/server/http";
import { paymentRequired, paymentResponse, requirements, settlePayment } from "@/server/agentpay/x402";
import { serviceById } from "@/server/agentpay/services";

export const runtime = "nodejs";

/** A Lexari x402 service: 402 with payment requirements, or the resource once an X-PAYMENT (devnet USDC) settles. */
export async function GET(req: Request, ctx: { params: Promise<{ service: string }> }) {
  const { service } = await ctx.params;
  const s = serviceById(service);
  if (!s) return jsonError(404, "No such service.");
  const ip = clientIp(req);
  if (!(await rateLimit(`x402:${ip}`, 120, 60_000))) return jsonError(429, "Slow down.");
  const url = new URL(req.url);
  const origin = appOrigin()?.uri || url.origin;
  const reqs = requirements(`${origin}/api/x402/${s.id}${url.search}`, s.priceAtoms, s.description);
  const header = req.headers.get("x-payment");
  if (!header) return paymentRequired(reqs);
  const paid = await settlePayment(header, reqs, s.id);
  if (!paid.ok) return paymentRequired(reqs, paid.error);
  const data = await s.run(url.searchParams).catch((e: Error) => ({ error: e.message.slice(0, 120) }));
  return Response.json({ service: s.id, data }, { headers: { "X-PAYMENT-RESPONSE": paymentResponse(paid.sig, paid.payer), "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE" } });
}
