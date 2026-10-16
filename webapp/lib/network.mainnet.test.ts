/** Mainnet build tables (lib/network.ts and everything that reads it). Runs in its own process. */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LEXARI_NETWORK = "mainnet";
delete process.env.NEXT_PUBLIC_LEXARI_NETWORK;

test("mainnet: chain ids, tokens, limits and faucets", async () => {
  const n = await import("./network");
  assert.equal(n.NETWORK, "mainnet");
  assert.equal(n.SOLANA_CLUSTER_FOR_MODE, "mainnet-beta");
  assert.deepEqual([n.EVM_NETS.base.chainId, n.EVM_NETS.ethereum.chainId, n.EVM_NETS.arbitrum.chainId, n.EVM_NETS.monad.chainId], [8453, 1, 42161, 143]);
  assert.equal(n.EVM_NETS.monad.usdc, "0x754704Bc059F8C67012fEd69BC8A327a5aafb603");
  assert.equal(n.EVM_NETS.robinhood.available, false);
  assert.equal(n.evmRpcFor("robinhood"), "");
  assert.equal(n.SOLANA_TOKENS.USDC, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  assert.equal(n.FAUCETS_ENABLED, false);
  assert.equal(n.ORE_PRACTICE_ENABLED, false);
  assert.ok(n.SPEND_LIMITS.perTx.def < 5 && n.SPEND_LIMITS.daily.def < 20);
});

test("mainnet: no testnet chain, test token or hidden integration leaks through", async () => {
  const { RAILS, CHAINS } = await import("@/content/topup");
  const { INTEGRATIONS } = await import("@/content/integrations");
  const { TOOLS } = await import("@/server/integrations/registry");
  const { EVM, isEvmChain } = await import("@/server/integrations/evm");
  const testnetIds = new Set([10143, 84532, 11155111, 421614, 46630, 97, 42431, 998]);
  for (const r of RAILS) {
    assert.equal(r.test, false, `${r.coin}:${r.chain} is not a test token`);
    if (r.live) assert.ok(CHAINS[r.chain].live, `${r.coin}:${r.chain} rides a live chain`);
    if (r.live && CHAINS[r.chain].chainId) assert.ok(!testnetIds.has(CHAINS[r.chain].chainId!), `${r.chain} is a mainnet chain`);
  }
  for (const c of Object.values(CHAINS)) if (c.live) assert.doesNotMatch(c.network, /testnet|sepolia|devnet|nile|moderato/i);
  for (const e of Object.values(EVM)) if (e.available) assert.ok(!testnetIds.has(e.chainId) && !e.testnet);
  assert.equal(isEvmChain("robinhood"), false);
  const hidden = ["orca", "uniswap", "robinhood", "tempo", "hyperliquid", "agora", "kuru", "panta", "ore"];
  for (const id of hidden) {
    assert.ok(!INTEGRATIONS.some((i) => i.id === id), `${id} is hidden`);
    assert.ok(!TOOLS.some((t) => t.connector === id), `${id} has no tools`);
  }
  assert.doesNotMatch(JSON.stringify(INTEGRATIONS.filter((i) => ["solana", "base", "ethereum", "arbitrum", "monad", "payments"].includes(i.id))), /test (USDC|ETH|MON)|Sepolia|devnet|Test funds/i);
});

test("mainnet: env that would cross networks is refused", async () => {
  const { networkConfigProblems } = await import("@/server/network");
  const { createHash } = await import("node:crypto");
  const ok: Record<string, string> = { LEXARI_NETWORK: "mainnet", SESSION_SECRET: "m".repeat(40), DATABASE_URL: "postgres://main" };
  const check = (e: Record<string, string>) => networkConfigProblems(e as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(check(ok), []);
  assert.equal(check({ ...ok, LEXARI_NETWORK: "testnet" }).length, 1);
  assert.equal(check({ ...ok, LEXARI_NETWORK: "" }).length, 1);
  assert.equal(check({ ...ok, LEXARI_TESTNET_DATABASE_URL: "postgres://main" }).length, 1);
  assert.equal(check({ ...ok, LEXARI_TESTNET_SESSION_SECRET_SHA256: createHash("sha256").update("m".repeat(40)).digest("hex") }).length, 1);
  assert.equal(check({ ...ok, LEXARI_FAUCET_KEY: "x" }).length, 1);
  assert.equal(check({ ...ok, NEXT_PUBLIC_SOLANA_CLUSTER: "devnet" }).length, 1);
  assert.equal(check({ ...ok, NEXT_PUBLIC_USDC_MINT: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" }).length, 1);
});
