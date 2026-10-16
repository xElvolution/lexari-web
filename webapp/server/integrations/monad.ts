/**
 * Monad (testnet 10143 or mainnet 143, from lib/network.ts) plus the Monad sponsor data and trading venues:
 *  - monad.wallet: the agent's EVM address on Monad testnet and its MON balance (public RPC, no key).
 *  - nansen.wallet: Nansen wallet profile (balances and labels) for any address. Needs NANSEN_API_KEY.
 *  - kuru.quote / kuru.swap: Kuru routes and swaps on Monad testnet through @kuru-labs/kuru-sdk. The swap is a sign
 *    tool: it only prepares a Confirm card, and only your Confirm sends it. Needs KURU_API_URL and KURU_ROUTER_ADDRESS.
 *
 * Env: MONAD_RPC (default https://testnet-rpc.monad.xyz), NANSEN_API_KEY, NANSEN_API_URL (default
 * https://api.nansen.ai/api/v1), KURU_API_URL, KURU_ROUTER_ADDRESS, KURU_TOKENS (optional JSON list).
 */
import { z } from "zod";
import { evmAddress, evmKey } from "./evm";
import { Reject } from "./reject";
import { EVM_NETS, IS_TESTNET, evmRpcFor } from "@/lib/network";
import type { AgentRef, Executed, GrantLimits, Prepared, ToolDef } from "./registry";

/** Monad for this build's network mode (lib/network.ts): testnet 10143 or mainnet 143. */
export const MONAD = {
  name: "Monad", network: EVM_NETS.monad.network, chainId: EVM_NETS.monad.chainId,
  rpc: () => evmRpcFor("monad"),
  explorerAddr: (a: string) => `${EVM_NETS.monad.explorer}/address/${a}`,
};
const isAddr = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);

async function monadRpc<T>(method: string, params: unknown[]): Promise<T> {
  let last = "";
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(MONAD.rpc(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(8000) });
      if (r.status === 429 || r.status >= 500) { last = `HTTP ${r.status}`; await new Promise((s) => setTimeout(s, 400 * 2 ** i)); continue; }
      const j = (await r.json()) as { result?: T; error?: { message: string } };
      if (j.error) throw new Error(j.error.message);
      return j.result as T;
    } catch (e) { last = (e as Error).message; await new Promise((s) => setTimeout(s, 400 * 2 ** i)); }
  }
  throw new Reject(`${MONAD.network} didn't answer (${last}). Try again in a moment.`);
}
export async function monBalance(address: string) {
  const wei = await monadRpc<string>("eth_getBalance", [address, "latest"]);
  return Number(BigInt(wei || "0x0")) / 1e18;
}

const monadWallet: ToolDef = {
  name: "monad.wallet", connector: "monad", risk: "read", input: z.object({}).passthrough(),
  hint: `monad.wallet {} : your ${EVM_NETS.monad.network} address (your EVM address) and its MON balance.`,
  run: async (_i: never, agent: AgentRef) => {
    const a = evmAddress(agent.userId, agent.slug);
    const mon = await monBalance(a);
    return { summary: "Checked its Monad wallet", text: `Your ${MONAD.network} address: ${a}. It holds ${+mon.toFixed(6)} MON${IS_TESTNET ? " (test MON, no real value)" : ""}. Explorer: ${MONAD.explorerAddr(a)}` };
  },
};

