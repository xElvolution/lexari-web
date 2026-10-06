/**
 * The usage meter: places a hold before a turn calls a model, then settles the real cost after it (or releases the
 * hold when nothing was used). Per-person operations are serialized with an advisory lock, so two tabs cannot both
 * spend the last dollar. Pool rules live in ./math.ts.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { PLAN_DAYS, planById, type PlanId } from "@/content/appData";
import { ALERT_AT, DEFAULT_SPEND_LIMIT_USD, FREE_LAMINA_PER_DAY, HOLD_OUT_TOKENS, HOLD_TTL_MS, MICROS, type SpendMode } from "@/content/billing";
import { ENGINE_PRICES, type ModelInfo } from "@/content/models";
import type { Usage } from "@/server/engram/gateway";
import { db } from "../db";
import { billingSettings, creditLedger, usageHolds, usageLedger, usagePeriods } from "../db/billingSchema";
import { notify } from "../notify";
import { currentPlan, type CurrentPlan } from "../plans";
import { costMicros, decide, estimateTokens, share, split, usdToMicros, type BlockReason, type MeterSnapshot, type Pool } from "./math";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];
type Exec = Tx | ReturnType<typeof db>;

export type Cycle = { plan: CurrentPlan; paid: boolean; start: Date; end: Date; laminaLimit: number; premiumLimit: number };

const DAY = 86_400_000;
export const utcDayStart = (now = Date.now()) => new Date(Math.floor(now / DAY) * DAY);
export const nextUtcMidnight = (now = Date.now()) => new Date(utcDayStart(now).getTime() + DAY);

/** The current billing cycle: the active paid purchase's window, or the calendar month (UTC) on Free. */
export async function cycleFor(userId: string, plan?: CurrentPlan): Promise<Cycle> {
  const p = plan ?? (await currentPlan(userId));
  const info = planById(p.id);
  if (p.id !== "free" && p.startsAt && p.expiresAt) {
    return { plan: p, paid: true, start: new Date(p.startsAt), end: new Date(Math.min(p.expiresAt, p.startsAt + PLAN_DAYS * DAY)), laminaLimit: usdToMicros(info.laminaUsd), premiumLimit: usdToMicros(info.premiumUsd) };
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { plan: p, paid: false, start, end, laminaLimit: 0, premiumLimit: 0 };
}

/** The cycle's usage row, created on first use (one round trip). */
export async function ensurePeriod(x: Exec, userId: string, c: Cycle) {
  const [row] = await x.insert(usagePeriods).values({ userId, periodStart: c.start, periodEnd: c.end, plan: c.plan.id, laminaLimit: c.laminaLimit, premiumLimit: c.premiumLimit })
    .onConflictDoUpdate({ target: [usagePeriods.userId, usagePeriods.periodStart], set: { periodEnd: sql`excluded.period_end` } }).returning();
  return row;
}

export async function ensureSettings(x: Exec, userId: string) {
  const [row] = await x.insert(billingSettings).values({ userId, spendLimit: usdToMicros(DEFAULT_SPEND_LIMIT_USD) })
    .onConflictDoUpdate({ target: billingSettings.userId, set: { userId: sql`excluded.user_id` } }).returning();
  return row;
}

/** Lamina messages counted today on Free (UTC day), plus turns holding a place right now. */
async function freeUsedToday(x: Exec, userId: string) {
  const day = utcDayStart();
  const [r] = await x.select({
    n: sql<number>`(select count(*) from ${usageLedger} where ${usageLedger.userId} = ${userId} and ${usageLedger.pool} = 'free' and ${usageLedger.kind} in ('chat', 'call') and ${usageLedger.createdAt} > ${day.toISOString()}::timestamptz)
      + (select count(*) from ${usageHolds} where ${usageHolds.userId} = ${userId} and ${usageHolds.pool} = 'free' and ${usageHolds.expiresAt} > now())`,
  }).from(sql`(select 1) as one`);
  return Number(r?.n ?? 0);
}

async function heldByPool(x: Exec, userId: string) {
  const rows = await x.select({ pool: usageHolds.pool, micros: sql<number>`coalesce(sum(${usageHolds.micros}), 0)::bigint` }).from(usageHolds)
    .where(and(eq(usageHolds.userId, userId), gt(usageHolds.expiresAt, new Date()))).groupBy(usageHolds.pool);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.pool] = Number(r.micros);
  return out;
}

