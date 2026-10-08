import { z } from "zod";
import { PERIODS } from "@/content/appData";
import { buyPlanWithBalance } from "@/server/billing/planPurchase";
import { billingState } from "@/server/billing/state";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

// No price in the body: the server prices the plan and period from the catalog.
const body = z.object({ plan: z.enum(["pro", "plus"]), period: z.enum(PERIODS), key: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/) }).strict();

/** Buys a plan (monthly or yearly) from your Lexari balance. 402 with the shortfall when the balance is short. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (!(await rateLimit(`plan:${user.userId}`, 30, 3_600_000))) return jsonError(429, "Too many attempts. Try again in a while.");
  const r = await buyPlanWithBalance(user.userId, b.plan, b.period, b.key);
  return Response.json({ ok: true, ...r, state: await billingState(user.userId) });
});
