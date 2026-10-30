import { test } from "node:test";
import assert from "node:assert/strict";
import { checkToolInput, intentSchema, manifestSchema, parseManifest, toolHint, webhookResponseSchema } from "../src/index.ts";
import { memoryNonceStore, sign, verify } from "../src/signature.ts";

export const sample = {
  manifestVersion: 1, id: "tip-jar", name: "Tip Jar", version: "1.0.0", category: "Onchain",
  face: { seed: 42, color: "teal" },
  persona: { job: "Tips creators", quip: "Small thanks, sent fast.", description: "Finds a creator's tip address and prepares a small tip for you to confirm.", examples: ["Tip Ada 1 USDC"] },
  tools: [{ name: "tip", description: "Looks up a creator and proposes a tip.", url: "https://tips.example.com/lexari", input: { type: "object", properties: { creator: { type: "string" }, usd: { type: "number" } }, required: ["creator"] }, intents: ["transfer"] }],
  pricing: { type: "hire", usd: 1 },
};

test("a good manifest parses with defaults", () => {
  const r = parseManifest(sample);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.manifest.model, "lamina"); assert.equal(r.manifest.persona.tone, "short"); }
});

test("rejects unsafe or invalid manifests", () => {
  const bad = (patch: (m: any) => void) => { const m = structuredClone(sample) as any; patch(m); return manifestSchema.safeParse(m).success; };
  assert.equal(bad((m) => { m.tools[0].url = "http://tips.example.com"; }), false, "plain http");
  assert.equal(bad((m) => { m.tools[0].url = "https://user:pw@tips.example.com"; }), false, "credentials in url");
  assert.equal(bad((m) => { m.model = "gpt-6-astra"; }), false, "BYO model");
  assert.equal(bad((m) => { m.tools[0].intents = ["withdraw"]; }), false, "unknown intent");
  assert.equal(bad((m) => { m.persona.quip = "Fast \u2014 always"; }), false, "em dash");
  assert.equal(bad((m) => { m.id = "Tip Jar"; }), false, "bad slug");
  assert.equal(bad((m) => { m.pricing = { type: "free", usd: 3 }; }), false, "free with a price");
  assert.equal(bad((m) => { m.tools.push({ ...m.tools[0] }); }), false, "duplicate tool");
  assert.equal(bad((m) => { m.extra = 1; }), false, "unknown key");
  assert.equal(bad((m) => { m.tools[0].input.required = ["nope"]; }), false, "required not in properties");
});

test("tool input is checked against the declared schema", () => {
  const spec = manifestSchema.parse(sample).tools[0];
  assert.deepEqual(checkToolInput(spec, { creator: "ada", usd: 1, junk: "x" }), { ok: true, value: { creator: "ada", usd: 1 } });
  assert.equal(checkToolInput(spec, { usd: 1 }).ok, false);
  assert.equal(checkToolInput(spec, { creator: 5 }).ok, false);
  assert.match(toolHint("tip-jar", spec), /^tip-jar\.tip \{/);
});

test("intents: only transfer and swap, well formed", () => {
  assert.ok(intentSchema.safeParse({ type: "transfer", to: "me", asset: "USDC", amount: 1 }).success);
  assert.ok(intentSchema.safeParse({ type: "swap", sell: "USDC", buy: "SOL", amount: 2 }).success);
  assert.equal(intentSchema.safeParse({ type: "swap", sell: "SOL", buy: "SOL", amount: 2 }).success, false);
  assert.equal(intentSchema.safeParse({ type: "transfer", to: "0xabc", asset: "USDC", amount: 1 }).success, false);
  assert.equal(intentSchema.safeParse({ type: "bridge", amount: 1 }).success, false);
  assert.equal(intentSchema.safeParse({ type: "transfer", to: "me", asset: "USDC", amount: -1 }).success, false);
  assert.equal(webhookResponseSchema.safeParse({ text: "hi", privateKey: "x" }).success, false);
});

test("signatures verify, and stale, tampered or replayed calls fail", async () => {
  const body = JSON.stringify({ a: 1 });
  const h = sign("s3cret", body);
  const nonces = memoryNonceStore();
  assert.equal((await verify("s3cret", body, h, { nonces })).ok, true);
  assert.deepEqual(await verify("s3cret", body, h, { nonces }), { ok: false, reason: "replay" });
  assert.deepEqual(await verify("other", body, sign("s3cret", body)), { ok: false, reason: "bad_signature" });
  assert.deepEqual(await verify("s3cret", body + " ", sign("s3cret", body)), { ok: false, reason: "bad_signature" });
  assert.deepEqual(await verify("s3cret", body, sign("s3cret", body, Date.now() - 10 * 60_000)), { ok: false, reason: "stale" });
  assert.deepEqual(await verify("s3cret", body, "t=1"), { ok: false, reason: "malformed" });
  assert.deepEqual(await verify("s3cret", body, undefined), { ok: false, reason: "missing" });
});
