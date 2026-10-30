/**
 * Deposit coin picker, sourced live from Aurora Intents Connect (GET /api/v1/supported_tokens). Any listed coin can be
 * sent to a one-time Aurora Intents deposit address; Aurora Intents converts it to USDC in the agent's balance on
 * Solana. Logos come from CoinGecko by each token's coingeckoId, with a monogram fallback in the UI.
 * Deposit addresses come from an Aurora Intents Swap API quote, so they need AURORA_INTENTS_API_KEY.
 */
import QR from "qrcode";
import { cluster } from "../config";
import { intentsReady, intentsDepositQuote, intentsTokens } from "./intents";
import { IS_MAINNET } from "@/lib/network";

const CONNECT = () => (process.env.AURORA_INTENTS_CONNECT_URL || "https://intents-connect-api.aurora.dev").replace(/\/+$/, "");
type Raw = { assetId: string; symbol: string; blockchain: string; decimals: number; price: number; coingeckoId?: string; contractAddress?: string };
export type DepositChain = { assetId: string; chain: string; decimals: number; direct?: boolean; network?: string; note?: string };
export type DepositCoin = { symbol: string; name: string; price: number; logo: string | null; chains: DepositChain[] };
const CHAIN_NAME: Record<string, string> = { xrp: "XRP Ledger", doge: "Dogecoin", ltc: "Litecoin", bch: "Bitcoin Cash", cardano: "Cardano", aptos: "Aptos", starknet: "Starknet", aleo: "Aleo", movement: "Movement", dash: "Dash", zec: "Zcash", abs: "Abstract", adi: "ADI", fogo: "Fogo", hood: "Robinhood Chain", eth: "Ethereum", sol: "Solana", base: "Base", arb: "Arbitrum", op: "Optimism", pol: "Polygon", bsc: "BNB Chain", avax: "Avalanche", near: "NEAR", monad: "Monad", tron: "Tron", ton: "TON", gnosis: "Gnosis", stellar: "Stellar", bera: "Berachain", scroll: "Scroll", xlayer: "X Layer", plasma: "Plasma", btc: "Bitcoin", hypercore: "Hyperliquid", sui: "Sui" };
export const chainName = (c: string) => CHAIN_NAME[c] || c;
const EXTRA_CG: Record<string, string> = { BTC: "bitcoin", XRP: "ripple", DOGE: "dogecoin", LTC: "litecoin", BCH: "bitcoin-cash", ADA: "cardano", APT: "aptos", SUI: "sui", TON: "the-open-network", DASH: "dash", STRK: "starknet", ALEO: "aleo", MOVE: "movement", ETH: "ethereum", SOL: "solana", BNB: "binancecoin", MON: "monad", USDC: "usd-coin", USDT: "tether", TRX: "tron", XLM: "stellar", ZEC: "zcash", NEAR: "near", AVAX: "avalanche-2", POL: "polygon-ecosystem-token", HYPE: "hyperliquid" };
type Direct = { id: string; symbol: string; name: string; chain: string; wallet: "evm" | "solana"; network: () => string; note: string; cg?: string; logo?: string; price: number };
const solNet = () => (cluster() === "devnet" ? "Solana devnet" : "Solana");
const ALL_DIRECT: Direct[] = [
  { id: "ausd-monad", symbol: "AUSD", name: "Agora USD", chain: "monad", wallet: "evm", network: () => "Monad testnet", note: "Send Agora AUSD on Monad testnet only. It lands in the agent's own wallet and counts in its balance.", cg: "agora-dollar", price: 1 },
  { id: "mon-monad", symbol: "MON", name: "Monad", chain: "monad", wallet: "evm", network: () => "Monad testnet", note: "Send test MON on Monad testnet. It also pays gas for the agent's Monad actions.", cg: "monad", price: 0 },
  { id: "ore-solana", symbol: "ORE", name: "ORE", chain: "sol", wallet: "solana", network: solNet, note: "Send ORE on Solana to the agent's own Solana wallet.", cg: "ore", price: 0 },
  { id: "pathusd-tempo", symbol: "pathUSD", name: "pathUSD (Tempo stablecoin)", chain: "tempo", wallet: "evm", network: () => "Tempo Moderato testnet", note: "Tempo has no native coin: send a TIP-20 stablecoin (pathUSD) on Tempo testnet. Fees are paid in the same stablecoin.", logo: "https://www.google.com/s2/favicons?domain=tempo.xyz&sz=128", price: 1 },
  { id: "alphausd-tempo", symbol: "AlphaUSD", name: "AlphaUSD (Tempo stablecoin)", chain: "tempo", wallet: "evm", network: () => "Tempo Moderato testnet", note: "Tempo has no native coin: send a TIP-20 stablecoin (AlphaUSD) on Tempo testnet. Fees are paid in the same stablecoin.", logo: "https://www.google.com/s2/favicons?domain=tempo.xyz&sz=128", price: 1 },
  { id: "hype-hyperliquid", symbol: "HYPE", name: "Hyperliquid", chain: "hypercore", wallet: "evm", network: () => "Hyperliquid testnet", note: "Send HYPE inside Hyperliquid testnet (a Hyperliquid spot transfer to this address). Don't send from another chain.", cg: "hyperliquid", price: 0 },
  { id: "usdc-hyperliquid", symbol: "USDC", name: "USD Coin", chain: "hypercore", wallet: "evm", network: () => "Hyperliquid testnet", note: "Send USDC as a Hyperliquid testnet transfer (Send in the Hyperliquid app) to this address. From another chain, use the Hyperliquid bridge on Arbitrum, not a plain transfer.", cg: "usd-coin", price: 1 },
];
/**
 * Mainnet: AUSD (Agora testnet address), Tempo (Moderato) and Hyperliquid (testnet API) are testnet-only here, so only
 * MON on Monad (chain 143) and ORE on Solana stay, with mainnet wording.
 */
