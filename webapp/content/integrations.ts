/**
 * The integrations catalog, as people see it in Settings > Integrations. One entry per connector. The server side of
 * each one (its tools, limits and what it runs) lives in server/integrations/registry.ts under the same id, so adding
 * an integration is one entry here plus its tools there.
 *
 * Status is honest per connector: "devnet" executes real transactions on Solana devnet, "testnet" reads a testnet
 * wallet (no execution yet), "live" executes on a non-Solana testnet, "market" reads live public market data (nothing
 * moves), "needskey" is built but waits for an API key on the server, "soon" is listed but can't be added.
 * `builtin` ones aren't in the catalog: every agent has them (payments) or one agent does (the ORE Miner's servers).
 */
export type IntegrationId = "solana" | "orca" | "jupiter" | "bridge" | "polymarket" | "panta" | "base" | "ethereum" | "tempo" | "prices" | "payments" | "ore" | "solami";
export type IntegrationCategory = "chains" | "trading" | "prediction" | "data";
export type IntegrationStatus = "devnet" | "live" | "testnet" | "market" | "needskey" | "soon";

export type IntegrationInfo = {
  id: IntegrationId;
  name: string;
  category: IntegrationCategory;
  /** one line for the catalog row */
  blurb: string;
  /** a short paragraph for the add sheet */
  about: string;
  chains: string[];
  status: IntegrationStatus;
  /** false: visible in the catalog but not addable yet */
  addable: boolean;
  /** true when its agents can move money (shows per-trade, daily and slippage limits) */
  moves: boolean;
  /** what an agent can do with it; live false = coming soon */
  can: { text: string; live: boolean }[];
  /** search words */
  tags: string;
  /** always on (not in the catalog): "all" agents, or only these agent slugs */
  builtin?: "all" | string[];
};

export const CATEGORIES: { id: IntegrationCategory; label: string }[] = [
  { id: "chains", label: "Chains" },
  { id: "trading", label: "Trading / DEX" },
  { id: "prediction", label: "Prediction markets" },
  { id: "data", label: "Data" },
];

export const STATUS_LABEL: Record<IntegrationStatus, string> = {
  devnet: "Live on devnet",
  live: "Live on testnet",
  testnet: "Testnet wallet",
  needskey: "Needs API key",
  market: "Market data",
  soon: "Coming soon",
};

