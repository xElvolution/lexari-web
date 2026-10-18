/**
 * Agora AUSD end to end on a fork of Monad testnet: balance read, faucet and pay through the real turn, Confirm
 * cards and limits, with the agent's own key signing on the fork. Skips the chain part when Foundry isn't installed.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { agent, fork, grant, person, say } from "./helpers";
import { confirmAction } from "../../server/integrations/actions";
import { evmAddress } from "../../server/integrations/evm";
import { TOOLS } from "../../server/integrations/registry";

const MONAD_TESTNET = process.env.MONAD_TESTNET_RPC || "https://testnet-rpc.monad.xyz";
let f: Awaited<ReturnType<typeof fork>> = null;
before(async () => { f = await fork(MONAD_TESTNET); if (f) process.env.MONAD_RPC = f.url; });
after(() => { f?.stop(); setTimeout(() => process.exit(0), 50); });

test("AUSD tools: balance is a read, faucet, pay and send are Confirm-card sign tools", () => {
  const t = TOOLS.filter((x) => x.connector === "agora");
  assert.deepEqual(t.map((x) => x.name).sort(), ["ausd.balance", "ausd.faucet", "ausd.pay", "ausd.send"]);
  for (const x of t) if (x.name !== "ausd.balance") { assert.equal(x.risk, "sign"); assert.ok(!x.auto); }
});

test("without the integration the agent is refused", async () => {
  const u = await person(); const a = await agent(u.id);
  const r = await say(u.id, a, `<tool name="ausd.balance">{}</tool>`);
  assert.equal(r.reads, 0);
  assert.ok(r.notes.join(" ").match(/access|Integrations/i));
});

test("faucet, then pay: Confirm cards, real balances on a Monad testnet fork, limits enforced", async (t) => {
  if (!f) return t.skip("anvil not installed");
  const u = await person(); const a = await agent(u.id);
  await grant(u.id, "agora", a.slug, { perTxUsd: 25, dailyUsd: 100 });
  const me = evmAddress(u.id, a.slug);
  await f.rpc("anvil_setBalance", [me, "0x8AC7230489E80000"]); // 10 MON for gas

  const bal0 = await say(u.id, a, `<tool name="ausd.balance">{}</tool>`);
  assert.equal(bal0.reads, 1);
  assert.match(bal0.facts.join(" "), /0 AUSD/);

  const fc = (await say(u.id, a, `<tool name="ausd.faucet">{}</tool>`)).actions[0];
  assert.equal(fc.status, "prepared");
  const fd = await confirmAction(u.id, fc.id);
  assert.equal(fd.status, "confirmed", fd.error);
  const bal1 = await say(u.id, a, `<tool name="ausd.balance">{}</tool>`);
  const held = Number(/You hold ([\d.]+) AUSD/.exec(bal1.facts.join(" "))?.[1]);
  assert.ok(held > 0, `faucet paid out (${held})`);

  const to = "0x000000000000000000000000000000000000bEEF";
  const over = await say(u.id, a, `<tool name="ausd.pay">{"to":"${to}","amount":30}</tool>`);
  assert.equal(over.actions.length, 0, "over the $25 per-payment limit");
  const amt = Math.min(1, held);
  const pay = (await say(u.id, a, `<tool name="ausd.pay">{"to":"${to}","amount":${amt},"note":"test"}</tool>`)).actions[0];
  assert.equal(pay.status, "prepared");
  assert.ok(pay.rows.some(([k, v]) => k === "Pay" && v === `${amt} AUSD`));
  assert.equal(pay.rows.find(([k]) => k === "Your AUSD")?.[1], `−${amt} AUSD`, "simulated balance change on the card");
  assert.match(fc.rows.find(([k]) => k === "Your AUSD")?.[1] || "", /^\+[\d.]+ AUSD$/, "faucet card shows the simulated AUSD in");
  const pd = await confirmAction(u.id, pay.id);
  assert.equal(pd.status, "confirmed", pd.error);
  assert.match(pd.explorer || "", /^https:\/\/testnet\.monadexplorer\.com\/tx\/0x/);
  const bal2 = await say(u.id, a, `<tool name="ausd.balance">{}</tool>`);
  const left = Number(/You hold ([\d.]+) AUSD/.exec(bal2.facts.join(" "))?.[1]);
  assert.ok(Math.abs(held - amt - left) < 1e-6, `${held} - ${amt} = ${left}`);
});

test("cross-border send refuses a non-EVM address before any card", async (t) => {
  if (!f) return t.skip("anvil not installed");
  const u = await person(); const a = await agent(u.id);
  await grant(u.id, "agora", a.slug);
  const bad = await say(u.id, a, `<tool name="ausd.send">{"to":"not-an-address","amount":1}</tool>`);
  assert.equal(bad.actions.length, 0);
});
