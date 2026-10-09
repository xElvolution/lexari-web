/**
 * Cross-chain quotes from LI.FI (public API, no key): what moving a token from one chain to another would return,
 * the route (bridge/DEX), fees and time. Reference only: Lexari never bridges, and nothing here signs anything.
 */
const BASE = "https://li.quest/v1";
// LI.FI needs a sender for a quote; these stand-ins are never used to move funds.
const SENDER: Record<string, string> = { svm: "7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q", evm: "0x000000000000000000000000000000000000dEaD", utxo: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" };
const ALIAS: Record<string, string> = { solana: "SOL", sol: "SOL", ethereum: "ETH", eth: "ETH", mainnet: "ETH", base: "BAS", arbitrum: "ARB", arb: "ARB", optimism: "OPT", op: "OPT", polygon: "POL", matic: "POL", bsc: "BSC", bnb: "BSC", "bnb chain": "BSC", avalanche: "AVA", avax: "AVA", bitcoin: "BTC", btc: "BTC", gnosis: "DAI", sonic: "SON", hyperevm: "HYP", unichain: "UNI" };
const NAMES: Record<string, string> = { SOL: "Solana", ETH: "Ethereum", BAS: "Base", ARB: "Arbitrum", OPT: "Optimism", POL: "Polygon", BSC: "BNB Chain", AVA: "Avalanche", BTC: "Bitcoin", DAI: "Gnosis", SON: "Sonic", HYP: "HyperEVM", UNI: "Unichain" };
const typeOf = (chain: string) => (chain === "SOL" ? "svm" : chain === "BTC" ? "utxo" : "evm");

export function chainKey(s: string) {
  const k = s.trim().toLowerCase();
  const c = ALIAS[k] || k.toUpperCase();
  if (!NAMES[c]) throw new Error(`I can quote Solana, Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Avalanche and Bitcoin, not "${s}".`);
  return c;
}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  const j = await r.json().catch(() => ({})) as T & { message?: string };
  if (!r.ok) throw new Error(j.message ? String(j.message).slice(0, 160) : `HTTP ${r.status}`);
  return j;
}

export type BridgeQuote = { from: string; to: string; fromChain: string; toChain: string; amount: number; out: number; outMin: number; outUsd: number; feesUsd: number; gasUsd: number; secs: number; route: string };

export async function bridgeQuote(i: { fromChain: string; toChain: string; fromToken: string; toToken?: string; amount: number }): Promise<BridgeQuote> {
  const fc = chainKey(i.fromChain), tc = chainKey(i.toChain);
  if (!(i.amount > 0) || i.amount > 1e9) throw new Error("The amount has to be more than 0.");
  const ft = i.fromToken.trim().toUpperCase().slice(0, 20), tt = (i.toToken || i.fromToken).trim().toUpperCase().slice(0, 20);
  const tok = await get<{ decimals: number; symbol: string }>(`${BASE}/token?chain=${fc}&token=${encodeURIComponent(ft)}`).catch(() => { throw new Error(`I couldn't find ${ft} on ${NAMES[fc]}.`); });
  const units = BigInt(Math.round(i.amount * 10 ** Math.min(tok.decimals, 12))) * BigInt(10) ** BigInt(Math.max(0, tok.decimals - 12));
  const q = new URLSearchParams({ fromChain: fc, toChain: tc, fromToken: ft, toToken: tt, fromAmount: units.toString(), fromAddress: SENDER[typeOf(fc)], toAddress: SENDER[typeOf(tc)], slippage: "0.005"});
  const j = await get<{ toolDetails?: { name?: string }; includedSteps?: { toolDetails?: { name?: string } }[]; action: { toToken: { decimals: number; symbol: string } }; estimate: { toAmount: string; toAmountMin: string; toAmountUSD?: string; executionDuration?: number; feeCosts?: { amountUSD?: string }[]; gasCosts?: { amountUSD?: string }[] } }>(`${BASE}/quote?${q}`);
  const d = j.action.toToken.decimals;
  const n = (s: string) => Number(s) / 10 ** d;
  const usd = (a?: { amountUSD?: string }[]) => (a || []).reduce((s, x) => s + (Number(x.amountUSD) || 0), 0);
  const steps = [...new Set((j.includedSteps || []).map((s) => s.toolDetails?.name).filter((x): x is string => !!x && !/fee/i.test(x)))];
  return {
    from: tok.symbol, to: j.action.toToken.symbol, fromChain: NAMES[fc], toChain: NAMES[tc], amount: i.amount, out: n(j.estimate.toAmount), outMin: n(j.estimate.toAmountMin),
    outUsd: Number(j.estimate.toAmountUSD) || 0, feesUsd: usd(j.estimate.feeCosts), gasUsd: usd(j.estimate.gasCosts), secs: j.estimate.executionDuration || 0,
    route: steps.length ? steps.join(" → ") : j.toolDetails?.name || "LI.FI",
  };
}
