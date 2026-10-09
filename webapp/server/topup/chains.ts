/**
 * Reading deposits on each chain family in content/topup.ts: the CONFIRMED amount an address holds (what we credit
 * from) and the latest amount including unconfirmed (shown as "on its way"). Amounts are base units as bigint.
 * Endpoints are public testnet RPCs / indexers, overridable by env (TOPUP_RPC_<CHAIN>, e.g. TOPUP_RPC_ETHEREUM).
 */
import type { ChainId, Rail } from "@/content/topup";
import { CHAINS } from "@/content/topup";
import { tronHex } from "./derive";

const RPC: Partial<Record<ChainId, string>> = {
  ethereum: "https://ethereum-sepolia-rpc.publicnode.com",
  base: "https://sepolia.base.org",
  arbitrum: "https://sepolia-rollup.arbitrum.io/rpc",
  bnb: "https://bsc-testnet-rpc.publicnode.com",
  tempo: "https://rpc.moderato.tempo.xyz",
  bitcoin: "https://mempool.space/testnet4/api",
  litecoin: "https://litecoinspace.org/testnet/api",
  tron: "https://nile.trongrid.io",
  xrpl: "https://testnet.xrpl-labs.com/",
};
export const rpcFor = (c: ChainId) => process.env[`TOPUP_RPC_${c.toUpperCase()}`] || RPC[c] || "";

async function fetchJson<T>(url: string, init?: RequestInit, tries = 3): Promise<T> {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(9000), headers: { "content-type": "application/json", accept: "application/json", ...(init?.headers || {}) } });
      if (r.status === 429 || r.status >= 500) { last = `HTTP ${r.status}`; await new Promise((s) => setTimeout(s, 500 * 2 ** i)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (e) { last = (e as Error).message; if (/HTTP 4/.test(last)) break; await new Promise((s) => setTimeout(s, 500 * 2 ** i)); }
  }
  throw new Error(`${url.split("/")[2]} didn't answer (${last})`);
}

