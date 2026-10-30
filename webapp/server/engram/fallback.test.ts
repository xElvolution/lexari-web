/**
 * Fallback chains for open models, run through streamCompletion against local OpenAI-compatible servers:
 * a failing model hands over to the next in its chain before any text, HOUSE_FALLBACKS reorders or empties the
 * chain, and HOUSE_FALLBACK_LAMINA=0 turns off the Lamina last resort.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { modelById } from "@/content/models";
import { streamCompletion } from "./cortex";
import { fallbackOverrides, houseChain } from "./house";

const servers: Server[] = [];
const hits: string[] = [];
function serve(name: string, ok: boolean): Promise<string> {
  return new Promise((res) => {
    const s = createServer((req, rsp) => {
      req.resume();
      hits.push(name);
      if (!ok) { rsp.writeHead(500, { "content-type": "application/json" }); rsp.end('{"error":"down"}'); return; }
      rsp.writeHead(200, { "content-type": "text/event-stream" });
      rsp.end(`data: {"choices":[{"delta":{"content":"from ${name}"}}]}\n\ndata: [DONE]\n\n`);
    });
    servers.push(s);
    s.listen(0, "127.0.0.1", () => res(`http://127.0.0.1:${(s.address() as AddressInfo).port}/v1`));
  });
}
const KEYS = ["MOONSHOT_API_KEY", "MOONSHOT_BASE_URL", "DASHSCOPE_API_KEY", "DASHSCOPE_BASE_URL", "ZG_COMPUTE_API_KEY", "ZG_COMPUTE_BASE_URL", "HOUSE_FALLBACKS", "HOUSE_FALLBACK_LAMINA", "LLM_PROVIDER", "OPENAI_API_KEY", "OPENAI_BASE_URL", "BYO_ALLOW_PRIVATE", "OPENROUTER_API_KEY"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
let up = "", down = "", lamina = "", zg = "";
before(async () => {
  [up, down, lamina, zg] = await Promise.all([serve("qwen", true), serve("kimi", false), serve("lamina", true), serve("zg", false)]);
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, {
    BYO_ALLOW_PRIVATE: "1", MOONSHOT_API_KEY: "k", MOONSHOT_BASE_URL: down, DASHSCOPE_API_KEY: "q", DASHSCOPE_BASE_URL: up,
    ZG_COMPUTE_API_KEY: "z", ZG_COMPUTE_BASE_URL: zg, LLM_PROVIDER: "openai", OPENAI_API_KEY: "l", OPENAI_BASE_URL: lamina,
  });
});
after(() => { for (const s of servers) s.close(); for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

async function reply(id: string) {
  let out = "";
  for await (const t of streamCompletion([{ role: "user", content: "hi" }], undefined, { model: modelById(id)! })) out += t;
  return out;
}

test("HOUSE_FALLBACKS: parsed per model, unknown ids, repeats and self dropped, empty means none", () => {
  assert.deepEqual(fallbackOverrides("kimi=qwen, openai,qwen,kimi,nope; qwen=; bogus=kimi"), { kimi: ["qwen", "openai"], qwen: [] });
  assert.deepEqual(fallbackOverrides(""), {});
  assert.deepEqual(fallbackOverrides("claude=openai,kimi,qwen,openai"), { claude: ["openai", "kimi", "qwen"] });
});

test("the default chain: Kimi fails before any text, Qwen answers", async () => {
  hits.length = 0;
  assert.deepEqual(houseChain(modelById("kimi")!).map((m) => m.id), ["kimi", "qwen", "openai"]);
  assert.equal(await reply("kimi"), "from qwen");
  assert.deepEqual(hits, ["kimi", "qwen"]);
});

test("an override reorders the chain: Kimi then OpenAI (on 0G, also down), then Lamina", async () => {
  process.env.HOUSE_FALLBACKS = "kimi=openai";
  try {
    hits.length = 0;
    assert.deepEqual(houseChain(modelById("kimi")!).map((m) => m.id), ["kimi", "openai"]);
    assert.equal(await reply("kimi"), "from lamina");
    assert.deepEqual(hits, ["kimi", "zg", "lamina"]);
  } finally { delete process.env.HOUSE_FALLBACKS; }
});

test("an empty override and HOUSE_FALLBACK_LAMINA=0: the error reaches the person, nothing else is called", async () => {
  process.env.HOUSE_FALLBACKS = "kimi=";
  process.env.HOUSE_FALLBACK_LAMINA = "0";
  try {
    hits.length = 0;
    await assert.rejects(() => reply("kimi"));
    assert.deepEqual(hits, ["kimi"]);
  } finally { delete process.env.HOUSE_FALLBACKS; delete process.env.HOUSE_FALLBACK_LAMINA; }
});
