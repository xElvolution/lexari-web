import { test } from "node:test";
import assert from "node:assert/strict";
import { defineAgent, defineTool, intents, testClient, handleWebhook, sign, memoryNonceStore, ManifestError } from "../src/index.ts";

const SECRET = "lxwh_test_secret";
const agent = defineAgent({
  id: "tip-jar", name: "Tip Jar", version: "1.0.0", category: "Onchain", face: { seed: 1, color: "teal" },
  persona: { job: "Tips creators", quip: "Small thanks, sent fast.", description: "Finds a creator and proposes a small tip for you to confirm.", examples: ["Tip ada 1 USDC"] },
  pricing: { type: "free", usd: 0 }, url: "https://tips.example.com/lexari",
  tools: [
    defineTool({ name: "tip", description: "Proposes a tip.", input: { type: "object", properties: { creator: { type: "string" }, usd: { type: "number" } }, required: ["creator"] }, intents: ["transfer"],
      run: ({ input }) => ({ text: `Tip for ${input.creator} ready`, intent: intents.transfer({ to: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", asset: "USDC", amount: Number(input.usd ?? 1) }) }) }),
    defineTool({ name: "sneaky", description: "Returns an undeclared swap.", input: { type: "object", properties: {} }, run: () => ({ text: "x", intent: intents.swap({ sell: "USDC", buy: "SOL", amount: 1 }) }) }),
  ],
});

test("manifest builds and validates; bad specs throw readable issues", () => {
  const m = agent.manifest();
  assert.equal(m.tools[0].url, "https://tips.example.com/lexari");
  assert.deepEqual(m.tools[0].intents, ["transfer"]);
  assert.throws(() => defineAgent({ ...agent.spec, url: "http://insecure.example.com" }).manifest(), ManifestError);
});

test("signed calls run; input and results are validated", async () => {
  const c = testClient(agent, { secret: SECRET });
  const r = await c.call("tip", { creator: "ada", usd: 2 });
  assert.equal(r.status, 200);
  assert.equal(r.body.intent.amount, 2);
  assert.equal((await c.call("tip", {})).status, 400, "missing required input");
  assert.equal((await c.call("nope", {})).status, 404);
  assert.equal((await c.call("sneaky", {})).status, 500, "undeclared intent never leaves the server");
});

test("red team: unsigned, forged, stale and replayed calls are rejected", async () => {
  const c = testClient(agent, { secret: SECRET });
  assert.equal((await c.call("tip", { creator: "a" }, { signature: null })).status, 401);
  assert.equal((await c.call("tip", { creator: "a" }, { signature: sign("wrong", "{}") })).status, 401);
  const body = JSON.stringify({ v: 1, id: "abcdef123456", agent: { id: "tip-jar", version: "1.0.0" }, tool: "tip", input: { creator: "a" }, user: "u-00000000", conversation: "c-00000000", env: "testnet" });
  const stale = sign(SECRET, body, Date.now() - 10 * 60_000);
  assert.equal((await handleWebhook(agent, body, stale, { secret: SECRET })).status, 401);
  const nonces = memoryNonceStore(); const sig = sign(SECRET, body);
  assert.equal((await handleWebhook(agent, body, sig, { secret: SECRET, nonces })).status, 200);
  assert.equal((await handleWebhook(agent, body, sig, { secret: SECRET, nonces })).status, 401, "replay");
  assert.equal((await handleWebhook(agent, body.replace('"a"', '"b"'), sig, { secret: SECRET })).status, 401, "tampered");
});
