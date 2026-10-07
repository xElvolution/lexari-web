import { test } from "node:test";
import assert from "node:assert/strict";
import { schedulePlan, type ActivePurchase } from "./schedule";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 6, 12);
const PRO = { id: "pro", seats: 5 }, MAX = { id: "plus", seats: 20 };
const p = (plan: string, seats: number, startDay: number, endDay: number): ActivePurchase => ({ plan, seats, startsAt: NOW + startDay * DAY, expiresAt: NOW + endDay * DAY });

test("nothing active: a plan starts now and runs 30 days", () => {
  assert.deepEqual(schedulePlan(NOW, PRO, []), { startsAt: NOW, expiresAt: NOW + 30 * DAY });
  // expired purchases are ignored
  assert.equal(schedulePlan(NOW, PRO, [p("plus", 20, -40, -10)]).startsAt, NOW);
});

test("renewing the same plan early adds on to the end, nothing is lost", () => {
  const r = schedulePlan(NOW, PRO, [p("pro", 5, -20, 10)]);
  assert.equal(r.startsAt, NOW + 10 * DAY);
  assert.equal(r.expiresAt, NOW + 40 * DAY);
  // and again, after the queued renewal
  assert.equal(schedulePlan(NOW, PRO, [p("pro", 5, -20, 10), p("pro", 5, 10, 40)]).startsAt, NOW + 40 * DAY);
});

test("a bigger plan starts at once", () => {
  assert.equal(schedulePlan(NOW, MAX, [p("pro", 5, -5, 25)]).startsAt, NOW);
});

test("a smaller plan waits until the bigger one ends", () => {
  assert.equal(schedulePlan(NOW, PRO, [p("plus", 20, -5, 25)]).startsAt, NOW + 25 * DAY);
  // after an upgrade, the leftover Pro days and Max both count: Pro starts after everything active
  assert.equal(schedulePlan(NOW, { id: "free-ish", seats: 1 }, [p("plus", 20, 0, 30), p("pro", 5, -5, 25)]).startsAt, NOW + 30 * DAY);
});
