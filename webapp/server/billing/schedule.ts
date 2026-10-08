/** When a newly bought plan starts and ends, and the monthly usage cycles inside it. Pure, so the rules are unit tested. */
import { PLAN_DAYS, type Period } from "@/content/appData";

export type ActivePurchase = { id?: string; plan: string; seats: number; period?: Period; startsAt: number; expiresAt: number };
const DAY = 86_400_000;
/** A purchase can be booked at most this far ahead of when it would start (one renewal, or the last month of a year). */
export const BOOK_AHEAD_DAYS = 31;

/** Adds calendar months in UTC, keeping the day of the month (clamped: 31 Jan + 1 month = 28 or 29 Feb). */
export function addUtcMonths(ms: number, months: number) {
  const d = new Date(ms);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return target.getTime();
}

/** How long a period runs from `start`: 30 days, or one calendar year. */
export const periodEnd = (start: number, period: Period = "monthly") => (period === "yearly" ? addUtcMonths(start, 12) : start + PLAN_DAYS * DAY);

/**
 * The usage cycle a purchase is in at `now`. Monthly plans are one cycle. A yearly plan has twelve monthly cycles
 * anchored on the day it started, so its pools refill every month instead of one month's usage lasting a year.
 */
export function cycleWindow(now: number, p: { startsAt: number; expiresAt: number; period?: Period }) {
  if (p.period !== "yearly") return { start: p.startsAt, end: Math.min(p.expiresAt, p.startsAt + PLAN_DAYS * DAY), index: 0 };
  let k = 0;
  while (k < 12 && addUtcMonths(p.startsAt, k + 1) <= now) k++;
  return { start: addUtcMonths(p.startsAt, k), end: Math.min(p.expiresAt, addUtcMonths(p.startsAt, k + 1)), index: k };
}

export type Mode = "now" | "upgrade" | "renew" | "queued" | "blocked";
export type Schedule = {
  startsAt: number; expiresAt: number; mode: Mode;
  /** blocked: the first day it can be booked */
  bookableFrom?: number;
  /** upgrade: smaller plans that pause now and pick up again, with the days they had left, when this one ends */
  shift: { id: string; startsAt: number; expiresAt: number }[];
};

/**
 * - Nothing active: starts now.
 * - The same plan already active or queued (either period): starts when the last of it ends, so renewing early, or
 *   moving from monthly to yearly, loses nothing.
 * - A bigger plan: starts now with fresh pools. Smaller plans you already paid for pause and resume afterwards with
 *   the days they had left (a yearly Pro under a month of Max keeps its remaining months).
 * - A smaller plan: starts when everything active ends.
 * - Anything that would start more than BOOK_AHEAD_DAYS away is blocked until then (for example a monthly plan in the
 *   middle of a yearly one, or a second renewal ahead).
 */
export function schedulePlan(now: number, plan: { id: string; seats: number; period?: Period }, active: ActivePurchase[]): Schedule {
  const live = active.filter((a) => a.expiresAt > now);
  const started = live.filter((a) => a.startsAt <= now);
  const best = [...started].sort((a, b) => b.seats - a.seats)[0];
  const same = live.filter((a) => a.plan === plan.id);
  let start = now;
  let mode: Mode = "now";
  if (same.length) { start = Math.max(now, ...same.map((a) => a.expiresAt)); mode = start > now ? "renew" : "now"; }
  else if (!best) mode = "now";
  else if (plan.seats > best.seats) mode = "upgrade";
  else { start = Math.max(now, ...live.map((a) => a.expiresAt)); mode = "queued"; }
  const expiresAt = periodEnd(start, plan.period);
  const shift: Schedule["shift"] = [];
  if (mode === "upgrade") {
    let cursor = expiresAt;
    for (const a of live.filter((x) => x.seats < plan.seats && x.id).sort((x, y) => x.startsAt - y.startsAt)) {
      const left = a.expiresAt - Math.max(a.startsAt, now);
      shift.push({ id: a.id!, startsAt: cursor, expiresAt: cursor + left });
      cursor += left;
    }
  }
  if (start - now > BOOK_AHEAD_DAYS * DAY) return { startsAt: start, expiresAt, mode: "blocked", bookableFrom: start - BOOK_AHEAD_DAYS * DAY, shift: [] };
  return { startsAt: start, expiresAt, mode, shift };
}
