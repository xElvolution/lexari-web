/**
 * EVM side of an agent: one address per agent (the same on every EVM chain), derived from SESSION_SECRET per
 * (person, agent) like its Solana wallet, so no key is stored. Agents read and send on Base Sepolia, Ethereum
 * Sepolia, Arbitrum Sepolia, Robinhood Chain testnet and Monad testnet; see evmchains.ts for sends and uniswap.ts for swaps.
 */
import { createHmac } from "node:crypto";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { HttpError } from "../http";
import { EVM_NETS, IS_TESTNET, evmRpcFor } from "@/lib/network";

export type EvmChain = "base" | "ethereum" | "arbitrum" | "robinhood" | "monad";
export type EvmInfo = { name: string; network: string; chainId: number; rpc: () => string; usdc: string; native: string; explorer: string; txExplorer: string; testnet: boolean; available: boolean };
const info = (k: EvmChain, name: string, native: string): EvmInfo => {
  const n = EVM_NETS[k];
  return { name, network: n.network, chainId: n.chainId, rpc: () => evmRpcFor(k), usdc: n.usdc, native, explorer: n.explorer ? `${n.explorer}/address/` : "", txExplorer: n.explorer ? `${n.explorer}/tx/` : "", testnet: IS_TESTNET, available: n.available };
};
/**
 * Every EVM chain an agent can use, for this build's network mode (lib/network.ts). Testnet: Sepolia chains, Robinhood
 * Chain testnet and Monad testnet. Mainnet: Base, Ethereum, Arbitrum One and Monad; Robinhood Chain is unavailable.
 */
export const EVM: Record<EvmChain, EvmInfo> = {
  base: info("base", "Base", "ETH"),
  ethereum: info("ethereum", "Ethereum", "ETH"),
  arbitrum: info("arbitrum", "Arbitrum", "ETH"),
  robinhood: info("robinhood", "Robinhood Chain", "ETH"),
  monad: info("monad", "Monad", "MON"),
};
export const isEvmChain = (s: string): s is EvmChain => Object.prototype.hasOwnProperty.call(EVM, s) && EVM[s as EvmChain].available;
/** "base", "Base Sepolia", "arb", "robinhood chain" ... to a chain id, or null. */
export function evmChainOf(s: string): EvmChain | null {
  const k = s.trim().toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, EvmChain> = { base: "base", basesepolia: "base", ethereum: "ethereum", eth: "ethereum", sepolia: "ethereum", ethereumsepolia: "ethereum", arbitrum: "arbitrum", arb: "arbitrum", arbitrumsepolia: "arbitrum", robinhood: "robinhood", robinhoodchain: "robinhood", robinhoodchaintestnet: "robinhood", monad: "monad", monadtestnet: "monad" };
  const c = map[k];
  return c && EVM[c].available ? c : null;
}

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

/** EIP-55 checksummed address for a 20-byte hex address. */
export function checksum(addr: string) {
  const a = addr.toLowerCase().replace(/^0x/, "");
  const h = hex(keccak_256(new TextEncoder().encode(a)));
  return `0x${[...a].map((ch, i) => (parseInt(h[i], 16) >= 8 ? ch.toUpperCase() : ch)).join("")}`;
}

/** The agent's EVM address. The key is derived on demand and never leaves the server. */
export function evmAddress(userId: string, slug: string) {
  return addressOfKey(evmKey(userId, slug));
}
/** The agent's EVM private key (server only; used to sign testnet transactions the person confirmed). */
export function evmKey(userId: string, slug: string): Uint8Array {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 16) throw new HttpError(503, "Agent wallets are not set up on this server.");
  return new Uint8Array(createHmac("sha256", s).update(`lexari-agent-wallet:v1:evm:${userId}:${slug}`).digest());
}
/** The Ethereum address of a 32-byte secp256k1 private key. */
export function addressOfKey(priv: Uint8Array) {
  const pub = secp256k1.getPublicKey(priv, false).subarray(1);
  return checksum(hex(keccak_256(pub).subarray(12)));
}

export async function rpc<T>(chain: EvmChain, method: string, params: unknown[]): Promise<T> {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(EVM[chain].rpc(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(8000) });
      if (r.status === 429 || r.status >= 500) { last = `HTTP ${r.status}`; await new Promise((res) => setTimeout(res, 400 * 2 ** attempt)); continue; }
      const j = (await r.json()) as { result?: T; error?: { message: string } };
      if (j.error) throw new Error(j.error.message);
      return j.result as T;
    } catch (e) { last = (e as Error).message; await new Promise((res) => setTimeout(res, 400 * 2 ** attempt)); }
  }
  throw new Error(`${EVM[chain].network} didn't answer (${last})`);
}

/** Native ETH and test USDC held by an address on the chain's testnet. */
export async function evmBalances(chain: EvmChain, address: string) {
  const data = `0x70a08231${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
  const [wei, usdc] = await Promise.all([
    rpc<string>(chain, "eth_getBalance", [address, "latest"]),
    EVM[chain].usdc ? rpc<string>(chain, "eth_call", [{ to: EVM[chain].usdc, data }, "latest"]).catch(() => "0x0") : Promise.resolve("0x0"),
  ]);
  return { eth: Number(BigInt(wei)) / 1e18, usdc: Number(BigInt(usdc === "0x" ? "0x0" : usdc)) / 1e6 };
}
