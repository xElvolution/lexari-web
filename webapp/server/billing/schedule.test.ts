import { test } from "node:test";
import assert from "node:assert/strict";
import { addUtcMonths, cycleWindow, periodEnd, schedulePlan, type ActivePurchase } from "./schedule";
import { PLANS, perMonth, planPrice, yearSaving } from "@/content/appData";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 6, 12);
const PRO = { id: "pro", seats: 5 }, MAX = { id: "plus", seats: 20 };
const p = (plan: string, seats: number, startDay: number, endDay: number, extra: Partial<ActivePurchase> = {}): ActivePurchase => ({ plan, seats, startsAt: NOW + startDay * DAY, expiresAt: NOW + endDay * DAY, ...extra });

test("nothing active: a plan starts now and runs 30 days", () => {
  const r = schedulePlan(NOW, PRO, []);
  assert.equal(r.startsAt, NOW); assert.equal(r.expiresAt, NOW + 30 * DAY); assert.equal(r.mode, "now");
  // expired purchases are ignored
  assert.equal(schedulePlan(NOW, PRO, [p("plus", 20, -40, -10)]).startsAt, NOW);
});

test("yearly runs one calendar year", () => {
  const r = schedulePlan(NOW, { ...PRO, period: "yearly" }, []);
  assert.equal(r.startsAt, NOW);
  assert.equal(r.expiresAt, Date.UTC(2027, 9, 6, 12));
  assert.equal(periodEnd(Date.UTC(2028, 1, 29), "yearly"), Date.UTC(2029, 1, 28));
});

test("renewing the same plan early adds on to the end, nothing is lost", () => {
  const r = schedulePlan(NOW, PRO, [p("pro", 5, -20, 10)]);
  assert.equal(r.startsAt, NOW + 10 * DAY);
  assert.equal(r.expiresAt, NOW + 40 * DAY);
  assert.equal(r.mode, "renew");
  // a second renewal ahead is more than a month away: blocked until then
  const b = schedulePlan(NOW, PRO, [p("pro", 5, -20, 10), p("pro", 5, 10, 40)]);
  assert.equal(b.mode, "blocked");
  assert.equal(b.bookableFrom, NOW + 9 * DAY);
});

test("monthly to yearly on the same plan: the year starts when the month ends", () => {
  const r = schedulePlan(NOW, { ...PRO, period: "yearly" }, [p("pro", 5, -5, 25)]);
  assert.equal(r.mode, "renew");
  assert.equal(r.startsAt, NOW + 25 * DAY);
  assert.equal(r.expiresAt, addUtcMonths(NOW + 25 * DAY, 12));
});

test("monthly in the middle of a year is blocked until the last month", () => {
  const year = p("pro", 5, -30, 335, { period: "yearly" });
  const r = schedulePlan(NOW, PRO, [year]);
  assert.equal(r.mode, "blocked");
  assert.equal(r.bookableFrom, NOW + (335 - 31) * DAY);
  // in the last month it books normally
  assert.equal(schedulePlan(NOW + 320 * DAY, PRO, [year]).mode, "renew");
});

test("a bigger plan starts at once; a smaller plan you paid for pauses and resumes with its days", () => {
  const r = schedulePlan(NOW, MAX, [p("pro", 5, -5, 25, { id: "a" })]);
  assert.equal(r.startsAt, NOW); assert.equal(r.mode, "upgrade");
  assert.deepEqual(r.shift, [{ id: "a", startsAt: NOW + 30 * DAY, expiresAt: NOW + 55 * DAY }]);
  // a yearly Pro with 300 days left keeps them after a yearly Max
  const y = schedulePlan(NOW, { ...MAX, period: "yearly" }, [p("pro", 5, -65, 300, { id: "y", period: "yearly" })]);
  assert.equal(y.shift[0].startsAt, y.expiresAt);
  assert.equal(y.shift[0].expiresAt - y.shift[0].startsAt, 300 * DAY);
});

test("a smaller plan waits until the bigger one ends", () => {
  assert.equal(schedulePlan(NOW, PRO, [p("plus", 20, -5, 25)]).startsAt, NOW + 25 * DAY);
  assert.equal(schedulePlan(NOW, PRO, [p("plus", 20, -5, 25)]).mode, "queued");
  // after an upgrade, the leftover Pro days and Max both count: Pro starts after everything active
  assert.equal(schedulePlan(NOW, { id: "free-ish", seats: 1 }, [p("plus", 20, 0, 30), p("pro", 5, -5, 25)]).startsAt, NOW + 30 * DAY);
});

test("a yearly plan refills monthly: twelve cycles on the day it started", () => {
  const start = Date.UTC(2026, 0, 31, 9);
  const plan = { startsAt: start, expiresAt: addUtcMonths(start, 12), period: "yearly" as const };
  const c0 = cycleWindow(start + DAY, plan);
  assert.deepEqual(c0, { start, end: Date.UTC(2026, 1, 28, 9), index: 0 });
  const c1 = cycleWindow(Date.UTC(2026, 2, 1), plan);
  assert.equal(c1.index, 1); assert.equal(c1.start, Date.UTC(2026, 1, 28, 9)); assert.equal(c1.end, Date.UTC(2026, 2, 31, 9));
  const last = cycleWindow(plan.expiresAt - DAY, plan);
  assert.equal(last.index, 11); assert.equal(last.end, plan.expiresAt);
  // monthly plans are one cycle
  assert.deepEqual(cycleWindow(NOW + DAY, { startsAt: NOW, expiresAt: NOW + 30 * DAY }), { start: NOW, end: NOW + 30 * DAY, index: 0 });
});

test("yearly prices: 2 months free", () => {
  const pro = PLANS.find((x) => x.id === "pro")!, max = PLANS.find((x) => x.id === "plus")!;
  assert.equal(planPrice(pro, "monthly"), 20); assert.equal(planPrice(pro, "yearly"), 200);
  assert.equal(planPrice(max, "yearly"), 600);
  assert.equal(yearSaving(pro), 40); assert.equal(yearSaving(max), 120);
  assert.equal(perMonth(pro, "yearly"), 16.67); assert.equal(perMonth(max, "yearly"), 50);
});
