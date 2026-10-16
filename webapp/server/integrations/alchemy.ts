/**
 * Alchemy (https://www.alchemy.com): Lexari's Monad RPC and Token API.
 *   alchemy.tokens : every ERC-20 the agent holds on Monad testnet, with names and amounts (alchemy_getTokenBalances
 *                    plus alchemy_getTokenMetadata). Read only. Needs ALCHEMY_API_KEY.
 */
import { EVM_NETS, IS_MAINNET } from "@/lib/network";
import { z } from "zod";
import { evmAddress } from "./evm";
import { Reject } from "./reject";
import type { AgentRef, ReadResult, ToolDef } from "./registry";

export const alchemyReady = () => !!process.env.ALCHEMY_API_KEY;
const url = () => `https://${process.env.ALCHEMY_MONAD_NETWORK || (IS_MAINNET ? "monad-mainnet" : "monad-testnet")}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
async function call<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(url(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(10_000) });
  const j = (await r.json().catch(() => ({}))) as { result?: T; error?: { message: string } };
  if (!r.ok || j.error) throw new Reject(`Alchemy said: ${(j.error?.message || `HTTP ${r.status}`).slice(0, 120)}`);
  return j.result as T;
}

const tokensTool: ToolDef = {
  name: "alchemy.tokens", connector: "alchemy", risk: "read", input: z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional() }).passthrough(),
  hint: `alchemy.tokens {} : every token you (or {"address":"0x…"}) hold on ${EVM_NETS.monad.network}, from the Alchemy Token API. Read only.`,
  run: async (i: never, agent: AgentRef): Promise<ReadResult> => {
    if (!alchemyReady()) throw new Reject("Alchemy isn't set up on this server yet (no API key).");
    const address = (i as { address?: string }).address || evmAddress(agent.userId, agent.slug);
    const b = await call<{ tokenBalances: { contractAddress: string; tokenBalance: string }[] }>("alchemy_getTokenBalances", [address, "erc20"]);
    const held = b.tokenBalances.filter((t) => BigInt(t.tokenBalance || "0x0") > BigInt(0)).slice(0, 25);
    const rows = await Promise.all(held.map(async (t) => {
      const m = await call<{ symbol?: string; decimals?: number }>("alchemy_getTokenMetadata", [t.contractAddress]).catch(() => ({} as { symbol?: string; decimals?: number }));
      return `${Number(BigInt(t.tokenBalance)) / 10 ** (m.decimals ?? 18)} ${m.symbol || t.contractAddress.slice(0, 8)}`;
    }));
    return { summary: "Checked tokens with Alchemy", text: rows.length ? `${address} holds on ${EVM_NETS.monad.network}: ${rows.join(", ")}.` : `${address} holds no ERC-20 tokens on ${EVM_NETS.monad.network}.` };
  },
};
export const ALCHEMY_TOOLS: ToolDef[] = [tokensTool];
