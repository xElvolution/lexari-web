import { test } from "node:test";
import assert from "node:assert/strict";
import { ShortBalance, usd } from "./balance";
import { fundRequest } from "../hireWallet";
import { packFor } from "@/content/billing";

test("a short balance answers 402 with the shortfall for Top up", () => {
  const e = new ShortBalance(1_000_000, 400_000, "Hiring Ava");
  assert.equal(e.status, 402);
  assert.match(e.message, /Hiring Ava costs \$1\.00 and your balance is \$0\.40\. Top up \$0\.60/);
  assert.deepEqual(e.extra, { billing: { reason: "short_balance", needMicros: 1_000_000, haveMicros: 400_000, shortMicros: 600_000 } });
});

test("money reads as dollars", () => {
  assert.equal(usd(2_500_000), "$2.50");
  assert.equal(usd(0), "$0.00");
});

test("the smallest pack that covers the shortfall", () => {
  assert.equal(packFor(600_000), 5);
  assert.equal(packFor(5_000_000), 5);
  assert.equal(packFor(5_000_001), 10);
  assert.equal(packFor(24_000_000), 25);
  assert.equal(packFor(90_000_000), 90); // past the largest pack: the shortfall in whole dollars
  assert.equal(packFor(185_400_000), 186);
});

test("a hired agent's fund tag is read in dollars, capped and rounded", () => {
  assert.deepEqual(fundRequest('ok <fund usd="2" for="API credits"/>'), { usd: 2, reason: "API credits" });
  assert.deepEqual(fundRequest('<fund usd="$3.456"/>'), { usd: 3.46, reason: "" });
  assert.deepEqual(fundRequest('<fund usd="500" for="a lot"/>'), { usd: 10, reason: "a lot" });
  assert.deepEqual(fundRequest('<fund usd="0.2"/>'), { usd: 1, reason: "" });
  assert.equal(fundRequest('<fund usd="0"/>'), null);
  assert.equal(fundRequest("no tag here"), null);
});
