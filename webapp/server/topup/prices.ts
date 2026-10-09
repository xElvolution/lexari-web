/** Live USD prices for content/topup.ts coins: stablecoins $1, Coinbase spot for majors, Jupiter (mainnet mints) for Solana tokens. */
import { coinById, type CoinId } from "@/content/topup";
import { spotUsd } from "../integrations/market";

const cache = new Map<string, { at: number; v: number }>();
const TTL = 20_000;

async function jupiterUsd(mint: string) {
  const base = process.env.JUPITER_API_KEY ? "https://api.jup.ag" : "https://lite-api.jup.ag";
  const r = await fetch(`${base}/price/v3?ids=${mint}`, { headers: process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : {}, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Jupiter price HTTP ${r.status}`);
  const j = (await r.json()) as Record<string, { usdPrice?: number }>;
  const v = Number(j[mint]?.usdPrice);
  if (!(v > 0)) throw new Error("no Jupiter price");
  return v;
}

/** USD for one whole coin. Throws when no live price can be had (then nothing is priced or credited). */
export async function coinUsd(id: CoinId): Promise<number> {
  const c = coinById(id);
  if (!c) throw new Error(`unknown coin ${id}`);
  if ("usd" in c.price) return 1;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const v = "coinbase" in c.price ? await spotUsd(c.price.coinbase) : await jupiterUsd(c.price.jupiter);
  if (!(v > 0) || !Number.isFinite(v)) throw new Error(`bad price for ${id}`);
  cache.set(id, { at: Date.now(), v });
  return v;
}
