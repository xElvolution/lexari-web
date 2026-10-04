/**
 * How far each quest is, from data the server trusts: confirmed chain instructions (chain_ledger),
 * server-recorded events (chat replies, saved memories, finished jobs), verified hires and referrals.
 */
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { agents, chainLedger, hires, hubPlayers, jobs, memories, questEvents, referrals } from "../db/schema";
import type { QuestRule } from "./catalog";

export function periodStart(period: QuestRule["period"], now = new Date()) {
  if (period === "daily") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "weekly") {
    const day = now.getUTCDay() || 7;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (day - 1));
    return start;
  }
  return new Date(0);
}

const n = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);

/** Friends who joined with this person's code and did something real onchain (anti-farming). */
export async function qualifiedReferrals(userId: string) {
  const rows = await db()
    .select({ n: sql<number>`count(distinct ${referrals.refereeId})::int` })
    .from(referrals)
    .innerJoin(chainLedger, eq(chainLedger.userId, referrals.refereeId))
    .where(eq(referrals.referrerId, userId));
  return n(rows);
}

export type Facts = { streak: number; maxLevel: number };

export async function questProgress(userId: string, rule: QuestRule, facts: Facts): Promise<number> {
  const database = db();
  const from = periodStart(rule.period);
  const ledger = (kind: string) => database.select({ n: sql<number>`count(*)::int` }).from(chainLedger).where(and(eq(chainLedger.userId, userId), eq(chainLedger.kind, kind), gte(chainLedger.createdAt, from)));
  const events = (kind: string) => database.select({ n: sql<number>`coalesce(sum(greatest(${questEvents.amount}, 1)), 0)::int` }).from(questEvents).where(and(eq(questEvents.userId, userId), eq(questEvents.kind, kind), gte(questEvents.createdAt, from)));
  switch (rule.count) {
    case "checkin":
      return rule.period === "hard" ? facts.streak : n(await ledger("check_in"));
    case "box":
      return n(await ledger("open_box"));
    case "level":
      return rule.period === "hard" ? facts.maxLevel : n(await events("level"));
    case "message":
      return n(await events("message"));
    case "memory": {
      const where = rule.period === "hard"
        ? and(eq(memories.userId, userId), isNull(memories.deletedAt))
        : and(eq(memories.userId, userId), isNull(memories.deletedAt), gte(memories.createdAt, from));
      return n(await database.select({ n: sql<number>`count(distinct ${memories.contentHash})::int` }).from(memories).where(where));
    }
    case "job":
      return n(await database.select({ n: sql<number>`count(*)::int` }).from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.status, "done"), gte(jobs.createdAt, from))));
    case "hire":
      return n(await database.select({ n: sql<number>`count(*)::int` }).from(hires).where(eq(hires.buyerId, userId)));
    case "team":
      return n(await database.select({ n: sql<number>`count(*)::int` }).from(agents).where(and(eq(agents.userId, userId), inArray(agents.kind, ["home", "custom", "hired"]))));
    case "referral":
      return qualifiedReferrals(userId);
    case "store_buy": // Store purchases (offchain ledger rows), this week or ever
      return n(await ledger("store_buy"));
    case "store_style": { // wearing a chat background and a bubble style right now: one point each
      const [p] = await database.select({ c: hubPlayers.cosmetics }).from(hubPlayers).where(eq(hubPlayers.userId, userId)).limit(1);
      const c = (p?.c || {}) as { bg?: string | null; bubble?: string | null };
      return (c.bg ? 1 : 0) + (c.bubble ? 1 : 0);
    }
    case "agent":
      return n(await database.select({ n: sql<number>`count(*)::int` }).from(agents).where(eq(agents.userId, userId)));
  }
}
