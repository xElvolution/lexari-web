/**
 * Agent budgets: how much an agent may spend on its own, per task and per day (UTC), from its own wallet (which you
 * fund from your Lexari balance). Within the budget an agent pays x402 services and other agents without asking;
 * anything over it becomes a Confirm card. Spending is summed from integration_actions (connector "payments").
 */
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { agentBudgets } from "../db/agentPaySchema";
import { integrationActions } from "../db/integrationsSchema";
import { COUNTED } from "../integrations/grants";

export const BUDGET_DEFAULT = { perTaskMicros: 500_000, dailyMicros: 2_000_000 };
export const BUDGET_LIMITS = { perTaskMaxUsd: 25, dailyMaxUsd: 100 };
const startOfUtcDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };

export async function budgetOf(userId: string, slug: string) {
  const [b] = await db().select().from(agentBudgets).where(and(eq(agentBudgets.userId, userId), eq(agentBudgets.agentSlug, slug))).limit(1);
  return { perTaskMicros: b?.perTaskMicros ?? BUDGET_DEFAULT.perTaskMicros, dailyMicros: b?.dailyMicros ?? BUDGET_DEFAULT.dailyMicros };
}

export async function agentSpentToday(userId: string, slug: string, tx = db()) {
  const [r] = await tx.select({ v: sql<string>`coalesce(sum(${integrationActions.usdMicros}), 0)` }).from(integrationActions)
    .where(and(eq(integrationActions.userId, userId), eq(integrationActions.agentSlug, slug), eq(integrationActions.connector, "payments"), inArray(integrationActions.status, [...COUNTED]), gte(integrationActions.createdAt, startOfUtcDay())));
  return Number(r?.v || 0);
}

export async function setBudget(userId: string, slug: string, perTaskUsd: number, dailyUsd: number) {
  const perTaskMicros = Math.round(Math.max(0, Math.min(BUDGET_LIMITS.perTaskMaxUsd, perTaskUsd)) * 1e6);
  const dailyMicros = Math.max(perTaskMicros, Math.round(Math.max(0, Math.min(BUDGET_LIMITS.dailyMaxUsd, dailyUsd)) * 1e6));
  await db().insert(agentBudgets).values({ userId, agentSlug: slug, perTaskMicros, dailyMicros })
    .onConflictDoUpdate({ target: [agentBudgets.userId, agentBudgets.agentSlug], set: { perTaskMicros, dailyMicros, updatedAt: new Date() } });
  return { perTaskMicros, dailyMicros };
}

/** null when it fits the budget (the agent may pay on its own), otherwise why it needs your Confirm. */
export async function overBudget(userId: string, slug: string, micros: number) {
  const b = await budgetOf(userId, slug);
  const usd = (m: number) => `$${(m / 1e6).toFixed(2)}`;
  if (micros > b.perTaskMicros) return `${usd(micros)} is over this agent's ${usd(b.perTaskMicros)} per-task budget`;
  const spent = await agentSpentToday(userId, slug);
  if (spent + micros > b.dailyMicros) return `that would take today's spending to ${usd(spent + micros)}, over the ${usd(b.dailyMicros)} daily budget`;
  return null;
}
