import { test } from "node:test";
import assert from "node:assert/strict";
import { billedFor, chainFor, costMicros, creditsAvailable, decide, estimateTokens, share, split, usdToMicros, type MeterSnapshot } from "./math";
import { LAMINA, PREMIUM, burnVsSonnet, turnCostUsd } from "@/content/models";

const $ = usdToMicros;
const paid = (o: Partial<MeterSnapshot> = {}): MeterSnapshot => ({ paid: true, laminaLeft: $(3), premiumLeft: $(20), credits: 0, creditsSpent: 0, spendMode: "fixed", spendLimit: $(25), freeUsed: 0, freePerDay: 30, ...o });
const free = (o: Partial<MeterSnapshot> = {}): MeterSnapshot => ({ ...paid(), paid: false, laminaLeft: 0, premiumLeft: 0, creditsOnFree: true, ...o });

test("engine cost in micro dollars from per-million prices", () => {
  // 3,000 in + 400 out at Lamina's list price (0.45 / 2.25 per M) = $0.00135 + $0.0009 = $0.00225
  assert.equal(costMicros(LAMINA.price, 3000, 400), 2250);
  // Claude Sonnet 5.5 (2 / 10): $0.006 + $0.004 = $0.01
  assert.equal(costMicros(PREMIUM[0].price, 3000, 400), 10_000);
  assert.equal(costMicros(PREMIUM[0].price, 0, 0), 0);
  assert.equal(costMicros({ in: 0.029, out: 1.32 }, 1, 0), 1); // rounds up, never free by rounding
});

test("Lexari rate: premium pools pay API price + 20%, the Lamina pool pays engine cost", () => {
  assert.equal(billedFor("premium", 10_000), 12_000);
  assert.equal(billedFor("credits", 10_000), 12_000);
  assert.equal(billedFor("lamina", 2250), 2250);
  assert.equal(billedFor("premium", 10_000, 0), 10_000); // markup is a constant the owner can set to 0
  // the study's burn table: a typical Sonnet turn is $0.012 at the Lexari rate, about 1,660 turns per $20
  assert.equal(Math.floor($(20) / billedFor("premium", costMicros(PREMIUM[0].price, 3000, 400))), 1666);
});

test("burn chips against Sonnet", () => {
  assert.equal(burnVsSonnet(PREMIUM[0]), 1);
  assert.equal(burnVsSonnet(PREMIUM[1]), 2); // Opus
  assert.ok(burnVsSonnet(LAMINA) < 0.3);
  assert.ok(Math.abs(turnCostUsd(LAMINA.price) - 0.00225) < 1e-9);
});

test("pool chains", () => {
  assert.deepEqual(chainFor(true, "lamina"), ["lamina", "premium", "credits"]);
  assert.deepEqual(chainFor(true, "premium"), ["premium", "credits"]);
  assert.deepEqual(chainFor(false, "lamina", true), ["free", "credits"]);
  assert.deepEqual(chainFor(false, "lamina", false), ["free"]);
  assert.deepEqual(chainFor(false, "premium", false), []);
});

test("Free: 30 Lamina messages a day, then credits or a block", () => {
  const ok = decide(free({ freeUsed: 29 }), "lamina", 5000);
  assert.deepEqual(ok, { ok: true, pool: "free", chain: ["free", "credits"], hold: 0 });
  const out = decide(free({ freeUsed: 30 }), "lamina", 5000);
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.reason, "free_daily");
  const withCredits = decide(free({ freeUsed: 30, credits: $(5) }), "lamina", 5000);
  assert.deepEqual(withCredits, { ok: true, pool: "credits", chain: ["credits"], hold: 6000 });
});

test("Free: premium models need credits", () => {
  const locked = decide(free(), "premium", 10_000);
  assert.equal(!locked.ok && locked.reason, "premium_locked");
  const lockedNoCreditsOnFree = decide(free({ credits: $(5), creditsOnFree: false }), "premium", 10_000);
  assert.equal(!lockedNoCreditsOnFree.ok && lockedNoCreditsOnFree.reason, "premium_locked");
  const ok = decide(free({ credits: $(5) }), "premium", 10_000);
  assert.ok(ok.ok && ok.pool === "credits" && ok.hold === 12_000);
});

