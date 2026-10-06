/**
 * How far each quest is, from data the server trusts: confirmed chain instructions (chain_ledger),
 * server-recorded events (chat replies, saved memories, finished jobs), verified hires and referrals.
 */
import { eq, sql, type SQL } from "drizzle-orm";
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

/** Every count the quests need, in one database round trip (the Hub used to make ~17, which took ~0.7 s). */
export type QuestCounts = {
  checkinD: number; checkinW: number; boxD: number; levelW: number; msgD: number; msgW: number; memD: number; memAll: number;
  jobsW: number; hires: number; team: number; agents: number; storeW: number; storeAll: number; style: number; referrals: number; claimedTotal: number;
};
export async function questCounts(userId: string, now = new Date()): Promise<QuestCounts> {
  const d = sql`${periodStart("daily", now).toISOString()}::timestamptz`;
  const w = sql`${periodStart("weekly", now).toISOString()}::timestamptz`;
  const L = (kind: string, from?: SQL) => sql`(select count(*)::int from ${chainLedger} where ${chainLedger.userId} = ${userId} and ${chainLedger.kind} = ${kind}${from ? sql` and ${chainLedger.createdAt} >= ${from}` : sql``})`;
  const E = (kind: string, from: SQL) => sql`(select coalesce(sum(greatest(${questEvents.amount}, 1)), 0)::int from ${questEvents} where ${questEvents.userId} = ${userId} and ${questEvents.kind} = ${kind} and ${questEvents.createdAt} >= ${from})`;
  const M = (from?: SQL) => sql`(select count(distinct ${memories.contentHash})::int from ${memories} where ${memories.userId} = ${userId} and ${memories.deletedAt} is null${from ? sql` and ${memories.createdAt} >= ${from}` : sql``})`;
  const rows = await db().execute<Record<keyof QuestCounts, number>>(sql`select
    ${L("check_in", d)} as "checkinD", ${L("check_in", w)} as "checkinW", ${L("open_box", d)} as "boxD",
    ${E("level", w)} as "levelW", ${E("message", d)} as "msgD", ${E("message", w)} as "msgW",
    ${M(d)} as "memD", ${M()} as "memAll",
    (select count(*)::int from ${jobs} where ${jobs.userId} = ${userId} and ${jobs.status} = 'done' and ${jobs.createdAt} >= ${w}) as "jobsW",
    (select count(*)::int from ${hires} where ${hires.buyerId} = ${userId}) as "hires",
    (select count(*)::int from ${agents} where ${agents.userId} = ${userId} and ${agents.kind} in ('home', 'custom', 'hired')) as "team",
    (select count(*)::int from ${agents} where ${agents.userId} = ${userId}) as "agents",
    ${L("store_buy", w)} as "storeW", ${L("store_buy")} as "storeAll",
    coalesce((select (case when coalesce(length(${hubPlayers.cosmetics}->>'bg'), 0) > 0 then 1 else 0 end) + (case when coalesce(length(${hubPlayers.cosmetics}->>'bubble'), 0) > 0 then 1 else 0 end) from ${hubPlayers} where ${hubPlayers.userId} = ${userId}), 0)::int as "style",
    (select count(*)::int from ${referrals} where ${referrals.referrerId} = ${userId} and exists (select 1 from ${chainLedger} where ${chainLedger.userId} = ${referrals.refereeId})) as "referrals",
    ${L("claim_quest")} as "claimedTotal"`);
  const r = (rows as unknown as Record<string, unknown>[])[0] || {};
  const out = {} as QuestCounts;
  for (const k of ["checkinD", "checkinW", "boxD", "levelW", "msgD", "msgW", "memD", "memAll", "jobsW", "hires", "team", "agents", "storeW", "storeAll", "style", "referrals", "claimedTotal"] as (keyof QuestCounts)[]) out[k] = Number(r[k] ?? 0);
  return out;
}

/** How far a quest is, from the counts above (the same numbers the Hub shows and a claim checks). */
export function progressFrom(c: QuestCounts, rule: QuestRule, facts: Facts): number {
  const daily = rule.period === "daily", hard = rule.period === "hard";
  switch (rule.count) {
    case "checkin": return hard ? facts.streak : daily ? c.checkinD : c.checkinW;
    case "box": return c.boxD;
    case "level": return hard ? facts.maxLevel : c.levelW;
    case "message": return daily ? c.msgD : c.msgW;
    case "memory": return hard ? c.memAll : c.memD;
    case "job": return c.jobsW;
    case "hire": return c.hires;
    case "team": return c.team;
    case "referral": return c.referrals;
    case "store_buy": return hard ? c.storeAll : c.storeW; // Store purchases (offchain ledger rows), this week or ever
    case "store_style": return c.style; // wearing a chat background and a bubble style right now: one point each
    case "agent": return c.agents;
  }
}

export async function questProgress(userId: string, rule: QuestRule, facts: Facts): Promise<number> {
  return progressFrom(await questCounts(userId), rule, facts);
}
