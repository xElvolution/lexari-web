/** Testnet build tables (lib/network.ts). Runs in its own process. */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LEXARI_NETWORK = "testnet";
delete process.env.NEXT_PUBLIC_LEXARI_NETWORK;

test("testnet: testnet chain ids, faucets on, every integration listed", async () => {
  const n = await import("./network");
  assert.equal(n.NETWORK, "testnet");
  assert.equal(n.SOLANA_CLUSTER_FOR_MODE, "devnet");
  assert.deepEqual([n.EVM_NETS.base.chainId, n.EVM_NETS.ethereum.chainId, n.EVM_NETS.arbitrum.chainId, n.EVM_NETS.monad.chainId], [84532, 11155111, 421614, 10143]);
  assert.equal(n.FAUCETS_ENABLED, true);
  assert.equal(n.ORE_PRACTICE_ENABLED, true);
  const { INTEGRATIONS } = await import("@/content/integrations");
  for (const id of ["orca", "uniswap", "robinhood", "tempo", "ore"]) assert.ok(INTEGRATIONS.some((i) => i.id === id), `${id} listed on testnet`);
  const { CHAINS } = await import("@/content/topup");
  assert.equal(CHAINS.monad.chainId, 10143);
});

test("testnet: a mainnet-only env check never fires", async () => {
  const { networkConfigProblems } = await import("@/server/network");
  assert.deepEqual(networkConfigProblems({ LEXARI_NETWORK: "testnet", LEXARI_FAUCET_KEY: "x" } as unknown as NodeJS.ProcessEnv), []);
  assert.equal(networkConfigProblems({ LEXARI_NETWORK: "mainnet" } as unknown as NodeJS.ProcessEnv).length, 1);
});
