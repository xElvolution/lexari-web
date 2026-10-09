/**
 * Plans: seats and model usage per account. Bought with a card or USDC through server/billing/entitlements.ts (older
 * purchases were devnet SOL). A purchase counts from startsAt (createdAt when null) until expiresAt.
 */
import { and, count, desc, eq, gt, notInArray, sql } from "drizzle-orm";
import { FREE_SLUGS, PLANS, isPeriod, planById, type Period, type PlanId } from "@/content/appData";
import { db } from "./db";
import { agents, planPurchases } from "./db/schema";
import { HttpError } from "./http";

export type CurrentPlan = { id: PlanId; name: string; seats: number; expiresAt: number | null; startsAt: number | null; purchaseId: string | null; period: Period | null };

export async function currentPlan(userId: string): Promise<CurrentPlan> {
  const rows = await db().select().from(planPurchases)
    .where(and(eq(planPurchases.userId, userId), gt(planPurchases.expiresAt, new Date()), sql`coalesce(${planPurchases.startsAt}, ${planPurchases.createdAt}) <= now()`))
    .orderBy(desc(planPurchases.createdAt)).limit(10);
  // The biggest active plan wins (an upgrade during an active plan replaces it).
  const best = rows.map((r) => ({ p: planById(r.plan), r })).sort((a, b) => b.p.seats - a.p.seats || b.r.expiresAt.getTime() - a.r.expiresAt.getTime())[0];
  if (!best) return { id: PLANS[0].id, name: PLANS[0].name, seats: PLANS[0].seats, expiresAt: null, startsAt: null, purchaseId: null, period: null };
  return { id: best.p.id, name: best.p.name, seats: best.p.seats, expiresAt: best.r.expiresAt.getTime(), startsAt: (best.r.startsAt ?? best.r.createdAt).getTime(), purchaseId: best.r.id, period: isPeriod(best.r.period) ? best.r.period : "monthly" };
}

/** Agents on the account: your own agent, hired specialists and the ones you made. Each takes a seat. */
export async function seatsUsed(userId: string) {
  const [row] = await db().select({ n: count() }).from(agents).where(and(eq(agents.userId, userId), notInArray(agents.slug, FREE_SLUGS)));
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
  const order = rows.filter((r) => !FREE_SLUGS.includes(r.slug)).sort((a, b) => (a.slug === "home" ? -1 : b.slug === "home" ? 1 : a.at.getTime() - b.at.getTime()));
  return order.slice(Math.max(1, n)).map((r) => r.slug);
}
