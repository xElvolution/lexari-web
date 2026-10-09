// Run: npx tsx --test server/engram/byo.test.ts
// A local mock server speaks the three wire formats (OpenAI-compatible, Anthropic Messages, Gemini) so the streaming,
// parsing, auth headers and error mapping are checked without a third-party key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { cleanBaseUrl, privateAddress, streamByo, testByo } from "./byo";
import { open, seal } from "../secretBox";

process.env.BYO_ALLOW_PRIVATE = "1";
process.env.MODEL_KEYS_SECRET = Buffer.alloc(32, 7).toString("base64");

const seen: { path: string; auth: string; body: Record<string, unknown> }[] = [];
const srv = createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    const auth = String(req.headers.authorization || req.headers["x-api-key"] || req.headers["x-goog-api-key"] || "");
    seen.push({ path: req.url || "", auth, body });
    if (!auth.endsWith("good-key-1234")) { res.writeHead(401); res.end('{"error":{"message":"bad key"}}'); return; }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const sse = (o: unknown) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    if (req.url?.endsWith("/messages")) {
      sse({ type: "message_start", message: { usage: { input_tokens: 11 } } });
      for (const t of ["Hello ", "from ", "Claude"]) sse({ type: "content_block_delta", delta: { type: "text_delta", text: t } });
      sse({ type: "message_delta", usage: { output_tokens: 3 } });
    } else if (req.url?.includes(":streamGenerateContent")) {
      for (const t of ["Hello ", "from Gemini"]) sse({ candidates: [{ content: { parts: [{ text: t }] } }] });
      sse({ candidates: [], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4 } });
    } else {
      for (const t of ["Hello ", "from ", "OpenAI"]) sse({ choices: [{ delta: { content: t } }] });
      sse({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 3 } });
      res.write("data: [DONE]\n\n");
    }
    res.end();
  });
});
let base = "";
test.before(async () => { await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r)); base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`; });
const msgs = [{ role: "system" as const, content: "You are Nova." }, { role: "assistant" as const, content: "Hi" }, { role: "user" as const, content: "Say hello" }];

async function run(provider: "openai" | "anthropic" | "gemini" | "custom" | "xai", baseUrl: string, key = "good-key-1234") {
  let out = ""; let usage: unknown = null;
  for await (const t of streamByo(msgs, { provider, model: "m-1", key, baseUrl, label: "Mock" }, { maxTokens: 50, onUsage: (u) => (usage = u) })) out += t;
  return { out, usage: usage as { promptTokens: number; completionTokens: number; costUsd: number } };
}

test("OpenAI-compatible stream, usage, bearer key", async () => {
  const r = await run("custom", `${base}/v1`);
  assert.equal(r.out, "Hello from OpenAI");
  assert.equal(r.usage.promptTokens, 7); assert.equal(r.usage.costUsd, 0);
  const last = seen[seen.length - 1];
  assert.equal(last.path, "/v1/chat/completions"); assert.equal(last.auth, "Bearer good-key-1234");
  assert.equal(last.body.max_tokens, 50);
});
test("OpenAI provider uses max_completion_tokens", async () => {
  await run("openai", `${base}/v1`);
  assert.equal(seen[seen.length - 1].body.max_completion_tokens, 50);
});
test("Anthropic Messages stream with system split out and alternating turns", async () => {
  const r = await run("anthropic", `${base}/v1`);
  assert.equal(r.out, "Hello from Claude");
  assert.deepEqual([r.usage.promptTokens, r.usage.completionTokens], [11, 3]);
  const b = seen[seen.length - 1].body as { system: string; messages: { role: string }[] };
  assert.equal(b.system, "You are Nova.");
  assert.equal(b.messages[0].role, "user"); // a leading assistant turn gets a user turn before it
});
test("Gemini streamGenerateContent with systemInstruction", async () => {
  const r = await run("gemini", `${base}/v1beta`);
  assert.equal(r.out, "Hello from Gemini");
  const last = seen[seen.length - 1];
  assert.match(last.path, /\/v1beta\/models\/m-1:streamGenerateContent\?alt=sse/);
  assert.ok((last.body as { systemInstruction?: unknown }).systemInstruction);
});
test("a rejected key becomes a friendly error, and Test connection reports it", async () => {
  await assert.rejects(run("custom", `${base}/v1`, "bad-key-0000"), (e: { friendly?: string }) => /rejected your API key/.test(e.friendly || ""));
  const t = await testByo({ provider: "custom", model: "m-1", key: "bad-key-0000", baseUrl: `${base}/v1`, label: "Mock" });
  assert.equal(t.ok, false);
  const ok = await testByo({ provider: "custom", model: "m-1", key: "good-key-1234", baseUrl: `${base}/v1`, label: "Mock" });
  assert.equal(ok.ok, true);
});
test("keys are sealed with AES-GCM and bound to the user", () => {
  const s = seal("sk-secret-abcd", "model:u1");
  assert.ok(!s.includes("sk-secret"));
  assert.equal(open(s, "model:u1"), "sk-secret-abcd");
  assert.throws(() => open(s, "model:u2"));
});
test("private addresses and odd URLs are refused", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1", "100.64.0.1"]) assert.equal(privateAddress(ip), true, ip);
  for (const ip of ["8.8.8.8", "104.18.0.1", "2606:4700::1"]) assert.equal(privateAddress(ip), false, ip);
  assert.equal(cleanBaseUrl("https://api.example.com/v1/chat/completions/"), "https://api.example.com/v1");
  assert.throws(() => cleanBaseUrl("https://user:pw@api.example.com/v1"));
});
test.after(() => srv.close());

test("model catalog: key models appear only with a key, switches and defaults", async () => {
  const { modelCatalog, enabledIds, parseKeyModel, keyModelInfo } = await import("@/content/models");
  const none = modelCatalog([], {}, { lamina: true });
  assert.deepEqual(none.map((r) => r.m.id), ["lamina"]);
  const rows = modelCatalog(["openai"], { off: ["key:openai:gpt-6-astra"], on: ["key:openai:gpt-5.6-sol"], extra: ["key:openai:my-ft-model", "key:anthropic:claude-x"] }, { lamina: true, "grok-fast": true });
  const on = enabledIds(rows);
  assert.ok(on.has("lamina") && on.has("grok-fast"));
  assert.ok(!on.has("key:openai:gpt-6-astra"));
  assert.ok(on.has("key:openai:gpt-5.6-sol") && on.has("key:openai:gpt-6-luna") && on.has("key:openai:my-ft-model"));
  assert.ok(!rows.some((r) => r.m.id.startsWith("key:anthropic")));
  assert.deepEqual(parseKeyModel("key:openrouter:anthropic/claude-sonnet-5.5"), { provider: "openrouter", model: "anthropic/claude-sonnet-5.5" });
  assert.equal(parseKeyModel("byo:123"), null);
  assert.equal(keyModelInfo("key:anthropic:claude-opus-5-5")?.label, "Claude Opus 5.5");
  assert.equal(keyModelInfo("key:anthropic:claude-opus-5-5")?.pool, "byo");
});
