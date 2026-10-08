/**
 * Live public market data for integrations: Polymarket markets and odds, Jupiter mainnet quotes, and USD spot prices.
 * All read only. Every call has a timeout and a small retry; results are cached briefly so a busy chat doesn't hammer
 * the public endpoints.
 */
import type { MarketItem } from "@/content/integrations";

const cache = new Map<string, { at: number; v: unknown }>();
async function getJson<T>(url: string, opts: { ttl?: number; headers?: Record<string, string> } = {}): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < (opts.ttl ?? 20_000)) return hit.v as T;
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json", ...opts.headers }, signal: AbortSignal.timeout(8000) });
      if (r.status === 429 || r.status >= 500) { last = `HTTP ${r.status}`; await new Promise((res) => setTimeout(res, 500 * 2 ** attempt)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const v = (await r.json()) as T;
      cache.set(url, { at: Date.now(), v });
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);
      return v;
    } catch (e) { last = (e as Error).message; if (/HTTP 4/.test(last)) break; await new Promise((res) => setTimeout(res, 500 * 2 ** attempt)); }
  }
  throw new Error(last || "unreachable");
}

/* ---------- Polymarket (gamma API, public reads) ---------- */
export type GammaMarket = { question?: string; groupItemTitle?: string; outcomes?: string; outcomePrices?: string; active?: boolean; closed?: boolean; slug?: string; volume24hr?: number; endDate?: string; acceptingOrders?: boolean; umaResolutionStatus?: string; sportsMarketType?: string };
export type GammaEvent = { title?: string; slug?: string; volume24hr?: number; endDate?: string; markets?: GammaMarket[]; closed?: boolean; active?: boolean };
const parse = (s?: string): string[] => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };

export function toMarketItem(e: GammaEvent): MarketItem | null {
  // Open markets only: not closed, still taking orders, not resolving (a finished game sits at 99.95% until it settles).
  let live = (e.markets || []).filter((m) => m.active !== false && !m.closed && m.acceptingOrders !== false && !["proposed", "resolved"].includes(m.umaResolutionStatus || ""));
  // A game: its moneyline (who wins) instead of every spread and total.
  const main = live.find((m) => m.sportsMarketType === "moneyline");
  if (main) live = [main];
  if (!e.title || !live.length) return null;
  // Effectively decided: one side of a single market, or one option of a group, is at 99.5% or more.
  const prices = (m: GammaMarket) => parse(m.outcomePrices).map(Number);
  if (live.length === 1 ? prices(live[0]).some((p) => p >= 0.995) : live.some((m) => (prices(m)[0] || 0) >= 0.995)) return null;
  let outcomes: { label: string; pct: number }[];
  if (live.length === 1) {
    const names = parse(live[0].outcomes), prices = parse(live[0].outcomePrices).map(Number);
    outcomes = names.map((label, i) => ({ label, pct: Math.round((prices[i] || 0) * 1000) / 10 }));
  } else {
    outcomes = live.map((m) => ({ label: m.groupItemTitle || m.question || "", pct: Math.round((Number(parse(m.outcomePrices)[0]) || 0) * 1000) / 10 }))
      .filter((o) => o.label).sort((a, b) => b.pct - a.pct);
  }
  return { title: e.title, url: `https://polymarket.com/event/${e.slug}`, volume24h: Math.round(e.volume24hr || 0), ends: e.endDate, outcomes: outcomes.slice(0, 3) };
}