/* ---------- Nansen ---------- */
export const nansenReady = () => !!process.env.NANSEN_API_KEY;
const nansenIn = z.object({ address: z.string().trim(), chain: z.string().trim().toLowerCase().default("ethereum") });
const nansenWallet: ToolDef = {
  name: "nansen.wallet", connector: "nansen", risk: "read", input: nansenIn,
  hint: 'nansen.wallet {"address":"0x...","chain":"ethereum"} : Nansen profile of a wallet: its current token balances in USD. Read only.',
  run: async (i: never) => {
    const { address, chain } = i as z.infer<typeof nansenIn>;
    if (!nansenReady()) throw new Reject("Nansen is not set up on this server yet (no API key), so I can't read wallet data from it.");
    if (!isAddr(address) && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) throw new Reject("That doesn't look like a wallet address.");
    const base = (process.env.NANSEN_API_URL || "https://api.nansen.ai/api/v1").replace(/\/+$/, "");
    const r = await fetch(`${base}/profiler/address/current-balance`, {
      method: "POST", headers: { "content-type": "application/json", apiKey: process.env.NANSEN_API_KEY! },
      body: JSON.stringify({ address, chain, hide_spam_token: true, pagination: { page: 1, per_page: 10 } }), signal: AbortSignal.timeout(15000),
    });
    if (r.status === 401 || r.status === 403) throw new Reject("Nansen refused the API key on this server.");
    if (!r.ok) throw new Reject(`Nansen didn't answer (HTTP ${r.status}). Try again in a moment.`);
    const j = (await r.json()) as { data?: { token_symbol?: string; token_amount?: number; value_usd?: number }[] };
    const rows = (j.data || []).slice(0, 10);
    const total = rows.reduce((s, x) => s + (Number(x.value_usd) || 0), 0);
    const list = rows.map((x) => `${x.token_symbol || "?"}: ${(+Number(x.token_amount || 0).toFixed(4)).toLocaleString("en-US")} ($${(Number(x.value_usd) || 0).toFixed(2)})`).join("; ");
    return { summary: "Read a wallet on Nansen", text: rows.length ? `Nansen, ${address} on ${chain}: top holdings ${list}. About $${total.toFixed(2)} in these.` : `Nansen has no balances for ${address} on ${chain}.` };
  },
};


