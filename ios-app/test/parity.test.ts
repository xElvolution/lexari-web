import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const pairs = (src: string, re: RegExp) => [...src.matchAll(re)].map((m) => m.slice(1).join(" | "));

test("ORE bot gift: the phone shows the same honest facts as the web", () => {
  const re = /title: "([^"]+)", body: "([^"]+)"/g;
  const web = pairs(read("../../webapp/components/miner/OreGift.tsx"), re);
  const phone = pairs(read("../src/web/OreGift.tsx"), re);
  assert.equal(web.length, 3);
  assert.deepEqual(phone, web);
  for (const line of [...web, ...phone]) assert.ok(!line.includes("\u2014"), "no em dashes in UI copy");
  assert.match(web.join(" "), /devnet/);
  assert.match(web.join(" "), /remove/i);
});

test("open models: the phone picker lists the same ids, names and makers as the web", () => {
  const re = /id: "(kimi|qwen|zg)", label: "([^"]+)",(?: short: "[^"]+",)? maker: "([^"]+)"/g;
  const web = pairs(read("../../webapp/content/models.ts"), re);
  const phone = pairs(read("../src/web/ModelSheet.tsx"), re);
  assert.equal(web.length, 3);
  assert.deepEqual(phone, web);
});

test("consent popup: the phone asks for the same scopes, in the same words, with the same expiry choices", () => {
  const re = /(read|trade|bet|withdraw|transfer): \{ title: "([^"]+)", body: "([^"]+)"/g;
  const web = pairs(read("../../webapp/content/integrations.ts"), re);
  const phone = pairs(read("../src/content/access.ts"), re);
  assert.equal(web.length, 5);
  assert.deepEqual(phone, web);
  const scopes = /^  (solana|orca|tempo|hyperliquid|panta): (\[[^\]]+\]),$/gm;
  assert.deepEqual(pairs(read("../src/content/access.ts"), scopes), pairs(read("../../webapp/content/integrations.ts"), scopes));
  const exp = /EXPIRY_DAYS = (\[[^\]]+\])/;
  assert.equal(read("../src/content/access.ts").match(exp)?.[1], read("../../webapp/content/integrations.ts").match(exp)?.[1]);
  for (const line of [...web, ...phone]) assert.ok(!line.includes("\u2014"), "no em dashes in UI copy");
});

test("wallets: the phone offers the same chains as the web", () => {
  const re = /\{ id: "([a-z]+)", name: "([^"]+)", family: "(solana|evm)", network: "([^"]+)" \}/g;
  const web = pairs(read("../../webapp/content/wallets.ts"), re);
  assert.equal(web.length, 6);
  assert.deepEqual(pairs(read("../src/content/access.ts"), re), web);
});
