import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { agents, hires, memories, questEvents, questProgress, referrals } from "./db/schema";
import type { QuestRule } from "./hub/catalog";

export async function recordEvent(userId: string, kind: string) {
  await db().insert(questEvents).values({ userId, kind });
}

function since(period: QuestRule["period"]) {
  const now = new Date();
  if (period === "daily") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "weekly") {
    const day = now.getUTCDay() || 7;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (day - 1));
    return start;
  }
  return new Date(0);
}

export async function questCount(userId: string, rule: QuestRule): Promise<number> {
  const database = db();
  const from = since(rule.period);
  if (rule.count === "memory" && rule.period === "hard") {
    const rows = await database.select({ n: sql<number>`count(*)::int` }).from(memories).where(and(eq(memories.userId, userId), isNull(memories.deletedAt)));
    return rows[0]?.n ?? 0;
  }
  if (rule.count === "team") {
    const a = await database.select({ n: sql<number>`count(*)::int` }).from(agents).where(eq(agents.userId, userId));
    const h = await database.select({ n: sql<number>`count(*)::int` }).from(hires).where(eq(hires.buyerId, userId));
    return (a[0]?.n ?? 0) + (h[0]?.n ?? 0);
  }
  if (rule.count === "referral") {
    const rows = await database.select({ n: sql<number>`count(*)::int` }).from(referrals).where(eq(referrals.referrerId, userId));
    return rows[0]?.n ?? 0;
  }
  if (rule.count === "box") {
    const rows = await database.select({ n: sql<number>`count(*)::int` }).from(questProgress).where(and(eq(questProgress.userId, userId), eq(questProgress.questId, "box"), gte(questProgress.updatedAt, from)));
    return rows[0]?.n ?? 0;
  }
  if (rule.count === "level" && rule.id === "h-level") {
    const rows = await database.select({ kind: questEvents.kind }).from(questEvents).where(and(eq(questEvents.userId, userId), sql`${questEvents.kind} like 'level:%'`));
    return rows.reduce((max, row) => Math.max(max, Number(row.kind.split(":")[1]) || 0), 0);
  }
  const kind = rule.count === "level" ? "level" : rule.count;
  const rows = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(questEvents)
    .where(and(eq(questEvents.userId, userId), eq(questEvents.kind, kind), gte(questEvents.createdAt, from)));
  return rows[0]?.n ?? 0;
}