test("Paid Lamina spills: Lamina pool, then premium, then credits, then out of usage", () => {
  assert.ok((() => { const d = decide(paid(), "lamina", 2250); return d.ok && d.pool === "lamina" && d.hold === 2250; })());
  const d2 = decide(paid({ laminaLeft: 0 }), "lamina", 2250);
  assert.ok(d2.ok && d2.pool === "premium" && d2.hold === 2700 && d2.chain.join() === "premium,credits");
  const d3 = decide(paid({ laminaLeft: 0, premiumLeft: 0, credits: $(10) }), "lamina", 2250);
  assert.ok(d3.ok && d3.pool === "credits");
  const d4 = decide(paid({ laminaLeft: 0, premiumLeft: 0 }), "lamina", 2250);
  assert.equal(!d4.ok && d4.reason, "out_of_usage");
});

test("Paid premium never draws on the Lamina pool", () => {
  const d = decide(paid({ premiumLeft: 0 }), "premium", 10_000);
  assert.equal(!d.ok && d.reason, "out_of_usage");
  assert.ok(!d.ok && !d.chain.includes("lamina"));
});

test("hold is capped by what is left in the pool", () => {
  const d = decide(paid({ laminaLeft: 1000 }), "lamina", 2250);
  assert.ok(d.ok && d.pool === "lamina" && d.hold === 1000);
});

test("spend limit caps extra credits", () => {
  assert.equal(creditsAvailable({ credits: $(10), creditsSpent: $(24), spendMode: "fixed", spendLimit: $(25) }), $(1));
  assert.equal(creditsAvailable({ credits: $(10), creditsSpent: $(99), spendMode: "unlimited", spendLimit: $(25) }), $(10));
  assert.equal(creditsAvailable({ credits: $(10), creditsSpent: 0, spendMode: "disabled", spendLimit: $(25) }), 0);
  const d = decide(paid({ laminaLeft: 0, premiumLeft: 0, credits: $(10), creditsSpent: $(25) }), "premium", 10_000);
  assert.equal(!d.ok && d.reason, "spend_limit");
});

test("settle splits real cost across the chain at each pool's rate", () => {
  // all in the Lamina pool
  assert.deepEqual(split(paid(), ["lamina", "premium", "credits"], 2250), { lamina: 2250, premium: 0, credits: 0, billed: 2250, absorbed: 0, free: false });
  // 1,000 left in Lamina: 1,000 there, the other 1,250 of engine cost at +20% = 1,500 from premium
  assert.deepEqual(split(paid({ laminaLeft: 1000 }), ["lamina", "premium", "credits"], 2250), { lamina: 1000, premium: 1500, credits: 0, billed: 2500, absorbed: 0, free: false });
  // premium almost empty: 6,000 there (covers 5,000 of cost), the remaining 5,000 of cost = 6,000 from credits
  assert.deepEqual(split(paid({ premiumLeft: 6000, credits: $(5) }), ["premium", "credits"], 10_000), { lamina: 0, premium: 6000, credits: 6000, billed: 12_000, absorbed: 0, free: false });
  // nothing can cover the rest: Lexari absorbs it instead of charging past the limit
  const s = split(paid({ premiumLeft: 6000 }), ["premium", "credits"], 10_000);
  assert.equal(s.billed, 6000);
  assert.equal(s.absorbed, 5000);
  // free turns are free
  assert.deepEqual(split(free(), ["free", "credits"], 2250), { lamina: 0, premium: 0, credits: 0, billed: 0, absorbed: 0, free: true });
});

test("token estimate and meter share", () => {
  assert.equal(estimateTokens("abcdefgh"), 2);
  assert.equal(estimateTokens([{ content: "abcd" }, { content: "" }]), 1 + 4 + 0 + 4);
  assert.equal(share(50, 100), 0.5);
  assert.equal(share(150, 100), 1);
  assert.equal(share(0, 0), 0);
});
