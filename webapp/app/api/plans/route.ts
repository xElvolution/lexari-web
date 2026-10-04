import { notify } from "@/server/notify";
import { eq } from "drizzle-orm";
import { PLAN_DAYS, PLANS, YEAR_DAYS, planPrice } from "@/content/appData";
import { db } from "@/server/db";
import { agentCards, hires, planPurchases } from "@/server/db/schema";
import { recordEvent } from "@/server/events";
import { verifyPayment } from "@/server/hires";
import { fetchConfirmed } from "@/server/hub/confirm";
import { jsonError, readJson } from "@/server/http";
import { currentPlan, seatsUsed } from "@/server/plans";
import { withUser } from "@/server/route";
import { planBuyBody } from "@/server/validate";

export const runtime = "nodejs";

export const GET = withUser(async (user) => {
  const [plan, used] = await Promise.all([currentPlan(user.userId), seatsUsed(user.userId)]);
  return Response.json({ plan, used, plans: PLANS });
});

/** Upgrade: the devnet SOL payment for the plan is checked on chain (payer, treasury, amount, fresh), then the plan is on for PLAN_DAYS. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, planBuyBody);
  if (body instanceof Response) return body;
  const plan = PLANS.find((p) => p.id === body.plan);
  if (!plan || !plan.lamports) return jsonError(400, "Pick a paid plan.");
  const database = db();
  const [used] = await database.select().from(planPurchases).where(eq(planPurchases.tx, body.tx)).limit(1);
  if (used) return used.userId === user.userId && used.plan === plan.id ? Response.json({ plan: await currentPlan(user.userId) }) : jsonError(409, "That payment was already used.");
  const [h] = await database.select({ id: hires.id }).from(hires).where(eq(hires.tx, body.tx)).limit(1);
  const [c] = await database.select({ id: agentCards.id }).from(agentCards).where(eq(agentCards.payTx, body.tx)).limit(1);
  if (h || c) return jsonError(409, "That payment was already used.");
  const tx = await fetchConfirmed(body.tx);
  const paid = verifyPayment(tx, user.wallet, "SOL", planPrice(plan, body.period));
  const days = body.period === "year" ? YEAR_DAYS : PLAN_DAYS;
  const inserted = await database.insert(planPurchases).values({
    userId: user.userId, plan: plan.id, tx: body.tx, amount: paid.amount, payer: paid.payer, expiresAt: new Date(Date.now() + days * 86_400_000),
  }).onConflictDoNothing().returning({ id: planPurchases.id });
  if (!inserted.length) return jsonError(409, "That payment was already used.");
  await recordEvent(user.userId, "plan", { ref: body.tx }).catch(() => {});
  await notify(user.userId, { kind: "payment", title: `Payment confirmed: ${plan.name}`, body: `You're on ${plan.name} for ${body.period === "year" ? "a year" : "a month"}. Enjoy the extra agents.`, url: "/settings", key: `plan:${body.tx}` });
  return Response.json({ plan: await currentPlan(user.userId) });
});
