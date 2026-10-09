import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { integrationActions } from "@/server/db/integrationsSchema";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { ownAgent } from "@/server/agentWallets";
import { BUDGET_LIMITS, agentSpentToday, budgetOf, setBudget } from "@/server/agentpay/budgets";
import { cardOf } from "@/server/integrations/cards";
import { logEvent, requireStepUp } from "@/server/security";

export const runtime = "nodejs";

async function view(userId: string, slug: string) {
  const [b, spent, rows] = await Promise.all([
    budgetOf(userId, slug), agentSpentToday(userId, slug),
    db().select().from(integrationActions).where(and(eq(integrationActions.userId, userId), eq(integrationActions.agentSlug, slug), eq(integrationActions.connector, "payments"))).orderBy(desc(integrationActions.createdAt)).limit(8),
  ]);
  return {
    perTaskUsd: b.perTaskMicros / 1e6, dailyUsd: b.dailyMicros / 1e6, spentTodayUsd: spent / 1e6, limits: BUDGET_LIMITS,
    recent: rows.filter((r) => r.tool !== "pay.services").map((r) => { const c = cardOf(r); return { id: r.id, title: c.title, usd: c.usd, status: c.status, explorer: c.explorer, at: r.createdAt.getTime() }; }),
  };
}

/** An agent's own spending budget (per task, per day) and its recent payments. */
export const GET = withUser(async (user, req) => {
  const slug = new URL(req.url).searchParams.get("agent") || "";
  await ownAgent(user.userId, slug);
  return Response.json(await view(user.userId, slug));
});

const body = z.object({ agent: z.string().max(40), perTaskUsd: z.number().min(0).max(BUDGET_LIMITS.perTaskMaxUsd), dailyUsd: z.number().min(0).max(BUDGET_LIMITS.dailyMaxUsd) }).strict();
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (b.dailyUsd < b.perTaskUsd) return jsonError(400, "The daily budget can't be lower than the per-task budget.");
  if (!(await rateLimit(`budget:${user.userId}`, 60, 3_600_000))) return jsonError(429, "Wait a minute and try again.");
  await ownAgent(user.userId, b.agent);
  const cur = await budgetOf(user.userId, b.agent);
  const raises = Math.round(b.perTaskUsd * 1e6) > cur.perTaskMicros || Math.round(b.dailyUsd * 1e6) > cur.dailyMicros;
  if (raises) requireStepUp(user, "raise an agent's budget");
  await setBudget(user.userId, b.agent, b.perTaskUsd, b.dailyUsd);
  if (raises) await logEvent(user, "budget", `Raised ${b.agent}'s budget to $${b.perTaskUsd} a task, $${b.dailyUsd} a day`);
  return Response.json(await view(user.userId, b.agent));
});
