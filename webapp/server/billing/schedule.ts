/** When a newly bought plan starts and ends. Pure, so the renewal and upgrade rules are unit tested. */
import { PLAN_DAYS } from "@/content/appData";

export type ActivePurchase = { plan: string; seats: number; startsAt: number; expiresAt: number };
const DAY = 86_400_000;

/**
 * - Nothing active: starts now.
 * - Same plan already active or queued: extends it (starts when the last one ends), so renewing early loses nothing.
 * - A bigger plan: starts now (upgrades apply at once, with fresh pools).
 * - A smaller plan: starts when everything active ends (downgrades take effect at the end of the period).
 */
export function schedulePlan(now: number, plan: { id: string; seats: number }, active: ActivePurchase[]) {
  const live = active.filter((a) => a.expiresAt > now);
  const started = live.filter((a) => a.startsAt <= now);
  const best = started.sort((a, b) => b.seats - a.seats)[0];
  let start = now;
  const same = live.filter((a) => a.plan === plan.id);
  if (same.length) start = Math.max(now, ...same.map((a) => a.expiresAt));
  else if (!best || plan.seats > best.seats) start = now;
  else start = Math.max(now, ...live.map((a) => a.expiresAt));
  return { startsAt: start, expiresAt: start + PLAN_DAYS * DAY };
}
