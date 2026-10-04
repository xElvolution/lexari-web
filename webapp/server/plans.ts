/** Plans: seats per account, paid in devnet SOL to the treasury and checked on chain. */
import { and, count, desc, eq, gt } from "drizzle-orm";
import { PLANS, planById, type PlanId } from "@/content/appData";
import { db } from "./db";
import { agents, planPurchases } from "./db/schema";
import { HttpError } from "./http";

export async function currentPlan(userId: string): Promise<{ id: PlanId; name: string; seats: number; expiresAt: number | null }> {
  const rows = await db().select().from(planPurchases).where(and(eq(planPurchases.userId, userId), gt(planPurchases.expiresAt, new Date()))).orderBy(desc(planPurchases.createdAt)).limit(10);
  // The biggest active plan wins (an upgrade during an active plan replaces it).
  let best = rows.map((r) => ({ p: planById(r.plan), exp: r.expiresAt.getTime() })).sort((a, b) => b.p.seats - a.p.seats)[0];
  if (!best) best = { p: PLANS[0], exp: 0 };
  return { id: best.p.id, name: best.p.name, seats: best.p.seats, expiresAt: best.exp || null };
}

/** Agents on the account: your own agent, hired specialists and the ones you made. Each takes a seat. */
export async function seatsUsed(userId: string) {
  const [row] = await db().select({ n: count() }).from(agents).where(eq(agents.userId, userId));
  return Math.max(1, Number(row?.n ?? 1));
}

/** Throws 402 with a plain message when one more agent would not fit the plan. */
export async function assertSeat(userId: string) {
  const [plan, used] = await Promise.all([currentPlan(userId), seatsUsed(userId)]);
  if (used + 1 > plan.seats) {
    throw new HttpError(402, plan.id === "free"
      ? "Free plan includes one agent. Upgrade to Pro to hire more."
      : `Your ${plan.name} plan is full (${plan.seats} seats). Move up a plan or release someone first.`);
  }
  return plan;
}

/** Agents past your plan's seats (oldest keep their seats; your own agent always has desk one). Their data stays; they wait for an upgrade. */
export async function lockedSlugs(userId: string, seats?: number) {
  const n = seats ?? (await currentPlan(userId)).seats;
  const rows = await db().select({ slug: agents.slug, at: agents.createdAt }).from(agents).where(eq(agents.userId, userId));
  const order = rows.sort((a, b) => (a.slug === "home" ? -1 : b.slug === "home" ? 1 : a.at.getTime() - b.at.getTime()));
  return order.slice(Math.max(1, n)).map((r) => r.slug);
}
