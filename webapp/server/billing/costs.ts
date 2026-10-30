/**
 * SERVER ONLY. The cost dashboard and per-agent model caps.
 *  - costReport: this cycle's model spend by agent, by model and by day, from usage_ledger (what you were billed and
 *    what the engines cost), with each agent's cap.
 *  - caps: the most one agent's chats may bill in a billing cycle. beginTurn (meter.ts) checks it before the model is
 *    called, so a capped agent stops before it spends, never after. Turns on your own API key are never billed, so
 *    they never count; transaction receipts (events) are never blocked.
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { agents } from "../db/schema";
import { agentModelCaps, usageLedger } from "../db/billingSchema";
import { HttpError } from "../http";
import { cycleFor } from "./meter";

type Exec = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0] | ReturnType<typeof db>;
export const CAP_MAX_MICROS = 500_000_000;

export async function capFor(userId: string, slug: string, x: Exec = db()): Promise<number | null> {
  const [r] = await x.select({ m: agentModelCaps.cycleMicros }).from(agentModelCaps).where(and(eq(agentModelCaps.userId, userId), eq(agentModelCaps.agentSlug, slug))).limit(1);
  return r ? Number(r.m) : null;
}

/** What one agent's turns were billed since `since` (micro dollars). */
export async function agentBilledSince(userId: string, slug: string, since: Date, x: Exec = db()): Promise<number> {
  const [r] = await x.select({ n: sql<string>`coalesce(sum(${usageLedger.billedMicros}), 0)` }).from(usageLedger)
    .where(and(eq(usageLedger.userId, userId), eq(usageLedger.agentSlug, slug), gte(usageLedger.createdAt, since)));
  return Number(r?.n ?? 0);
}

/** True when a turn estimated at `estimate` would take the agent past its cap. */
export const overCap = (spent: number, estimate: number, cap: number | null) => cap !== null && spent + Math.max(0, estimate) > cap;

/** Sets (micros) or removes (null) one agent's cap. Only your own agents. */
export async function setAgentCap(userId: string, slug: string, micros: number | null) {
  const [a] = await db().select({ id: agents.id }).from(agents).where(and(eq(agents.userId, userId), eq(agents.slug, slug))).limit(1);
  if (!a) throw new HttpError(404, "That agent isn't on your team.");
  if (micros === null) { await db().delete(agentModelCaps).where(and(eq(agentModelCaps.userId, userId), eq(agentModelCaps.agentSlug, slug))); return null; }
  if (!Number.isFinite(micros) || micros < 0 || micros > CAP_MAX_MICROS) throw new HttpError(400, "A cap is between $0 and $500 a cycle.");
  const m = Math.round(micros);
  await db().insert(agentModelCaps).values({ userId, agentSlug: slug, cycleMicros: m }).onConflictDoUpdate({ target: [agentModelCaps.userId, agentModelCaps.agentSlug], set: { cycleMicros: m, updatedAt: new Date() } });
  return m;
}

export type CostReport = {
  cycleStart: number; cycleEnd: number;
  total: { billed: number; cost: number; turns: number; tokens: number };
  agents: { slug: string; name: string; billed: number; cost: number; turns: number; tokens: number; cap: number | null }[];
  models: { model: string; billed: number; cost: number; turns: number; tokens: number }[];
  days: { day: string; billed: number; cost: number }[];
};

export async function costReport(userId: string): Promise<CostReport> {
  const cycle = await cycleFor(userId);
  const since = cycle.start;
  const where = and(eq(usageLedger.userId, userId), gte(usageLedger.createdAt, since));
  const sums = { billed: sql<string>`coalesce(sum(${usageLedger.billedMicros}), 0)`, cost: sql<string>`coalesce(sum(${usageLedger.costMicros}), 0)`, turns: sql<string>`count(*)`, tokens: sql<string>`coalesce(sum(${usageLedger.promptTokens} + ${usageLedger.completionTokens}), 0)` };
  const [byAgent, byModel, byDay, team, caps] = await Promise.all([
    db().select({ slug: usageLedger.agentSlug, ...sums }).from(usageLedger).where(where).groupBy(usageLedger.agentSlug),
    db().select({ model: usageLedger.requestedModel, ...sums }).from(usageLedger).where(where).groupBy(usageLedger.requestedModel).orderBy(desc(sums.billed)),
    db().select({ day: sql<string>`to_char(${usageLedger.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`, billed: sums.billed, cost: sums.cost }).from(usageLedger).where(where).groupBy(sql`1`).orderBy(sql`1`),
    db().select({ slug: agents.slug, name: agents.name, meta: agents.meta }).from(agents).where(eq(agents.userId, userId)),
    db().select().from(agentModelCaps).where(eq(agentModelCaps.userId, userId)),
  ]);
  const n = (v: string | number | null | undefined) => Number(v ?? 0);
  const capOf = new Map(caps.map((c) => [c.agentSlug, Number(c.cycleMicros)]));
  const spent = new Map(byAgent.map((r) => [r.slug, r]));
  const list = team.map((a) => {
    const r = spent.get(a.slug);
    return { slug: a.slug, name: (a.meta as { nick?: string } | null)?.nick || a.name, billed: n(r?.billed), cost: n(r?.cost), turns: n(r?.turns), tokens: n(r?.tokens), cap: capOf.get(a.slug) ?? null };
  });
  // Usage from agents you since removed still counts toward the totals; it shows as one row.
  const gone = byAgent.filter((r) => !team.some((a) => a.slug === r.slug));
  if (gone.length) list.push({ slug: "", name: "Removed agents", billed: gone.reduce((s, r) => s + n(r.billed), 0), cost: gone.reduce((s, r) => s + n(r.cost), 0), turns: gone.reduce((s, r) => s + n(r.turns), 0), tokens: gone.reduce((s, r) => s + n(r.tokens), 0), cap: null });
  list.sort((a, b) => b.billed - a.billed || b.turns - a.turns || a.name.localeCompare(b.name));
  return {
    cycleStart: cycle.start.getTime(), cycleEnd: cycle.end.getTime(),
    total: { billed: list.reduce((s, a) => s + a.billed, 0), cost: list.reduce((s, a) => s + a.cost, 0), turns: list.reduce((s, a) => s + a.turns, 0), tokens: list.reduce((s, a) => s + a.tokens, 0) },
    agents: list,
    models: byModel.map((r) => ({ model: r.model, billed: n(r.billed), cost: n(r.cost), turns: n(r.turns), tokens: n(r.tokens) })),
    days: byDay.map((r) => ({ day: r.day, billed: n(r.billed), cost: n(r.cost) })),
  };
}