const MAINNET_DIRECT: Record<string, Partial<Direct>> = {
  "mon-monad": { network: () => "Monad", note: "Send MON on Monad. It also pays gas for the agent's Monad actions." },
  "ore-solana": {},
};
const DIRECT: Direct[] = IS_MAINNET ? ALL_DIRECT.filter((d) => d.id in MAINNET_DIRECT).map((d) => ({ ...d, ...MAINNET_DIRECT[d.id] })) : ALL_DIRECT;
let cache: { at: number; coins: DepositCoin[] } | null = null;

export async function depositCoins(): Promise<DepositCoin[]> {
  if (cache && Date.now() - cache.at < 600_000) return cache.coins;
  const r = await fetch(`${CONNECT()}/api/v1/supported_tokens`, { signal: AbortSignal.timeout(12_000) });
  if (!r.ok) throw new Error(`Aurora Intents Connect said HTTP ${r.status}`);
  const connect = ((await r.json()) as { result: { in: Raw[] } }).result.in;
  // With the API key, the Aurora Intents Swap API token list is the live source (it is wider: native BTC, XRP, DOGE…).
  // Connect's list still supplies CoinGecko ids for logos.
  const cg = new Map<string, string>(Object.entries(EXTRA_CG));
  for (const t of connect) if (t.coingeckoId) cg.set(t.symbol.toUpperCase(), t.coingeckoId);
  const live = intentsReady() ? await intentsTokens().catch(() => null) : null;
  const src: Raw[] = live?.length ? live.map((t) => ({ ...t, coingeckoId: cg.get(t.symbol.toUpperCase()) })) : connect;
  const all = src.filter((t) => !/deprecated|test/i.test(t.symbol));
  const ids = [...new Set([...all.map((t) => t.coingeckoId), ...DIRECT.map((d) => d.cg)].filter(Boolean))] as string[];
  const meta = new Map<string, { image: string; name: string }>();
  for (let i = 0; i < ids.length; i += 200) {
    const m = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&ids=${ids.slice(i, i + 200).join(",")}`, { signal: AbortSignal.timeout(12_000) }).then((x) => (x.ok ? x.json() : []), () => []) as { id: string; image: string; name: string }[];
    for (const c of m) meta.set(c.id, { image: c.image, name: c.name });
  }
  const by = new Map<string, DepositCoin>();
  for (const t of all) {
    const k = t.symbol.toUpperCase();
    const m = t.coingeckoId ? meta.get(t.coingeckoId) : undefined;
    const c = by.get(k) || { symbol: t.symbol, name: m?.name || t.symbol, price: t.price, logo: m?.image || null, chains: [] };
    if (!c.logo && m?.image) c.logo = m.image;
    c.chains.push({ assetId: t.assetId, chain: t.blockchain, decimals: t.decimals });
    by.set(k, c);
  }
  // Coins Aurora doesn't route: sent straight to the agent's own wallet on that network.
  for (const d of DIRECT) {
    const k = d.symbol.toUpperCase();
    const m = d.cg ? meta.get(d.cg) : undefined;
    const c = by.get(k) || { symbol: d.symbol, name: m?.name || d.name, price: d.price, logo: m?.image || d.logo || null, chains: [] };
    if (!c.logo) c.logo = m?.image || d.logo || null;
    c.chains.unshift({ assetId: `direct:${d.id}`, chain: d.chain, decimals: 0, direct: true, network: d.network(), note: d.note });
    by.set(k, c);
  }
  const rank = ["USDC", "USDT", "ETH", "BTC", "SOL", "WBTC", "BNB", "MON", "NEAR", "USDT0", "AVAX", "TRX", "XLM", "ZEC", "ARB", "OP", "POL", "DAI", "XAUT"];
  const coins = [...by.values()].sort((a, b) => ((rank.indexOf(a.symbol.toUpperCase()) + 1 || 99) - (rank.indexOf(b.symbol.toUpperCase()) + 1 || 99)) || a.symbol.localeCompare(b.symbol));
  cache = { at: Date.now(), coins };
  return coins;
}

/** A one-time deposit address for `amount` of the coin on `chain`. Aurora Intents converts it to USDC on Solana. */
export async function depositAddress(recipient: string, refund: string, assetId: string, amount: number) {
  if (assetId.startsWith("direct:")) {
    const d = DIRECT.find((x) => `direct:${x.id}` === assetId);
    if (!d) throw new Error("That coin isn't open for deposits.");
    const address = d.wallet === "solana" ? recipient : refund;
    return { ready: true as const, direct: true, coin: d.symbol, chain: d.network(), address, memo: null, receive: null, note: d.note, deadline: null, qr: await QR.toString(address, { type: "svg", margin: 1, width: 180 }) };
  }
  const coins = await depositCoins();
  const coin = coins.find((c) => c.chains.some((x) => x.assetId === assetId));
  const ch = coin?.chains.find((x) => x.assetId === assetId);
  if (!coin || !ch) throw new Error("Aurora Intents doesn't take that coin.");
  if (!intentsReady()) return { ready: false as const, coin: coin.symbol, chain: chainName(ch.chain) };
  const q = await intentsDepositQuote(recipient, refund, ch, amount);
  return { ready: true as const, coin: coin.symbol, chain: chainName(ch.chain), address: q.depositAddress, memo: q.depositMemo || null, receive: q.amountOutFormatted, deadline: q.deadline || null, qr: await QR.toString(q.depositAddress, { type: "svg", margin: 1, width: 180 }) };
}
