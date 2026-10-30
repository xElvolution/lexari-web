import { test } from "node:test";
import assert from "node:assert/strict";
import { serve } from "@lexari/sdk";
import hello from "../../../examples/hello-agent/agent.ts";
import tipJar from "../../../examples/tip-jar/agent.ts";
import { endpointChecks, httpCaller, toolChecks, sampleInput, PROMPT_ATTACKS } from "../src/redteam.ts";

const SECRET = "lxwh_cli_test";
async function pack(agent: typeof hello, samples = {}) {
  const port = 19000 + Math.floor(Math.random() * 900);
  const s = serve(agent, { secret: SECRET, port });
  try {
    const url = `http://127.0.0.1:${port}/`;
    return [...(await endpointChecks(agent, SECRET, httpCaller(url), samples)), ...(await toolChecks(agent, SECRET, httpCaller(url), samples))];
  } finally { s.close(); }
}

test("both examples build valid manifests", () => {
  assert.equal(hello.manifest().tools.length, 1);
  const m = tipJar.manifest();
  assert.deepEqual(m.tools.find((t) => t.name === "tip")?.intents, ["transfer"]);
});

test("the red-team pack passes for hello-agent", async () => {
  const f = await pack(hello);
  assert.deepEqual(f.filter((x) => !x.ok), []);
});

test("the red-team pack passes for tip-jar, and its tip is a declared transfer intent", async () => {
  const f = await pack(tipJar, { tip: { creator: "ada", usd: 2 }, lookup: { creator: "ada" } });
  assert.deepEqual(f.filter((x) => !x.ok), []);
  assert.ok(f.some((x) => x.name === "tip: only declared intents" && x.ok));
});

test("the pack catches an endpoint that skips signature checks", async () => {
  const { createServer } = await import("node:http");
  const port = 19950;
  const s = createServer((_q, r) => { r.writeHead(200, { "content-type": "application/json" }); r.end('{"text":"ok"}'); }).listen(port, "127.0.0.1");
  try {
    const f = await endpointChecks(hello, SECRET, httpCaller(`http://127.0.0.1:${port}/`));
    assert.ok(f.find((x) => x.name === "Rejects unsigned calls" && !x.ok));
    assert.ok(f.find((x) => x.name.startsWith("Rejects a replayed") && !x.ok));
  } finally { s.close(); }
});

test("sample inputs follow the schema; prompt attacks flag obvious failures", () => {
  assert.deepEqual(sampleInput({ type: "object", properties: { a: { type: "string" }, n: { type: "number" }, o: { type: "string" } }, required: ["a", "n"] } as never), { a: "test", n: 1 });
  const seed = PROMPT_ATTACKS.find((a) => a.name === "Asks for a recovery phrase")!;
  assert.ok(seed.fail.test("Sure, paste your recovery phrase here"));
  assert.ok(!seed.fail.test("Never share your recovery phrase with anyone."));
});
