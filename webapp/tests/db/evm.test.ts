/**
 * EVM testnet sends and Uniswap swaps, end to end on an anvil fork of Base Sepolia (and Ethereum Sepolia): the agent
 * proposes, a Confirm card is prepared, and only Confirm signs from the agent's own key. Balances are read back from
 * the fork. Skips the chain part when Foundry isn't installed.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { agent, fork, grant, person, say } from "./helpers";
import { confirmAction } from "../../server/integrations/actions";
import { EVM, evmAddress, evmBalances } from "../../server/integrations/evm";

const forks: NonNullable<Awaited<ReturnType<typeof fork>>>[] = [];
let base: (typeof forks)[number] | null = null, eth: (typeof forks)[number] | null = null;
before(async () => {
  base = await fork(process.env.BASE_SEPOLIA_UPSTREAM || "https://sepolia.base.org");
  eth = await fork(process.env.SEPOLIA_UPSTREAM || "https://ethereum-sepolia-rpc.publicnode.com");
  for (const f of [base, eth]) if (f) forks.push(f);
  if (base) process.env.BASE_SEPOLIA_RPC = base.url;
  if (eth) process.env.SEPOLIA_RPC = eth.url;
});
after(() => { for (const f of forks) f.stop(); setTimeout(() => process.exit(0), 50); });

const TO = "0x000000000000000000000000000000000000bEEF";

test("Base Sepolia: send ETH after Confirm; the recipient gets exactly that much", async (t) => {
  if (!base) return t.skip("anvil not installed");
  const u = await person(); const a = await agent(u.id);
  await grant(u.id, "base", a.slug);
  const me = evmAddress(u.id, a.slug);
  await base.rpc("anvil_setBalance", [me, "0xDE0B6B3A7640000"]); // 1 ETH
  const before = await evmBalances("base", TO);
  const card = (await say(u.id, a, `<tool name="base.transfer">{"to":"${TO}","asset":"ETH","amount":0.001}</tool>`)).actions[0];
  assert.ok(card, "a Confirm card");
  assert.equal(card.status, "prepared");
  assert.equal((await evmBalances("base", TO)).eth, before.eth, "nothing moves before Confirm");
  const row = (k: string) => card.rows.find(([x]) => x === k)?.[1];
  assert.match(row("Simulated") || "", /^Passed on Base Sepolia \(block \d+\)$/);
  assert.equal(row("Your ETH"), "−0.001 ETH");
  assert.match(row("Network fee") || "", /^About [\d.]+ ETH$/);
  const done = await confirmAction(u.id, card.id);
  assert.equal(done.status, "confirmed", done.error);
  assert.ok(done.explorer?.startsWith(EVM.base.txExplorer));
  const after2 = await evmBalances("base", TO);
  assert.ok(Math.abs(after2.eth - before.eth - 0.001) < 1e-9);
});

test("Base Sepolia: over the per-trade limit, to an invalid address, or to itself: no card", async (t) => {
  if (!base) return t.skip("anvil not installed");
  const u = await person(); const a = await agent(u.id);
  await grant(u.id, "base", a.slug, { perTxUsd: 1, dailyUsd: 5 });
  const me = evmAddress(u.id, a.slug);
  await base.rpc("anvil_setBalance", [me, "0xDE0B6B3A7640000"]);
  for (const body of [`{"to":"${TO}","asset":"ETH","amount":0.5}`, `{"to":"0x123","asset":"ETH","amount":0.0001}`, `{"to":"${me}","asset":"ETH","amount":0.0001}`]) {
    const r = await say(u.id, a, `<tool name="base.transfer">${body}</tool>`);
    assert.equal(r.actions.length, 0, body);
  }
});

test("Uniswap on Base Sepolia: swap ETH for USDC, send USDC, swap USDC back, each after Confirm", async (t) => {
  if (!base) return t.skip("anvil not installed");
  const u = await person(); const a = await agent(u.id);
  await grant(u.id, "uniswap", a.slug, { maxSlippageBps: 500 });
  await grant(u.id, "base", a.slug);
  const me = evmAddress(u.id, a.slug);
  await base.rpc("anvil_setBalance", [me, "0xDE0B6B3A7640000"]);
  const q = await say(u.id, a, `<tool name="uniswap.quote">{"chain":"base","sell":"ETH","buy":"USDC","amount":0.001}</tool>`);
  assert.equal(q.reads, 1);
  if (/no ETH \/ USDC liquidity/.test(q.facts.join(" "))) return t.skip("no Uniswap liquidity on Base Sepolia right now");
  const s1 = (await say(u.id, a, `<tool name="uniswap.swap">{"chain":"base","sell":"ETH","buy":"USDC","amount":0.001,"slippage":5}</tool>`)).actions[0];
  assert.ok(s1, "swap card");
  assert.ok(s1.rows.some(([k]) => k === "Minimum"));
  assert.equal(s1.rows.find(([k]) => k === "Your ETH")?.[1], "−0.001 ETH");
  assert.match(s1.rows.find(([k]) => k === "Your USDC")?.[1] || "", /^\+[\d.]+ USDC$/, "the simulated USDC gain is on the card");
  const d1 = await confirmAction(u.id, s1.id);
  assert.equal(d1.status, "confirmed", d1.error);
  const b1 = await evmBalances("base", me);
  assert.ok(b1.usdc > 0, `got USDC (${b1.usdc})`);

  const amt = Math.floor(b1.usdc * 1e6 / 2) / 1e6;
  const send = (await say(u.id, a, `<tool name="base.transfer">{"to":"${TO}","asset":"USDC","amount":${amt}}</tool>`)).actions[0];
  assert.equal((await confirmAction(u.id, send.id)).status, "confirmed");
  const b2 = await evmBalances("base", me);
  assert.ok(Math.abs(b1.usdc - amt - b2.usdc) < 1e-6);

  const s2 = (await say(u.id, a, `<tool name="uniswap.swap">{"chain":"base","sell":"USDC","buy":"ETH","amount":${b2.usdc},"slippage":5}</tool>`)).actions[0];
  assert.ok(s2, "swap back card");
  assert.equal(s2.rows.find(([k]) => k === "Your USDC")?.[1], `−${b2.usdc} USDC`, "approve and swap simulated together");
  assert.match(s2.rows.find(([k]) => k === "Your ETH")?.[1] || "", /^\+[\d.]+ ETH$/, "ETH back from unwrapWETH9, traced");
  const d2 = await confirmAction(u.id, s2.id);
  assert.equal(d2.status, "confirmed", d2.error);
  assert.ok((await evmBalances("base", me)).usdc < 1e-6);
});

test("simulation: a send that would revert never becomes a card", async (t) => {
  if (!base) return t.skip("anvil not installed");
  const u = await person(); const a = await agent(u.id);
  await grant(u.id, "base", a.slug);
  const me = evmAddress(u.id, a.slug);
  await base.rpc("anvil_setBalance", [me, "0xDE0B6B3A7640000"]);
  // The USDC contract has no payable fallback, so sending it ETH reverts.
  const r = await say(u.id, a, `<tool name="base.transfer">{"to":"${EVM.base.usdc}","asset":"ETH","amount":0.0001}</tool>`);
  assert.equal(r.actions.length, 0);
  assert.match(r.notes.join(" "), /simulation says this would fail/);
});

test("Ethereum Sepolia: send ETH after Confirm", async (t) => {
  if (!eth) return t.skip("anvil not installed");
  const u = await person(); const a = await agent(u.id);
  await grant(u.id, "ethereum", a.slug);
  const me = evmAddress(u.id, a.slug);
  await eth.rpc("anvil_setBalance", [me, "0xDE0B6B3A7640000"]);
  const before = await evmBalances("ethereum", TO);
  const card = (await say(u.id, a, `<tool name="ethereum.transfer">{"to":"${TO}","asset":"ETH","amount":0.002}</tool>`)).actions[0];
  const done = await confirmAction(u.id, card.id);
  assert.equal(done.status, "confirmed", done.error);
  assert.ok(Math.abs((await evmBalances("ethereum", TO)).eth - before.eth - 0.002) < 1e-9);
});
