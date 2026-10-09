/**
 * Tempo (Moderato testnet, chain 42431): agents' Tempo wallets (the agent's EVM address), TIP-20 stablecoin
 * balances, faucet funding and transfers. Tempo has no native gas token: a TIP-20 `transfer` pays its fee in the
 * token being sent, so a plain EIP-1559 transaction works with no gas coin. MAINNET: chain 4217, rpc.tempo.xyz.
 */
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { RAILS } from "@/content/topup";

export const TEMPO = {
  name: "Tempo", network: "Tempo Moderato testnet", chainId: 42431,
  rpc: () => process.env.TEMPO_RPC || "https://rpc.moderato.tempo.xyz",
  explorerTx: (h: string) => `https://explore.testnet.tempo.xyz/tx/${h}`,
  explorerAddr: (a: string) => `https://explore.testnet.tempo.xyz/address/${a}`,
};
/** Tempo stablecoins agents use (from content/topup.ts, so one table lists them). */
export const TEMPO_TOKENS = RAILS.filter((r) => r.chain === "tempo" && r.token).map((r) => ({ symbol: r.coin === "PATHUSD" ? "pathUSD" : r.coin === "ALPHAUSD" ? "AlphaUSD" : r.coin, address: r.token!, decimals: r.decimals }));
export const tempoToken = (s: string) => TEMPO_TOKENS.find((t) => t.symbol.toLowerCase() === s.toLowerCase().replace(/[^a-z]/g, "")) || null;

export class TempoError extends Error { constructor(msg: string, public hash?: string) { super(msg); } }

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let last = "";
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(TEMPO.rpc(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(10000) });
      if (r.status === 429 || r.status >= 500) { last = `HTTP ${r.status}`; await new Promise((s) => setTimeout(s, 400 * 2 ** i)); continue; }
      const j = (await r.json()) as { result?: T; error?: { message: string } };
      if (j.error) throw new TempoError(j.error.message);
      return j.result as T;
    } catch (e) { if (e instanceof TempoError) throw e; last = (e as Error).message; await new Promise((s) => setTimeout(s, 400 * 2 ** i)); }
  }
  throw new Error(`Tempo didn't answer (${last})`);
}
const hexToBig = (h: string) => BigInt(!h || h === "0x" ? "0x0" : h);
const strip = (a: string) => a.toLowerCase().replace(/^0x/, "");

export async function tempoBalances(address: string) {
  const out = await Promise.all(TEMPO_TOKENS.map(async (t) => {
    const raw = await rpc<string>("eth_call", [{ to: t.address, data: `0x70a08231${strip(address).padStart(64, "0")}` }, "latest"]);
    return { ...t, atoms: hexToBig(raw), amount: Number(hexToBig(raw)) / 10 ** t.decimals };
  }));
  return out;
}

/** Testnet faucet: test stablecoins (pathUSD, AlphaUSD, ...) to an address. */
export async function tempoFund(address: string) {
  return rpc<unknown>("tempo_fundAddress", [address]);
}

/* ---------- RLP + EIP-1559 signing ---------- */
type RlpItem = Uint8Array | RlpItem[];
const bytes = (h: string) => Uint8Array.from(Buffer.from(strip(h).length % 2 ? `0${strip(h)}` : strip(h), "hex"));
const int = (n: bigint) => (n === BigInt(0) ? new Uint8Array() : bytes(n.toString(16)));
function lenPrefix(len: number, short: number) {
  if (len < 56) return Uint8Array.of(short + len);
  const l = bytes(len.toString(16));
  return Uint8Array.of(short + 55 + l.length, ...l);
}
export function rlp(item: RlpItem): Uint8Array {
  if (item instanceof Uint8Array) {
    if (item.length === 1 && item[0] < 0x80) return item;
    return Uint8Array.from([...lenPrefix(item.length, 0x80), ...item]);
  }
  const body = item.map(rlp);
  const flat = Uint8Array.from(body.flatMap((b) => [...b]));
  return Uint8Array.from([...lenPrefix(flat.length, 0xc0), ...flat]);
}

/** Signs and sends a TIP-20 transfer from `priv`; waits for the receipt (Tempo blocks are ~0.5 s and final). */
export async function tempoTransfer(priv: Uint8Array, from: string, token: string, to: string, atoms: bigint) {
  const data = `0xa9059cbb${strip(to).padStart(64, "0")}${atoms.toString(16).padStart(64, "0")}`;
  const [nonceH, gasPriceH] = await Promise.all([rpc<string>("eth_getTransactionCount", [from, "pending"]), rpc<string>("eth_gasPrice", [])]);
  let gas: bigint;
  try { gas = (hexToBig(await rpc<string>("eth_estimateGas", [{ from, to: token, data }])) * BigInt(13)) / BigInt(10); }
  catch (e) { throw new TempoError(`Tempo would reject this transfer (${(e as Error).message.slice(0, 120)}).`); }
  const maxFee = hexToBig(gasPriceH) * BigInt(2);
  const prio = hexToBig(gasPriceH) / BigInt(10) || BigInt(1);
  const fields: RlpItem[] = [int(BigInt(TEMPO.chainId)), int(hexToBig(nonceH)), int(prio), int(maxFee), int(gas), bytes(token), new Uint8Array(), bytes(data), []];
  const unsigned = Uint8Array.from([0x02, ...rlp(fields)]);
  const sig = secp256k1.sign(keccak_256(unsigned), priv);
  const raw = Uint8Array.from([0x02, ...rlp([...fields, int(BigInt(sig.recovery)), int(sig.r), int(sig.s)])]);
  const hash = await rpc<string>("eth_sendRawTransaction", [`0x${Buffer.from(raw).toString("hex")}`]);
  for (let i = 0; i < 20; i++) {
    const rc = await rpc<{ status?: string } | null>("eth_getTransactionReceipt", [hash]).catch(() => null);
    if (rc?.status) {
      if (rc.status !== "0x1") throw new TempoError("The transfer failed on Tempo.", hash);
      return { hash, confirmed: true };
    }
    await new Promise((s) => setTimeout(s, 700));
  }
  return { hash, confirmed: false };
}
export async function tempoReceipt(hash: string) {
  return rpc<{ status?: string } | null>("eth_getTransactionReceipt", [hash]);
}