/** Trending markets (by 24h volume), or markets matching a search. */
export async function polymarketMarkets(query: string, limit: number): Promise<MarketItem[]> {
  const n = Math.max(1, Math.min(8, limit || 5));
  const base = "https://gamma-api.polymarket.com";
  let events: GammaEvent[];
  if (query.trim()) {
    const r = await getJson<{ events?: GammaEvent[] }>(`${base}/public-search?q=${encodeURIComponent(query.trim().slice(0, 80))}&limit_per_type=${n * 3}&events_status=active&keep_closed_markets=0`);
    events = (r.events || []).filter((e) => !e.closed);
    events.sort((a, b) => (b.volume24hr || 0) - (a.volume24hr || 0));
  } else {
    events = await getJson<GammaEvent[]>(`${base}/events?limit=${n * 4}&active=true&closed=false&order=volume24hr&ascending=false`, { ttl: 60_000 });
  }
  return events.map(toMarketItem).filter((x): x is MarketItem => !!x).slice(0, n);
}

/* ---------- USD spot prices ---------- */
/** Live USD spot price for a symbol (BTC, ETH, SOL, ...). Throws when unknown or unreachable. */
export async function spotUsd(symbol: string): Promise<number> {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  if (!s) throw new Error("no symbol");
  if (s === "USDC" || s === "USDT") return 1;
  const r = await getJson<{ data?: { amount?: string } }>(`https://api.coinbase.com/v2/prices/${s}-USD/spot`, { ttl: 15_000 });
  const v = Number(r.data?.amount);
  if (!(v > 0)) throw new Error(`no price for ${s}`);
  return v;
}

/* ---------- Jupiter (mainnet quotes, read only) ---------- */
export const SOL_MINT = "So11111111111111111111111111111111111111112";
const KNOWN: Record<string, { mint: string; decimals: number }> = {
  SOL: { mint: SOL_MINT, decimals: 9 },
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
  JUP: { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6 },
  WIF: { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6 },
  JTO: { mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 9 },
  PYTH: { mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6 },
  RAY: { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6 },
  ORCA: { mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6 },
};
const jupBase = () => (process.env.JUPITER_API_KEY ? "https://api.jup.ag" : "https://lite-api.jup.ag");
const jupHeaders = (): Record<string, string> => (process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : {});

/** A token by symbol (a short list of well known ones, then Jupiter's verified token search) or by mint address. */
export async function resolveToken(q: string): Promise<{ symbol: string; mint: string; decimals: number }> {
  const s = q.trim();
  const k = KNOWN[s.toUpperCase()];
  if (k) return { symbol: s.toUpperCase(), ...k };
  const r = await getJson<{ id: string; symbol: string; decimals: number; isVerified?: boolean; tags?: string[] }[]>(`${jupBase()}/tokens/v2/search?query=${encodeURIComponent(s.slice(0, 60))}`, { ttl: 300_000, headers: jupHeaders() });
  const hit = r.find((t) => t.id === s) || r.find((t) => t.symbol?.toUpperCase() === s.toUpperCase() && (t.isVerified || t.tags?.includes("verified")));
  if (!hit) throw new Error(`I couldn't find a verified token called ${s.slice(0, 20)}.`);
  return { symbol: hit.symbol, mint: hit.id, decimals: hit.decimals };
}

export async function jupiterQuote(from: string, to: string, amount: number, slippageBps = 50) {
  const [a, b] = await Promise.all([resolveToken(from), resolveToken(to)]);
  const atoms = Math.round(amount * 10 ** a.decimals);
  if (!(atoms > 0)) throw new Error("The amount has to be more than 0.");
  const r = await getJson<{ outAmount?: string; priceImpactPct?: string; routePlan?: { swapInfo?: { label?: string } }[]; error?: string }>(
    `${jupBase()}/swap/v1/quote?inputMint=${a.mint}&outputMint=${b.mint}&amount=${atoms}&slippageBps=${slippageBps}`, { ttl: 10_000, headers: jupHeaders() });
  if (!r.outAmount) throw new Error(r.error || "No route found.");
  const out = Number(r.outAmount) / 10 ** b.decimals;
  const venues = [...new Set((r.routePlan || []).map((p) => p.swapInfo?.label).filter(Boolean))] as string[];
  return { from: a.symbol, to: b.symbol, amount, out, impactPct: Math.round(Number(r.priceImpactPct || 0) * 10000) / 100, venues };
}
