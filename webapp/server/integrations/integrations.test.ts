import { test } from "node:test";
import assert from "node:assert/strict";
import { INTEGRATIONS, LIMITS, STATUS_LABEL } from "@/content/integrations";
import { stripToolTags, toolTags, hasToolTag } from "./chat";
import { TOOLS } from "./registry";
import { addressOfKey, checksum, evmAddress } from "./evm";
import { toolLabel } from "./cards";
import { toMarketItem } from "./market";

test("tool tags: both forms, JSON input, at most two per reply", () => {
  const t = 'Sure. <tool name="orca.swap">{"sell":"USDC","buy":"SOL","amount":1}</tool> and <tool name="solana.wallet"/> then <tool name="prices.get">{"symbol":"BTC"}</tool>';
  const calls = toolTags(t);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { name: "orca.swap", input: { sell: "USDC", buy: "SOL", amount: 1 } });
  assert.deepEqual(calls[1], { name: "solana.wallet", input: {} });
  assert.ok(hasToolTag(t));
  assert.equal(toolTags('<tool name="x.y">not json</tool>')[0].input && typeof toolTags('<tool name="x.y">not json</tool>')[0].input, "object");
});

test("tool tags never reach the screen, even half written", () => {
  assert.equal(stripToolTags('Here you go. <tool name="orca.quote">{"amount":1}</tool>'), "Here you go.");
  assert.equal(stripToolTags('Done <tool name="solana.wallet"/> ok'), "Done  ok");
  assert.equal(stripToolTags('Checking <tool name="orca.quote">{"amou'), "Checking");
});

test("registry: every addable integration has tools, coming soon ones have none", () => {
  for (const i of INTEGRATIONS) {
    const tools = TOOLS.filter((t) => t.connector === i.id);
    if (i.builtin) { assert.equal(i.addable, false); assert.ok(tools.length > 0, `${i.id} (built in) has tools`); continue; }
    if (i.addable) assert.ok(tools.length > 0, `${i.id} has tools`);
    else assert.equal(tools.length, 0, `${i.id} has no tools`);
    if (i.status === "soon") assert.equal(i.addable, false);
    // moving money only on devnet integrations
    if (i.moves) assert.ok(["devnet", "live", "needskey"].includes(i.status), `${i.id} moves money only on devnet / testnet`);
    if (tools.some((t) => t.risk === "sign")) assert.ok(i.moves, `${i.id} signs, so it shows limits`);
  }
  for (const t of TOOLS) assert.ok(INTEGRATIONS.some((i) => i.id === t.connector && (i.addable || i.builtin)), `${t.name} belongs to an addable integration`);
  assert.equal(new Set(TOOLS.map((t) => t.name)).size, TOOLS.length);
  assert.ok(LIMITS.perTx.def <= LIMITS.daily.def && LIMITS.perTx.max <= LIMITS.daily.max);
});

test("UI copy: no dashes and no engine names", () => {
  const copy = JSON.stringify([INTEGRATIONS, STATUS_LABEL]);
  assert.doesNotMatch(copy, /[\u2013\u2014]/);
  assert.doesNotMatch(copy, /kimi|deepseek|grok|openai|claude|gemini/i);
});

test("EVM addresses: EIP-55 checksum and one stable address per agent", () => {
  assert.equal(checksum("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"), "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
  assert.equal(checksum("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359"), "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359");
  const one = new Uint8Array(32); one[31] = 1;
  assert.equal(addressOfKey(one), "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf"); // private key 1, a well known vector
  process.env.SESSION_SECRET ||= "0123456789abcdef0123456789abcdef0123456789abcdef";
  const a = evmAddress("u1", "home"), b = evmAddress("u1", "home"), c = evmAddress("u1", "c-scout");
  assert.match(a, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(checksum(a.toLowerCase()), a);
});

test("activity titles for refused actions are readable", () => {
  assert.equal(toolLabel("orca.swap", { sell: "sol", amount: 0.5 }), "Swap 0.5 SOL on Orca");
  assert.equal(toolLabel("solana.transfer", { asset: "USDC", amount: 2 }), "Send 2 USDC");
  assert.equal(toolLabel("polymarket.markets", {}), "Polymarket markets");
});

test("Polymarket: open markets only, a game shows who wins", () => {
  const game = toMarketItem({ title: "A vs. B", slug: "a-b", markets: [
    { outcomes: '["A","B"]', outcomePrices: '["0.6","0.4"]', sportsMarketType: "moneyline", active: true },
    { groupItemTitle: "O/U 6.5", outcomes: '["Over","Under"]', outcomePrices: '["0.5","0.5"]', sportsMarketType: "totals", active: true },
  ] });
  assert.deepEqual(game?.outcomes, [{ label: "A", pct: 60 }, { label: "B", pct: 40 }]);
  const finished = toMarketItem({ title: "C vs. D", slug: "c-d", markets: [{ outcomes: '["C","D"]', outcomePrices: '["0.9995","0.0005"]', sportsMarketType: "moneyline" }] });
  assert.equal(finished, null);
  const resolving = toMarketItem({ title: "E", slug: "e", markets: [{ outcomes: '["Yes","No"]', outcomePrices: '["0.5","0.5"]', umaResolutionStatus: "proposed" }] });
  assert.equal(resolving, null);
  const group = toMarketItem({ title: "Who wins?", slug: "w", markets: [
    { groupItemTitle: "X", outcomePrices: '["0.2","0.8"]' }, { groupItemTitle: "Y", outcomePrices: '["0.7","0.3"]' }, { groupItemTitle: "Z", outcomePrices: '["0.001","0.999"]' },
  ] });
  assert.deepEqual(group?.outcomes.map((o) => o.label), ["Y", "X", "Z"]);
});
