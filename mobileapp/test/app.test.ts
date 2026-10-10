import assert from "node:assert/strict";
import test from "node:test";
import { isSolanaMobile, userAgent } from "../src/lib/device.ts";
import { asCluster, networkBadge, solscanTx } from "../src/lib/network.ts";
import { takeSse } from "../src/lib/sse.ts";
import { findSecrets, isBlockedKind, scanSecrets } from "../src/lib/secretScan.ts";

test("seeker and saga are solana mobile, a pixel is not", () => {
  assert.equal(isSolanaMobile({ brand: "solanamobile", model: "Seeker" }), true);
  assert.equal(isSolanaMobile({ manufacturer: "Solana Mobile", model: "Saga" }), true);
  assert.equal(isSolanaMobile({ brand: "Google", model: "Pixel 7" }), false);
  assert.equal(userAgent("1.0.0", "Pixel 7"), "LexariAndroid/1.0.0 (Pixel 7)");
});

test("badges and solscan", () => {
  assert.equal(asCluster(undefined), "devnet");
  assert.equal(networkBadge("mainnet-beta").tone, "real");
  assert.equal(networkBadge("devnet").label.includes("TESTNET"), true);
  assert.equal(solscanTx("abc", "mainnet-beta").includes("cluster"), false);
  assert.match(solscanTx("abc", "devnet"), /cluster=devnet/);
});

test("sse frames", () => {
  const first = takeSse('data: {"token":"hi"}\n\n');
  assert.deepEqual(first.events, ['{"token":"hi"}']);
  const split = takeSse('data: {"token":"a"}\n\ndata: {"done":true}\n\npartial');
  assert.equal(split.events.length, 2);
  assert.equal(split.rest, "partial");
});

test("seed phrases are blocked and ordinary chat is not", async () => {
  const phrase = "abandon ability able about above absent absorb abstract absurd abuse access accident";
  const seeds = scanSecrets(phrase);
  assert.equal(seeds.some((f) => f.kind === "seed"), true);
  assert.equal(isBlockedKind("seed"), true);
  assert.equal(isBlockedKind("private"), true);
  assert.equal(isBlockedKind("key"), false);
  assert.equal(scanSecrets("hello from lexari").length, 0);
  const keys = await findSecrets("abandon ability able about above absent absorb abstract absurd abuse access accident");
  assert.equal(keys.some((f) => isBlockedKind(f.kind)), true);
});
