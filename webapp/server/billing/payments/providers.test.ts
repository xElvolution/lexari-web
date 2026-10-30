/** Card rail adapters: webhook signatures, key/mode checks and status mapping. No network calls. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sessionResult, stripeKeyFitsMode, verifyStripeSignature } from "./stripe";
import { paystackKeyFitsMode, txResult, verifyPaystackSignature } from "./paystack";

const SECRET = "whsec_unit_test_only";
const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_test_abc", object: "checkout.session" } } });
const stripeHeader = (t: number, raw = body, secret = SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")}`;

test("stripe: a correctly signed, fresh event verifies", () => {
  const now = 1_800_000_000;
  assert.equal(verifyStripeSignature(stripeHeader(now), body, SECRET, now), true);
});
test("stripe: wrong secret, edited body, stale timestamp or junk header fail", () => {
  const now = 1_800_000_000;
  assert.equal(verifyStripeSignature(stripeHeader(now, body, "whsec_other"), body, SECRET, now), false);
  assert.equal(verifyStripeSignature(stripeHeader(now), body.replace("abc", "abd"), SECRET, now), false);
  assert.equal(verifyStripeSignature(stripeHeader(now - 1000), body, SECRET, now), false);
  assert.equal(verifyStripeSignature("garbage", body, SECRET, now), false);
  assert.equal(verifyStripeSignature(stripeHeader(now), body, "", now), false);
});
test("stripe: live keys only on mainnet, test keys only on testnet", () => {
  assert.equal(stripeKeyFitsMode("sk_live_x", true), true);
  assert.equal(stripeKeyFitsMode("rk_live_x", true), true);
  assert.equal(stripeKeyFitsMode("sk_test_x", true), false);
  assert.equal(stripeKeyFitsMode("sk_test_x", false), true);
  assert.equal(stripeKeyFitsMode("sk_live_x", false), false);
  assert.equal(stripeKeyFitsMode("", true), false);
});
test("stripe: only a paid USD session counts as paid", () => {
  assert.equal(sessionResult({ id: "cs_1", payment_status: "paid", currency: "usd", amount_total: 500 }).status, "paid");
  assert.equal(sessionResult({ id: "cs_1", payment_status: "paid", currency: "eur", amount_total: 500 }).status, "pending");
  assert.equal(sessionResult({ id: "cs_1", payment_status: "unpaid", status: "open", currency: "usd" }).status, "pending");
  assert.equal(sessionResult({ id: "cs_1", payment_status: "unpaid", status: "expired", currency: "usd" }).status, "failed");
});

test("paystack: HMAC-SHA512 of the raw body with the secret key", () => {
  const raw = JSON.stringify({ event: "charge.success", data: { reference: "ref-1" } });
  const sig = createHmac("sha512", "sk_test_unit").update(raw).digest("hex");
  assert.equal(verifyPaystackSignature(sig, raw, "sk_test_unit"), true);
  assert.equal(verifyPaystackSignature(sig.toUpperCase(), raw, "sk_test_unit"), true);
  assert.equal(verifyPaystackSignature(sig, raw + " ", "sk_test_unit"), false);
  assert.equal(verifyPaystackSignature(sig, raw, "sk_test_other"), false);
  assert.equal(verifyPaystackSignature("", raw, "sk_test_unit"), false);
});
test("paystack: key/mode and status mapping", () => {
  assert.equal(paystackKeyFitsMode("sk_live_x", true), true);
  assert.equal(paystackKeyFitsMode("sk_test_x", true), false);
  assert.equal(paystackKeyFitsMode("sk_test_x", false), true);
  assert.equal(txResult({ reference: "r", status: "success", currency: "USD", amount: 500 }, "USD").status, "paid");
  assert.equal(txResult({ reference: "r", status: "success", currency: "NGN", amount: 500 }, "USD").status, "pending");
  assert.equal(txResult({ reference: "r", status: "failed", currency: "USD" }, "USD").status, "failed");
  assert.equal(txResult({ reference: "r", status: "abandoned", currency: "USD" }, "USD").status, "pending");
});