export type Snapshot = { cycle: Cycle; period: typeof usagePeriods.$inferSelect; settings: typeof billingSettings.$inferSelect; meter: MeterSnapshot; held: Record<string, number> };

export async function snapshot(x: Exec, userId: string, cycle: Cycle): Promise<Snapshot> {
  const [period, settings, held, freeUsed] = await Promise.all([ensurePeriod(x, userId, cycle), ensureSettings(x, userId), heldByPool(x, userId), cycle.paid ? Promise.resolve(0) : freeUsedToday(x, userId)]);
  const meter: MeterSnapshot = {
    paid: cycle.paid,
    laminaLeft: period.laminaLimit - period.laminaUsed - (held.lamina || 0),
    premiumLeft: period.premiumLimit - period.premiumUsed - (held.premium || 0),
    credits: settings.creditMicros - (held.credits || 0),
    creditsSpent: period.creditsUsed + (held.credits || 0),
    spendMode: (settings.spendMode as SpendMode) || "fixed",
    spendLimit: settings.spendLimit,
    freeUsed,
    freePerDay: FREE_LAMINA_PER_DAY,
  };
  return { cycle, period, settings, meter, held };
}

const lock = (tx: Tx, userId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`billing:${userId}`}))`);

export type Blocked = {
  reason: BlockReason; model: string; modelLabel: string; plan: PlanId; planName: string;
  resetsAt: number | null; credits: number; spendMode: SpendMode; spendLimit: number;
};

export type TurnInput = {
  userId: string; model: ModelInfo; convo: string; agent: string;
  /** chat | call | event | follow. Only chat and call count as Free messages. */
  kind: "chat" | "call" | "event" | "follow";
  /** the prompt, for the hold estimate */
  prompt: { content: string }[];
};

/** One metered turn. Feed it every completion's usage, then settle once. */
export class Turn {
  private usages: Usage[] = [];
  private done = false;
  constructor(readonly input: TurnInput, readonly pool: Pool, readonly chain: Pool[], private holdId: string | null, readonly forced: boolean) {}
  add = (u: Usage) => { this.usages.push(u); };
  /** Engine cost of everything this turn used, in micro dollars. */
  cost() {
    return this.usages.reduce((n, u) => n + (u.costUsd !== null ? Math.ceil(u.costUsd * MICROS) : costMicros(ENGINE_PRICES[u.model] || this.input.model.price, u.promptTokens, u.completionTokens)), 0);
  }
  async settle() {
    if (this.done) return null;
    this.done = true;
    const { userId, model } = this.input;
    if (!this.usages.length) { await this.release(); return null; }
    const cost = this.cost();
    const tokens = this.usages.reduce((a, u) => ({ p: a.p + u.promptTokens, c: a.c + u.completionTokens }), { p: 0, c: 0 });
    const served = [...new Set(this.usages.map((u) => u.model))].join(", ").slice(0, 200);
    const cycle = await cycleFor(userId);
    const result = await db().transaction(async (tx) => {
      await lock(tx, userId);
      if (this.holdId) await tx.delete(usageHolds).where(eq(usageHolds.id, this.holdId));
      const snap = await snapshot(tx, userId, cycle);
      const chain: Pool[] = this.forced ? ["free"] : this.chain;
      const s = split(snap.meter, chain, cost);
      if (s.lamina || s.premium || s.credits) {
        await tx.update(usagePeriods).set({
          laminaUsed: sql`${usagePeriods.laminaUsed} + ${s.lamina}`, premiumUsed: sql`${usagePeriods.premiumUsed} + ${s.premium}`, creditsUsed: sql`${usagePeriods.creditsUsed} + ${s.credits}`,
        }).where(and(eq(usagePeriods.userId, userId), eq(usagePeriods.periodStart, cycle.start)));
      }
      const [row] = await tx.insert(usageLedger).values({
        userId, convo: this.input.convo.slice(0, 120), agentSlug: this.input.agent.slice(0, 60), kind: this.input.kind, pool: chain[0] || "free",
        requestedModel: model.id, servedModel: served || model.route[0], promptTokens: tokens.p, completionTokens: tokens.c,
        costMicros: cost, billedMicros: s.billed, laminaMicros: s.lamina, premiumMicros: s.premium, creditsMicros: s.credits, estimated: this.usages.some((u) => u.estimated),
      }).returning({ id: usageLedger.id });
      if (s.credits) {
        await tx.update(billingSettings).set({ creditMicros: sql`${billingSettings.creditMicros} - ${s.credits}`, updatedAt: new Date() }).where(eq(billingSettings.userId, userId));
        await tx.insert(creditLedger).values({ userId, delta: -s.credits, reason: "usage", ref: `usage:${row.id}` });
      }
      return { split: s, before: snap };
    });
    void alerts(userId, cycle, result.before, result.split).catch(() => {});
    return result.split;
  }
  /** Gives the hold back without charging (the model failed before using anything). */
  async release() {
    this.done = true;
    if (this.holdId) await db().delete(usageHolds).where(eq(usageHolds.id, this.holdId)).catch(() => {});
  }
}

/**
 * Starts a metered turn: picks the pool and places a hold for the estimated cost. Returns Blocked when the person is
 * out of usage for this model (the app then shows the out-of-usage sheet). Events (a transaction receipt the agent
 * acknowledges) are never blocked; Lexari absorbs them when no pool has room.
 */
export async function beginTurn(input: TurnInput): Promise<Turn | Blocked> {
  const { userId, model } = input;
  const cycle = await cycleFor(userId);
  const out = input.kind === "call" ? HOLD_OUT_TOKENS.call : HOLD_OUT_TOKENS.chat;
  const estimate = costMicros(model.price, estimateTokens(input.prompt), out);
  const counts = input.kind === "chat" || input.kind === "call";
  return db().transaction(async (tx) => {
    await lock(tx, userId);
    const snap = await snapshot(tx, userId, cycle);
    // A group member answering after the first one, or a receipt, rides on the message that already counted.
    const meter = counts ? snap.meter : { ...snap.meter, freeUsed: Math.max(0, snap.meter.freeUsed - 1) };
    const d = decide(meter, model.pool, estimate);
    if (!d.ok) {
      if (input.kind === "event") return new Turn(input, "free", ["free"], null, true);
      return {
        reason: d.reason, model: model.id, modelLabel: model.label, plan: cycle.plan.id, planName: cycle.plan.name,
        resetsAt: !cycle.paid && model.pool === "lamina" ? nextUtcMidnight().getTime() : cycle.paid ? cycle.end.getTime() : null,
        credits: Math.max(0, snap.settings.creditMicros), spendMode: meter.spendMode, spendLimit: meter.spendLimit,
      } satisfies Blocked;
    }
    let holdId: string | null = null;
    if (d.pool !== "free" || counts) {
      const [h] = await tx.insert(usageHolds).values({ userId, pool: d.pool, micros: d.hold, expiresAt: new Date(Date.now() + HOLD_TTL_MS) }).returning({ id: usageHolds.id });
      holdId = h.id;
    }
    if (Math.random() < 0.02) await tx.delete(usageHolds).where(sql`${usageHolds.expiresAt} < now() - interval '1 hour'`);
    return new Turn(input, d.pool, d.chain, holdId, false);
  });
}

export const isBlocked = (t: Turn | Blocked): t is Blocked => !(t instanceof Turn);

/** 80% and 100% alerts for the included pools, and the Free daily limit. Each fires once per cycle (or day). */
async function alerts(userId: string, cycle: Cycle, before: Snapshot, s: { lamina: number; premium: number; free: boolean }) {
  const key = cycle.start.toISOString().slice(0, 10);
  if (cycle.paid) {
    const pools = [
      ["lamina", "Lamina", before.period.laminaUsed + s.lamina, before.period.laminaLimit],
      ["premium", "Premium", before.period.premiumUsed + s.premium, before.period.premiumLimit],
    ] as const;
    for (const [id, label, used, limit] of pools) {
      const sh = share(used, limit);
      const hit = [...ALERT_AT].reverse().find((a) => sh >= a);
      if (!hit || limit <= 0) continue;
      const pct = Math.round(hit * 100);
      await notify(userId, {
        kind: "payment", key: `usage:${id}:${pct}:${key}`, url: "/settings#billing",
        title: pct >= 100 ? `${label} usage is used up` : `You've used ${pct}% of ${label}`,
        body: pct >= 100 ? (id === "lamina" ? "Lamina keeps going on your premium usage, then extra credits." : "Top up extra credits or move up a plan to keep using premium models.") : `Your plan renews on ${cycle.end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`,
      });
    }
  } else if (s.free && before.meter.freeUsed + 1 >= FREE_LAMINA_PER_DAY) {
    await notify(userId, { kind: "payment", key: `free:${utcDayStart().toISOString().slice(0, 10)}`, url: "/settings#billing", title: "That was today's last free Lamina message", body: "It resets at midnight UTC. Pro keeps Lamina going all month." });
  }
}