export const INTEGRATIONS: IntegrationInfo[] = [
  {
    id: "solana", name: "Solana", category: "chains", status: "devnet", addable: true, moves: true, chains: ["Solana"],
    blurb: "Agent wallets, balances and transfers on Solana.",
    about: "Your agents use their own Solana wallets: check what they hold and send test USDC or SOL to an address you approve. Every transfer waits for your Confirm in chat.",
    can: [{ text: "Read its wallet address and balances", live: true }, { text: "Send test USDC or SOL on devnet, after you confirm", live: true }, { text: "Mainnet transfers", live: false }],
    tags: "sol wallet transfer send usdc devnet",
  },
  {
    id: "orca", name: "Orca", category: "trading", status: "devnet", addable: true, moves: true, chains: ["Solana"],
    blurb: "Swap SOL and USDC on Orca Whirlpools.",
    about: "Live quotes from Orca's SOL / USDC pool, and real swaps on Solana devnet from the agent's own wallet. You see the price and the minimum you get before you confirm.",
    can: [{ text: "Live swap quotes", live: true }, { text: "Swap SOL and test USDC on devnet, after you confirm", live: true }, { text: "Mainnet swaps", live: false }],
    tags: "swap dex whirlpool amm sol usdc trade",
  },
  {
    id: "jupiter", name: "Jupiter", category: "trading", status: "market", addable: true, moves: false, chains: ["Solana"],
    blurb: "Best-route swap quotes for any Solana token.",
    about: "Your agents pull live Jupiter quotes from Solana mainnet as a price reference, for memecoins and blue chips alike. Read only: nothing is swapped.",
    can: [{ text: "Live mainnet quotes and routes", live: true }, { text: "Swaps", live: false }],
    tags: "aggregator quote route memecoin bonk wif jup price",
  },
  {
    id: "bridge", name: "Cross-chain", category: "trading", status: "market", addable: true, moves: false, chains: ["Solana", "Ethereum", "Base", "Arbitrum", "Bitcoin", "+ more"],
    blurb: "Quotes for moving tokens between chains.",
    about: "Your agents get live LI.FI quotes for moving a token from one chain to another (Solana, Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Avalanche, Bitcoin): what you'd receive, the route, fees and time. Read only: nothing is bridged.",
    can: [{ text: "Live cross-chain quotes and routes", live: true }, { text: "Bridging", live: false }],
    tags: "bridge cross-chain lifi li.fi across wormhole debridge thorchain btc eth base arbitrum",
  },
  {
    id: "polymarket", name: "Polymarket", category: "prediction", status: "market", addable: true, moves: false, chains: ["Polygon"],
    blurb: "Trending prediction markets and live odds.",
    about: "Your agents search Polymarket and bring live markets and odds into chat. Read only: no bets are placed.",
    can: [{ text: "Trending markets and search", live: true }, { text: "Live odds and volume", live: true }, { text: "Placing orders", live: false }],
    tags: "prediction betting odds election sports crypto markets",
  },
  {
    id: "base", name: "Base", category: "chains", status: "testnet", addable: true, moves: false, chains: ["Base Sepolia"],
    blurb: "Agent wallets on Base Sepolia.",
    about: "Each agent gets its own address on Base. Agents read their Base Sepolia balances and live ETH prices. Swaps and transfers on Base are coming soon.",
    can: [{ text: "Its Base Sepolia address and balances", live: true }, { text: "Live ETH price", live: true }, { text: "Swaps and transfers", live: false }],
    tags: "evm l2 coinbase eth sepolia",
  },
  {
    id: "ethereum", name: "Ethereum", category: "chains", status: "testnet", addable: true, moves: false, chains: ["Sepolia"],
    blurb: "Agent wallets on Ethereum Sepolia.",
    about: "Each agent gets its own Ethereum address. Agents read their Sepolia balances and live ETH prices. Swaps and transfers on Ethereum are coming soon.",
    can: [{ text: "Its Sepolia address and balances", live: true }, { text: "Live ETH price", live: true }, { text: "Swaps and transfers", live: false }],
    tags: "evm eth mainnet sepolia",
  },
  {
    id: "prices", name: "Market prices", category: "data", status: "market", addable: true, moves: false, chains: ["Any"],
    blurb: "Live USD prices for major crypto assets.",
    about: "Your agents check live USD spot prices for assets like BTC, ETH and SOL before they answer. Read only.",
    can: [{ text: "Live spot prices in USD", live: true }],
    tags: "price btc eth sol data feed spot",
  },
  {
    id: "tempo", name: "Tempo", category: "chains", status: "live", addable: true, moves: true, chains: ["Tempo Moderato testnet"],
    blurb: "Stablecoin wallet, sends and top-ups on Tempo testnet.",
    about: "Each agent gets its own Tempo address. Agents read their pathUSD and AlphaUSD balances, get test stablecoins from the Tempo faucet, send to an address you approve and top up your Lexari balance from their Tempo wallet. Fees are paid in the stablecoin itself. Every send waits for your Confirm.",
    can: [{ text: "Its Tempo address and stablecoin balances", live: true }, { text: "Test stablecoins from the faucet", live: true }, { text: "Send pathUSD or AlphaUSD, after you confirm", live: true }, { text: "Top up your Lexari balance from its Tempo wallet", live: true }, { text: "Mainnet", live: false }],
    tags: "stablecoin payments stripe pathusd alphausd tip20 moderato",
  },
  {
    id: "panta", name: "Panta", category: "prediction", status: process.env.NEXT_PUBLIC_PANTA_READY === "1" ? "devnet" : "needskey", addable: true, moves: true, chains: ["Solana"],
    blurb: "Prediction markets on Solana: research and YES / NO positions.",
    about: "Your agents browse Panta markets, read live YES / NO prices and get real quotes. On devnet a position you confirm is recorded as a paper position at Panta's real quote (Panta settles in mainnet USDC, so no money moves yet).",
    can: [{ text: "Browse markets and live YES / NO prices", live: true }, { text: "Real quotes for a position", live: true }, { text: "Paper positions on devnet, after you confirm", live: true }, { text: "Real positions and claims (mainnet)", live: false }],
    tags: "prediction betting odds yes no markets panta usdc",
  },
  {
    id: "solami", name: "Solami", category: "data", status: "soon", addable: false, moves: false, chains: ["Solana mainnet"],
    blurb: "Live Solana data and Beam transaction landing.",
    about: "Solami's RPC, webhooks and Beam power wallet history, incoming transfers and faster transaction landing. Solami serves Solana mainnet, so it switches on with Lexari mainnet.",
    can: [{ text: "Incoming transfers by webhook", live: false }, { text: "Transactions landed through Beam", live: false }],
    tags: "rpc data webhooks beam mainnet solami",
  },
  {
    id: "payments", name: "Agent payments", category: "data", status: "devnet", addable: false, moves: true, chains: ["Solana"], builtin: "all",
    blurb: "Agents pay x402 services and other agents within their budget.",
    about: "Agents pay per request for x402 services and hire other agents per task, in test USDC from their own wallet. Inside the agent's budget it pays on its own; anything over asks you first.",
    can: [{ text: "Pay x402 services in devnet USDC", live: true }, { text: "Hire another agent per task", live: true }],
    tags: "x402 pay budget agent hire",
  },
  {
    id: "ore", name: "ORE mining", category: "data", status: "devnet", addable: false, moves: false, chains: ["Your server"], builtin: ["ore"],
    blurb: "The ORE Miner runs a miner on a server you own.",
    about: "Connect your own server with a one-line install. The ORE Miner installs, starts, stops and watches the miner there. Nothing mines on Lexari's machines.",
    can: [{ text: "Install, start, stop and monitor on your server", live: true }, { text: "ORE rewards (mainnet)", live: false }],
    tags: "ore mining miner server",
  },
];

