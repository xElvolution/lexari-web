/**
 * EVM side of an agent: one address per agent (the same on every EVM chain), derived from SESSION_SECRET per
 * (person, agent) like its Solana wallet, so no key is stored. For now agents only READ on Base Sepolia and Ethereum
 * Sepolia (native ETH and Circle's test USDC); swaps and transfers on EVM chains are listed as coming soon.
 */
import { createHmac } from "node:crypto";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { HttpError } from "../http";

export type EvmChain = "base" | "ethereum";
export const EVM: Record<EvmChain, { name: string; network: string; chainId: number; rpc: () => string; usdc: string; explorer: string }> = {
  base: { name: "Base", network: "Base Sepolia", chainId: 84532, rpc: () => process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org", usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", explorer: "https://sepolia.basescan.org/address/" },
  ethereum: { name: "Ethereum", network: "Sepolia", chainId: 11155111, rpc: () => process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com", usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", explorer: "https://sepolia.etherscan.io/address/" },
};

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

/** EIP-55 checksummed address for a 20-byte hex address. */
export function checksum(addr: string) {
  const a = addr.toLowerCase().replace(/^0x/, "");
  const h = hex(keccak_256(new TextEncoder().encode(a)));
  return `0x${[...a].map((ch, i) => (parseInt(h[i], 16) >= 8 ? ch.toUpperCase() : ch)).join("")}`;
}

/** The agent's EVM address. The key is derived on demand and never leaves the server. */
export function evmAddress(userId: string, slug: string) {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 16) throw new HttpError(503, "Agent wallets are not set up on this server.");
  return addressOfKey(createHmac("sha256", s).update(`lexari-agent-wallet:v1:evm:${userId}:${slug}`).digest());
}
/** The Ethereum address of a 32-byte secp256k1 private key. */
export function addressOfKey(priv: Uint8Array) {
  const pub = secp256k1.getPublicKey(priv, false).subarray(1);
  return checksum(hex(keccak_256(pub).subarray(12)));
}

async function rpc<T>(chain: EvmChain, method: string, params: unknown[]): Promise<T> {
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
    rpc<string>(chain, "eth_call", [{ to: EVM[chain].usdc, data }, "latest"]).catch(() => "0x0"),
  ]);
  return { eth: Number(BigInt(wei)) / 1e18, usdc: Number(BigInt(usdc === "0x" ? "0x0" : usdc)) / 1e6 };
}
