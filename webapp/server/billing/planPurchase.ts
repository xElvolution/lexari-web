/**
 * Buying a plan from the Lexari balance. The server prices it from the catalog (plan and period, never a client
 * price), checks the schedule rules, debits the balance and writes the purchase in one transaction. Idempotent per
 * client key: a double tap or a retry charges once. A short balance answers 402 with the shortfall for Top up.
 */
import { eq } from "drizzle-orm";
import { PERIODS, PLANS, type Period } from "@/content/appData";
import { db } from "../db";
import { planPurchases } from "../db/schema";
import { HttpError } from "../http";
import { charge } from "./balance";
import { itemFor, type Item } from "./catalog";
import { announcePlan, grantPlan, livePurchases } from "./entitlements";
import { usdToMicros } from "./math";
import { schedulePlan, type Schedule } from "./schedule";

type Exec = Parameters<typeof livePurchases>[0];
const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Plain words for a purchase the rules don't allow yet. */
export function blockedCopy(item: Item, s: Schedule) {
  return `${item.title.replace(" plan,", "")} can be booked from ${fmt(s.bookableFrom!)}, in the last month before it would start. Your current plan runs until ${fmt(s.startsAt)}.`;
}

/** Throws 409 when a plan can't be booked yet (checkout and the balance purchase both call this). */
export async function assertBookable(x: Exec, userId: string, item: Item) {
  const s = schedulePlan(Date.now(), { id: item.planId!, seats: item.seats ?? 1, period: item.period }, await livePurchases(x, userId));
  if (s.mode === "blocked") throw new HttpError(409, blockedCopy(item, s), { schedule: { mode: s.mode, bookableFrom: s.bookableFrom, startsAt: s.startsAt } });
  return s;
}

/** For the plans sheet: what buying each plan and period would do right now (start now, renew, queue or blocked). */
export async function planOffers(userId: string) {
  const live = await livePurchases(db(), userId);
  const now = Date.now();
  const out: Record<string, { mode: Schedule["mode"]; startsAt: number; expiresAt: number; bookableFrom: number | null; usd: number }> = {};
  for (const p of PLANS.filter((x) => x.usd > 0 && !x.later)) {
    for (const period of PERIODS) {
      const item = itemFor("plan", p.id, period);
      const s = schedulePlan(now, { id: p.id, seats: p.seats, period }, live);
      out[`${p.id}:${period}`] = { mode: s.mode, startsAt: s.startsAt, expiresAt: s.expiresAt, bookableFrom: s.bookableFrom ?? null, usd: item.usd };
    }
  }
  return out;
}

export async function buyPlanWithBalance(userId: string, planId: string, period: Period, key: string) {
  const item = itemFor("plan", planId, period);
  const micros = usdToMicros(item.usd);
  const ref = `plan:${userId}:${key}:${item.planId}:${item.period}`;
  const out = await db().transaction(async (tx) => {
    // The balance row lock in charge() serializes purchases, so the schedule below can't race another one.
    const c = await charge(tx, userId, micros, "plan", ref, item.title.replace(" plan,", ""));
    if (c.already) {
      const [row] = await tx.select().from(planPurchases).where(eq(planPurchases.tx, `balance:${ref}`)).limit(1);
      return { already: true, balance: c.balance, plan: row ? { id: row.plan, period: (row.period as Period) ?? "monthly", startsAt: (row.startsAt ?? row.createdAt).getTime(), expiresAt: row.expiresAt.getTime() } : null };
    }
    const s = schedulePlan(Date.now(), { id: item.planId!, seats: item.seats ?? 1, period: item.period }, await livePurchases(tx, userId));
    if (s.mode === "blocked") throw new HttpError(409, blockedCopy(item, s)); // rolls the charge back
    const when = await grantPlan(tx, userId, item, { tx: `balance:${ref}`, amount: micros, payer: "balance" });
    return { already: false, balance: c.balance, plan: { id: item.planId!, period: item.period!, startsAt: when.startsAt, expiresAt: when.expiresAt }, mode: when.mode };
  });
  if (!out.already && out.plan) await announcePlan(userId, ref, out.plan, "Paid from your balance");
  return { ...out, charged: out.already ? 0 : micros, usd: item.usd };
}
