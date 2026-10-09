/** Lexari's own x402 services (pay per request in devnet USDC). Real live data behind a 402. */
import { coinUsd } from "../topup/prices";
import type { CoinId } from "@/content/topup";
import { polymarketMarkets, spotUsd } from "../integrations/market";

export type Service = { id: string; name: string; priceAtoms: number; description: string; run: (q: URLSearchParams) => Promise<unknown> };

export const SERVICES: Service[] = [
  {
    id: "market-brief", name: "Market brief", priceAtoms: 30_000, description: "Live prices for BTC, ETH, SOL, SKR and ORE plus the top 3 Polymarket markets",
    run: async () => {
      const [btc, eth, sol, skr, ore, pm] = await Promise.all([spotUsd("BTC"), spotUsd("ETH"), spotUsd("SOL"), coinUsd("SKR"), coinUsd("ORE"), polymarketMarkets("", 3).catch(() => [])]);
      return { at: new Date().toISOString(), prices: { BTC: btc, ETH: eth, SOL: sol, SKR: skr, ORE: ore }, markets: pm.map((m) => ({ title: m.title, outcomes: m.outcomes, volume24h: m.volume24h })) };
    },
  },
  {
    id: "token-price", name: "Token price", priceAtoms: 10_000, description: "Live USD price of one crypto asset (?symbol=BTC)",
    run: async (q) => {
      const s = (q.get("symbol") || "SOL").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
      const usd = await spotUsd(s).catch(() => coinUsd(s as CoinId));
      if (!usd) throw new Error(`No live price for ${s}.`);
      return { symbol: s, usd, at: new Date().toISOString() };
    },
  },
];
export const serviceById = (id: string) => SERVICES.find((s) => s.id === id);