/* ---------- Nansen smart money ---------- */
type Flow = { token_symbol?: string; chain?: string; net_flow_24h_usd?: number; net_flow_7d_usd?: number; trader_count?: number };
export async function nansenNetflow(chains: string[], limit = 20): Promise<Flow[]> {
  const base = (process.env.NANSEN_API_URL || "https://api.nansen.ai/api/v1").replace(/\/+$/, "");
  const r = await fetch(`${base}/smart-money/netflow`, {
    method: "POST", headers: { "content-type": "application/json", apiKey: process.env.NANSEN_API_KEY! },
    body: JSON.stringify({ chains, pagination: { page: 1, per_page: limit }, order_by: [{ field: "net_flow_24h_usd", direction: "DESC" }] }), signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Reject(`Nansen didn't answer (HTTP ${r.status}).`);
  const j = (await r.json()) as { data?: Flow[] };
  return j.data || [];
}
const usd0 = (n?: number) => `${(n || 0) < 0 ? "-" : "+"}$${Math.abs(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const smIn = z.object({ chains: z.array(z.string().max(20)).max(5).optional(), chain: z.string().max(20).optional(), token: z.string().max(20).optional() }).passthrough();
const nansenSmart: ToolDef = {
  name: "nansen.smartmoney", connector: "nansen", risk: "read", input: smIn,
  hint: 'nansen.smartmoney {"chains":["solana","ethereum"],"token":"SOL"} : Nansen smart money net flows (what top wallets are buying or selling, 24h and 7d). Check it before any trade.',
  run: async (i: never) => {
    const p = i as z.output<typeof smIn>;
    if (!nansenReady()) throw new Reject("Nansen is not set up on this server yet (no API key).");
    const chains = (p.chains?.length ? p.chains : [p.chain || "solana"]).map((c) => c.toLowerCase());
    let rows = await nansenNetflow(chains, 25);
    if (p.token) rows = rows.filter((r) => (r.token_symbol || "").toUpperCase() === p.token!.toUpperCase());
    const list = rows.slice(0, 8).map((r) => `${r.token_symbol} (${r.chain}): 24h ${usd0(r.net_flow_24h_usd)}, 7d ${usd0(r.net_flow_7d_usd)}`).join("; ");
    return { summary: "Nansen smart money flows", text: list ? `Nansen smart money net flows: ${list}.` : `Nansen shows no smart money flow${p.token ? ` for ${p.token}` : ""} on ${chains.join(", ")} right now.` };
  },
};
/** One line for a Confirm card: what Nansen smart money did with this token. Never throws. */
export async function nansenCheck(symbol: string, chain = "solana"): Promise<string> {
  if (!nansenReady()) return "Skipped: Nansen isn't set up on this server";
  const sym = symbol.toUpperCase().replace(/^W(?=SOL|ETH|MON)/, "");
  try {
    const rows = await nansenNetflow([chain], 50);
    const r = rows.find((x) => (x.token_symbol || "").toUpperCase().replace(/^W(?=SOL|ETH|MON)/, "") === sym);
    if (!r) return `No smart money flow for ${sym} on ${chain} in the last day`;
    const f = r.net_flow_24h_usd || 0;
    return `Smart money ${f >= 0 ? "buying" : "selling"} ${sym}: ${usd0(f)} in 24h, ${usd0(r.net_flow_7d_usd)} in 7d`;
  } catch { return "Skipped: Nansen didn't answer in time"; }
}

/* ---------- Kuru (@kuru-labs/kuru-sdk, Monad testnet) ---------- */
// Pools come from Kuru's API (KURU_API_URL, the base the SDK's PoolFetcher takes). Swaps go through Kuru's router
// (KURU_ROUTER_ADDRESS). Without them the tools say so and do nothing.
export const kuruReady = () => !!process.env.KURU_API_URL;
export const kuruTradeReady = () => kuruReady() && /^0x[0-9a-fA-F]{40}$/.test(process.env.KURU_ROUTER_ADDRESS || "");
type KToken = { symbol: string; address: string; decimals: number };
const ZERO = "0x0000000000000000000000000000000000000000";
export function kuruTokens(): KToken[] {
  try { if (process.env.KURU_TOKENS) return JSON.parse(process.env.KURU_TOKENS) as KToken[]; } catch { /* fall through */ }
  return [
    { symbol: "MON", address: ZERO, decimals: 18 },
    { symbol: "WMON", address: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701", decimals: 18 },
    { symbol: "USDC", address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea", decimals: 6 },
  ];
}
const kTok = (s: string) => {
  const t = kuruTokens().find((x) => x.symbol.toUpperCase() === s.toUpperCase());
  if (!t) throw new Reject(`Kuru on Monad testnet: I only know ${kuruTokens().map((x) => x.symbol).join(", ")}.`);
  return t;
};
async function kuruSdk() {
  const [sdk, { ethers }] = await Promise.all([import("@kuru-labs/kuru-sdk"), import("ethers")]);
  return { sdk, ethers };
}
export async function kuruRoute(sell: string, buy: string, amount: number) {
  if (!kuruReady()) throw new Reject("Kuru is not set up on this server yet (no Kuru API URL), so I can't quote on it.");
  const a = kTok(sell), b = kTok(buy);
  if (a.address === b.address) throw new Reject("Pick two different tokens.");
  const { sdk, ethers } = await kuruSdk();
  const provider = new ethers.providers.JsonRpcProvider(MONAD.rpc(), MONAD.chainId);
  const fetcher = new sdk.PoolFetcher(process.env.KURU_API_URL!.replace(/\/+$/, ""));
  let route;
  try { route = await sdk.PathFinder.findBestPath(provider, a.address, b.address, amount, "amountIn", fetcher); }
  catch (e) { throw new Reject(`Kuru couldn't find a route for ${a.symbol} to ${b.symbol} (${(e as Error).message.slice(0, 120)}).`); }
  if (!(route.output > 0)) throw new Reject(`Kuru has no liquidity for ${a.symbol} to ${b.symbol} right now.`);
  return { a, b, route, provider, sdk, ethers };
}
const kuruIn = z.object({ sell: z.string().trim(), buy: z.string().trim(), amount: z.coerce.number().positive(), slippage: z.coerce.number().positive().max(50).optional() });
const kuruQuote: ToolDef = {
  name: "kuru.quote", connector: "kuru", risk: "read", input: kuruIn,
  hint: 'kuru.quote {"sell":"MON","buy":"USDC","amount":1} : the best Kuru route and output on Monad testnet. Read only, nothing trades.',
  run: async (i: never) => {
    const { sell, buy, amount } = i as z.infer<typeof kuruIn>;
    const { a, b, route } = await kuruRoute(sell, buy, amount);
    return { summary: "Kuru quote", text: `Kuru on Monad testnet: ${amount} ${a.symbol} gets about ${+route.output.toFixed(6)} ${b.symbol} over ${route.route.path.length} market(s)${route.priceImpact ? `, price impact ${(+route.priceImpact).toFixed(2)}%` : ""}. Quote only; nothing traded.` };
  },
};
type KuruPlan = { kind: "kuru-swap"; sell: string; buy: string; amount: number; slippagePct: number; expected: number };
async function usdOf(sym: string, amt: number) {
  if (/USDC/i.test(sym)) return amt;
  const { route } = await kuruRoute(sym, "USDC", amt);
  return route.output;
}
const kuruSwap: ToolDef = {
  name: "kuru.swap", connector: "kuru", risk: "sign", input: kuruIn,
  hint: 'kuru.swap {"sell":"MON","buy":"USDC","amount":1,"slippage":1} : prepare a swap on Kuru (Monad testnet) from YOUR Monad wallet; the person confirms it.',
  prepare: async (i: never, agent: AgentRef, limits: GrantLimits): Promise<Prepared> => {
    const { sell, buy, amount, slippage } = i as z.infer<typeof kuruIn>;
    if (!kuruTradeReady()) throw new Reject("Kuru trading is not set up on this server yet (no Kuru router address), so I can only quote.");
    const slippagePct = slippage ?? Math.min(limits.maxSlippageBps / 100, 1);
    if (slippagePct * 100 > limits.maxSlippageBps) throw new Reject(`That's ${slippagePct}% slippage, over your ${limits.maxSlippageBps / 100}% limit for Kuru.`);
    const { a, b, route } = await kuruRoute(sell, buy, amount);
    const usd = await usdOf(a.symbol, amount).catch(() => { throw new Reject("I couldn't price this trade in USD to check your limits, so nothing was prepared."); });
    if (usd > limits.perTxUsd) throw new Reject(`That's about $${usd.toFixed(2)}, over your $${limits.perTxUsd} per trade limit for Kuru.`);
    const addr = evmAddress(agent.userId, agent.slug);
    const mon = await monBalance(addr);
    if (mon <= 0) throw new Reject(`My Monad testnet wallet (${addr}) has no MON for gas yet. Send it test MON first.`);
    const plan: KuruPlan = { kind: "kuru-swap", sell: a.symbol, buy: b.symbol, amount, slippagePct, expected: route.output };
    return {
      title: `Swap ${amount} ${a.symbol} for ${b.symbol} on Kuru`, chain: "monad", usdMicros: Math.round(usd * 1e6), summary: `Kuru swap ${a.symbol} to ${b.symbol}`, plan,
      rows: [["Sell", `${amount} ${a.symbol}`], ["Expected", `About ${+route.output.toFixed(6)} ${b.symbol}`], ["Slippage", `${slippagePct}%`], ["Value", `About $${usd.toFixed(2)}`], ["Network", MONAD.network], ["Wallet", `${addr.slice(0, 6)}…${addr.slice(-4)}`]],
    };
  },
  execute: async (p: never, agent: AgentRef): Promise<Executed> => {
    const plan = p as KuruPlan;
    if (plan.kind !== "kuru-swap") throw new Reject("That swap can't run any more.");
    const { a, b, route, provider, sdk, ethers } = await kuruRoute(plan.sell, plan.buy, plan.amount);
    if (route.output < plan.expected * (1 - plan.slippagePct / 100)) throw new Reject("The Kuru price moved past your slippage since you saw the card. Nothing was sent.");
    const signer = new ethers.Wallet(Buffer.from(evmKey(agent.userId, agent.slug)).toString("hex"), provider);
    const rc = await sdk.TokenSwap.swap(signer, process.env.KURU_ROUTER_ADDRESS!, route, plan.amount, a.decimals, b.decimals, plan.slippagePct, true, () => {});
    return { sig: rc.transactionHash, confirmed: rc.status === 1, rows: [["Swapped", `${plan.amount} ${a.symbol} to ${b.symbol}`], ["Explorer", `https://testnet.monadexplorer.com/tx/${rc.transactionHash}`]] };
  },
};

export const MONAD_TOOLS: ToolDef[] = [monadWallet, nansenWallet, nansenSmart, kuruQuote, kuruSwap];