export const integrationById = (id: string) => INTEGRATIONS.find((i) => i.id === id);

/** Limits for integrations that move money, in whole dollars and basis points. Enforced on the server. */
export const LIMITS = {
  perTx: { min: 1, max: 25, def: 5 },
  daily: { min: 1, max: 100, def: 20 },
  slippageBps: { min: 10, max: 500, def: 100 },
} as const;

export type ActionStatus = "done" | "prepared" | "rejected" | "cancelled" | "expired" | "submitting" | "submitted" | "confirmed" | "failed";

/** A confirm card in chat: something an agent prepared with an integration that only you can approve. */
export type ActionCard = {
  id: string;
  connector: IntegrationId;
  tool: string;
  agent: string;
  title: string;
  /** label / value rows */
  rows: [string, string][];
  usd: number;
  network: string;
  status: ActionStatus;
  sig?: string;
  explorer?: string;
  error?: string;
  note?: string;
};

/** Live markets an agent pulled into chat. */
export type MarketItem = { title: string; url: string; volume24h: number; ends?: string; outcomes: { label: string; pct: number }[] };
export type MarketsCard = { source: "polymarket"; query: string; items: MarketItem[]; at: number };

/** One row of an integration's recent activity. */
export type ActivityRow = { id: string; tool: string; agent: string; status: ActionStatus; usd: number; title: string; sig?: string; explorer?: string; error?: string; at: number };

/** An integration you added, as the API returns it. */
export type AddedIntegration = {
  id: string;
  connector: IntegrationId;
  enabled: boolean;
  agents: string[];
  perTxUsd: number;
  dailyUsd: number;
  maxSlippageBps: number;
  spentTodayUsd: number;
  addresses: { agent: string; chain: string; address: string; explorer: string }[];
  activity: ActivityRow[];
  at: number;
};