export async function evmRpc<T>(chain: ChainId, method: string, params: unknown[]): Promise<T> {
  const j = await fetchJson<{ result?: T; error?: { message: string } }>(rpcFor(chain), { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}
const pad = (addr: string) => addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const big = (h?: string) => BigInt(!h || h === "0x" ? "0x0" : h);

export type Held = { confirmed: bigint; latest: bigint };

async function evmHeld(r: Rail, address: string): Promise<Held> {
  const tip = Number(big(await evmRpc<string>(r.chain, "eth_blockNumber", [])));
  const at = `0x${Math.max(0, tip - (CHAINS[r.chain].confirmations - 1)).toString(16)}`;
  const read = async (tag: string) => r.token
    ? big(await evmRpc<string>(r.chain, "eth_call", [{ to: r.token, data: `0x70a08231${pad(address)}` }, tag]))
    : big(await evmRpc<string>(r.chain, "eth_getBalance", [address, tag]));
  const [confirmed, latest] = await Promise.all([read(at), read("latest")]);
  return { confirmed, latest };
}

/** Esplora (mempool.space / litecoinspace): confirmed = funded - spent in blocks; latest adds the mempool. */
async function utxoHeld(r: Rail, address: string): Promise<Held> {
  const base = rpcFor(r.chain);
  const need = CHAINS[r.chain].confirmations;
  if (need <= 1) {
    const a = await fetchJson<{ chain_stats: { funded_txo_sum: number; spent_txo_sum: number }; mempool_stats: { funded_txo_sum: number; spent_txo_sum: number } }>(`${base}/address/${address}`);
    const c = BigInt(a.chain_stats.funded_txo_sum - a.chain_stats.spent_txo_sum);
    return { confirmed: c, latest: c + BigInt(a.mempool_stats.funded_txo_sum - a.mempool_stats.spent_txo_sum) };
  }
  const [tip, utxos] = await Promise.all([
    fetchJson<number>(`${base}/blocks/tip/height`),
    fetchJson<{ value: number; status: { confirmed: boolean; block_height?: number } }[]>(`${base}/address/${address}/utxo`),
  ]);
  let confirmed = BigInt(0), latest = BigInt(0);
  for (const u of utxos) {
    latest += BigInt(u.value);
    if (u.status.confirmed && u.status.block_height && tip - u.status.block_height + 1 >= need) confirmed += BigInt(u.value);
  }
  return { confirmed, latest };
}

/** Tron: confirmed from the solidified (irreversible) node, latest from the full node. */
async function tronHeld(r: Rail, address: string): Promise<Held> {
  const base = rpcFor("tron");
  const read = async (node: "wallet" | "walletsolidity") => {
    if (!r.token) {
      const a = await fetchJson<{ balance?: number }>(`${base}/${node}/getaccount`, { method: "POST", body: JSON.stringify({ address, visible: true }) });
      return BigInt(a.balance || 0);
    }
    const a = await fetchJson<{ constant_result?: string[] }>(`${base}/${node}/triggerconstantcontract`, {
      method: "POST", body: JSON.stringify({ owner_address: tronHex(address), contract_address: tronHex(r.token), function_selector: "balanceOf(address)", parameter: tronHex(address).slice(2).padStart(64, "0") }),
    });
    return big(`0x${a.constant_result?.[0] || "0"}`);
  };
  const [confirmed, latest] = await Promise.all([read("walletsolidity"), read("wallet")]);
  return { confirmed, latest };
}

export async function held(r: Rail, address: string): Promise<Held> {
  const fam = CHAINS[r.chain].family;
  if (fam === "evm") return evmHeld(r, address);
  if (fam === "btc") return utxoHeld(r, address);
  if (fam === "tron") return tronHeld(r, address);
  throw new Error(`no balance reader for ${r.chain}`);
}

/* ---------- XRP Ledger: payments to the Lexari account, by destination tag ---------- */
type XrplTx = { hash: string; validated?: boolean; tx?: { TransactionType?: string; Destination?: string; DestinationTag?: number; Amount?: unknown; hash?: string }; tx_json?: { TransactionType?: string; Destination?: string; DestinationTag?: number; hash?: string }; meta?: { TransactionResult?: string; delivered_amount?: unknown } };
export async function xrplCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const j = await fetchJson<{ result: T & { status?: string; error?: string; error_message?: string } }>(rpcFor("xrpl"), { method: "POST", body: JSON.stringify({ method, params: [params] }) });
  return j.result;
}
/** Validated XRP payments (drops) into `account` with this tag, newest first. Issued-currency payments are ignored. */
export async function xrplPayments(account: string, tag: number) {
  const r = await xrplCall<{ transactions?: XrplTx[]; error?: string }>("account_tx", { account, ledger_index_min: -1, ledger_index_max: -1, limit: 200, forward: false });
  if (r.error === "actNotFound") return [];
  if (r.error) throw new Error(r.error);
  const out: { hash: string; drops: bigint }[] = [];
  for (const t of r.transactions || []) {
    const tx = t.tx_json || t.tx;
    if (!t.validated || !tx || tx.TransactionType !== "Payment" || tx.Destination !== account || tx.DestinationTag !== tag) continue;
    if (t.meta?.TransactionResult !== "tesSUCCESS" || typeof t.meta.delivered_amount !== "string") continue;
    out.push({ hash: t.hash || tx.hash || "", drops: BigInt(t.meta.delivered_amount) });
  }
  return out.filter((p) => p.hash);
}
/** The testnet faucet opens (funds) the Lexari account the first time. MAINNET: fund it once by hand. */
export async function xrplEnsureAccount(account: string) {
  const info = await xrplCall<{ error?: string }>("account_info", { account, ledger_index: "validated" });
  if (info.error !== "actNotFound") return;
  await fetch("https://faucet.altnet.rippletest.net/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ destination: account }), signal: AbortSignal.timeout(15000) }).catch(() => null);
}
