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
import { IS_MAINNET, IS_TESTNET, SPEND_LIMITS } from "@/lib/network";

export type IntegrationId = "solana" | "orca" | "jupiter" | "bridge" | "polymarket" | "panta" | "base" | "ethereum" | "tempo" | "prices" | "payments" | "ore" | "solami" | "hyperliquid" | "self" | "monad" | "nansen" | "kuru" | "intents" | "mera" | "agora" | "alchemy" | "skr" | "arbitrum" | "robinhood" | "zcash" | "uniswap";
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
  devnet: IS_MAINNET ? "Live" : "Live on devnet",
  live: IS_MAINNET ? "Live" : "Live on testnet",
  testnet: "Testnet wallet",
  needskey: "Setup needed",
  market: "Market data",
  soon: "Coming soon",
};

const ALL_INTEGRATIONS: IntegrationInfo[] = [
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
    id: "polymarket", name: "Polymarket", category: "prediction", status: "market", addable: true, moves: true, chains: ["Polygon"],
    blurb: "Live prediction markets, odds and order book prices.",
    about: "Your agents search Polymarket, read live odds and each outcome's order book price. Polymarket only trades with real USDC on Polygon (there is no test order book), so placing orders stays off until it's switched on for your account. When it is on, every order waits for your Confirm inside your per-trade and daily limits.",
    can: [{ text: "Trending markets and search", live: true }, { text: "Live odds and order book prices", live: true }, { text: "Buy an outcome on Polygon mainnet, after you confirm", live: process.env.NEXT_PUBLIC_POLYMARKET_LIVE === "1" }],
    tags: "prediction betting odds election sports crypto markets clob order polygon",
  },
  {
    id: "base", name: "Base", category: "chains", status: "live", addable: true, moves: true, chains: ["Base Sepolia"],
    blurb: "Agent wallet and sends on Base Sepolia.",
    about: "Each agent has its own address on Base. Agents read their Base Sepolia ETH and test USDC and send to an address you approve. Every send waits for your Confirm. Test funds only.",
    can: [{ text: "Its Base Sepolia address and balances", live: true }, { text: "Send test ETH or USDC, after you confirm", live: true }, { text: "Swaps through Uniswap", live: true }, { text: "Mainnet", live: false }],
    tags: "evm l2 coinbase eth sepolia send transfer",
  },
  {
    id: "ethereum", name: "Ethereum", category: "chains", status: "live", addable: true, moves: true, chains: ["Sepolia"],
    blurb: "Agent wallet and sends on Ethereum Sepolia.",
    about: "Each agent has its own Ethereum address. Agents read their Sepolia ETH and test USDC and send to an address you approve. Every send waits for your Confirm. Test funds only.",
    can: [{ text: "Its Sepolia address and balances", live: true }, { text: "Send test ETH or USDC, after you confirm", live: true }, { text: "Swaps through Uniswap", live: true }, { text: "Mainnet", live: false }],
    tags: "evm eth l1 mainnet sepolia send transfer",
  },
  {
    id: "arbitrum", name: "Arbitrum", category: "chains", status: "live", addable: true, moves: true, chains: ["Arbitrum Sepolia"],
    blurb: "Agent wallet and sends on Arbitrum Sepolia.",
    about: "Each agent uses its EVM address on Arbitrum Sepolia. Agents read their test ETH and USDC and send to an address you approve. Every send waits for your Confirm. Test funds only.",
    can: [{ text: "Its Arbitrum Sepolia address and balances", live: true }, { text: "Send test ETH or USDC, after you confirm", live: true }, { text: "Swaps through Uniswap", live: true }, { text: "Mainnet", live: false }],
    tags: "arbitrum arb l2 evm rollup sepolia send transfer",
  },
  {
    id: "robinhood", name: "Robinhood Chain", category: "chains", status: "live", addable: true, moves: true, chains: ["Robinhood Chain testnet"],
    blurb: "Agent wallet and sends on Robinhood Chain testnet.",
    about: "Each agent uses its EVM address on Robinhood Chain testnet (chain 46630). Agents read their test ETH and send to an address you approve. Every send waits for your Confirm. Test funds only.",
    can: [{ text: "Its Robinhood Chain testnet address and ETH balance", live: true }, { text: "Send test ETH, after you confirm", live: true }, { text: "Tokenized stocks", live: false }, { text: "Mainnet", live: false }],
    tags: "robinhood chain evm l2 arbitrum orbit testnet stocks send",
  },
  {
    id: "zcash", name: "Zcash", category: "chains", status: "market", addable: true, moves: true, chains: ["Zcash"],
    blurb: "A Zcash address for your agent and live ZEC quotes.",
    about: "Each agent has its own transparent Zcash address. Agents quote how much ZEC part of your balance buys, delivered straight to that address. Zcash has no test network for this, so buying uses real funds and stays off until it's switched on for your account. When it is on, every buy waits for your Confirm.",
    can: [{ text: "Its own Zcash address", live: true }, { text: "Live ZEC quotes from your balance", live: true }, { text: "Buy ZEC from your balance, after you confirm", live: process.env.NEXT_PUBLIC_ZCASH_LIVE === "1" }, { text: "Send ZEC from its address", live: false }, { text: "Shielded addresses", live: false }],
    tags: "zcash zec privacy transparent t-address intents",
  },
  {
    id: "uniswap", name: "Uniswap", category: "trading", status: "live", addable: true, moves: true, chains: ["Base Sepolia", "Sepolia", "Arbitrum Sepolia"],
    blurb: "Quotes and swaps on Uniswap v3 testnets.",
    about: "Your agents get live Uniswap v3 quotes and swap ETH and test USDC from their own wallet on Base Sepolia, Ethereum Sepolia and Arbitrum Sepolia. You see the price and the minimum you get before you confirm. Testnet pool prices are not market prices.",
    can: [{ text: "Live quotes across pool fee tiers", live: true }, { text: "Swap ETH and test USDC, after you confirm", live: true }, { text: "Mainnet swaps", live: false }],
    tags: "uniswap dex swap amm v3 evm eth usdc base arbitrum sepolia",
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
    can: [{ text: "Pay APIs that charge over MPP (HTTP 402) with the agent card, after you confirm", live: true }, { text: "Its Tempo address and stablecoin balances", live: true }, { text: "Test stablecoins from the faucet", live: true }, { text: "Send pathUSD or AlphaUSD, after you confirm", live: true }, { text: "Top up your Lexari balance from its Tempo wallet", live: true }, { text: "Pay merchants with its Tempo card, inside card limits, after you confirm", live: true }, { text: "MPP machine payments", live: false }, { text: "Mainnet", live: false }],
    tags: "stablecoin payments stripe pathusd alphausd tip20 moderato",
  },
  {
    id: "monad", name: "Monad", category: "chains", status: "live", addable: true, moves: true, chains: ["Monad testnet"],
    blurb: "Agent wallet and sends on Monad testnet.",
    about: "Each agent uses its EVM address on Monad testnet (chain 10143). Agents read their MON balance and send test MON or USDC to an address you approve. Every send waits for your Confirm. Test funds only.",
    can: [{ text: "Its Monad testnet address and MON balance", live: true }, { text: "Send test MON or USDC, after you confirm", live: true }, { text: "Swaps on Kuru", live: true }, { text: "Mainnet", live: false }],
    tags: "monad evm testnet mon send transfer",
  },
  {
    id: "nansen", name: "Nansen", category: "data", status: process.env.NEXT_PUBLIC_NANSEN_READY === "1" ? "live" : "needskey", addable: true, moves: false, chains: ["Ethereum", "Solana", "Base", "Monad"],
    blurb: "Wallet profiles and holdings from Nansen.",
    about: "Your agents look up any wallet on Nansen and read its current holdings in USD before they answer. Read only. Needs a Nansen API key on the server.",
    can: [{ text: "Current holdings of any wallet", live: true }, { text: "Smart money flows, checked before every trade", live: true }],
    tags: "nansen smart money wallet profiler data labels",
  },
  {
    id: "kuru", name: "Kuru", category: "trading", status: process.env.NEXT_PUBLIC_KURU_READY === "1" ? "live" : "needskey", addable: true, moves: true, chains: ["Monad testnet"],
    blurb: "Orderbook quotes and swaps on Monad testnet.",
    about: "Your agents get Kuru routes on Monad testnet and swap from their own Monad wallet. Every swap waits for your Confirm inside your per-trade and slippage limits. Test tokens only.",
    can: [{ text: "Live routes and quotes on Monad testnet", live: true }, { text: "Swaps, after you confirm", live: true }, { text: "Mainnet", live: false }],
    tags: "kuru monad orderbook clob dex swap quote",
  },
  {
    id: "intents", name: "Aurora Intents", category: "trading", status: process.env.NEXT_PUBLIC_INTENTS_READY === "1" ? "live" : "needskey", addable: true, moves: true, chains: ["Any chain"],
    blurb: "Moves your balance to whichever chain a trade needs.",
    about: "Your agent keeps one balance. When a trade or payment needs funds on another chain, it routes them through Aurora Intents (any-chain liquidity, powered by NEAR Intents) in one Confirm card, with refunds back to your balance if it can't fill. Quotes work with an API key; moving real funds is switched on per server.",
    can: [{ text: "Cross-chain quotes to 25+ chains", live: true }, { text: "One Confirm card that routes and delivers", live: true }, { text: "Route status", live: true }],
    tags: "aurora intents near cross chain bridge swap any chain liquidity route",
  },
  {
    id: "mera", name: "Mera", category: "chains", status: "live", addable: false, moves: false, chains: ["Monad", "Solana"],
    blurb: "One passkey, many keys: sign in with Face ID and give every agent its own key.",
    about: "Mera derives keys from a passkey (WebAuthn PRF), with no seed phrase and nothing secret stored. Your passkey signs you in to Lexari and derives a separate EVM key for each agent, so one Face ID or Touch ID covers all of them. Add it in Settings, Security.",
    can: [{ text: "Passkey sign-in", live: true }, { text: "A separate key for each agent from one passkey", live: true }, { text: "Same keys on every device your passkey syncs to", live: true }],
    tags: "mera passkey face id touch id webauthn prf sign in keys monad category labs",
  },
  {
    id: "agora", name: "Agora AUSD", category: "trading", status: "live", addable: true, moves: true, chains: ["Monad testnet"],
    blurb: "Hold and pay in AUSD, including cross-border sends.",
    about: "AUSD is Agora's fiat-backed dollar stablecoin. Your agent holds AUSD in its own Monad wallet, pays people in it, and sends it across borders with the recipient's local amount shown at today's rate. Every payment waits for your Confirm and stays inside your limits. Test AUSD from Agora's faucet.",
    can: [{ text: "AUSD balance", live: true }, { text: "Pay in AUSD, after you confirm", live: true }, { text: "Cross-border sends with the local amount shown", live: true }, { text: "Test AUSD from the Agora faucet", live: true }],
    tags: "agora ausd stablecoin dollar pay payment cross border remittance send monad",
  },
  {
    id: "alchemy", name: "Alchemy", category: "data", status: process.env.NEXT_PUBLIC_ALCHEMY_READY === "1" ? "live" : "needskey", addable: true, moves: false, chains: ["Monad testnet"],
    blurb: "Fast Monad RPC and the Token API for your agent's holdings.",
    about: "Alchemy powers Lexari's Monad connection (RPC) and its Token API: your agent can list every token it or any address holds on Monad, with names and amounts. Read only; it never moves money.",
    can: [{ text: "Monad RPC for every agent", live: true }, { text: "Token balances and metadata", live: true }],
    tags: "alchemy rpc token api balances metadata monad node",
  },
  {
    id: "hyperliquid", name: "Hyperliquid", category: "trading", status: "live", addable: true, moves: true, chains: ["Hyperliquid testnet"],
    blurb: "Perps orders on Hyperliquid testnet with a trade-only API key.",
    about: "Each agent trades from its own Hyperliquid testnet account through an API wallet: a separate key that can place and cancel orders but can never withdraw or move funds. Agents read prices, positions and open orders, and every order waits for your Confirm inside your per-trade and daily limits. Test USDC only.",
    can: [{ text: "Live prices, positions and open orders", live: true }, { text: "Market and limit orders, after you confirm", live: true }, { text: "Trade-only API wallet, no withdrawals", live: true }, { text: "Mainnet", live: false }],
    tags: "hyperliquid perps perpetuals futures hypercore order trade testnet api wallet",
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
    blurb: "Agents pay x402 services and other agents after you confirm.",
    about: "Agents pay per request for x402 services and hire other agents per task, in test USDC from their own wallet. Every payment waits for your Confirm, and the card flags anything over the agent's budget.",
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
  {
    id: "skr", name: "SKR", category: "chains", status: "live", addable: false, moves: false, chains: ["Solana"],
    blurb: "Top up and pay with SKR, the Solana Mobile token.",
    about: "SKR (mint SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3) is a top up coin. Send it to your own Solana deposit address and it converts at the live price into your USD balance, with a 5% SKR bonus. Plans and agent hires can be paid with SKR from the same Confirm sheet. Your balance always shows in dollars.",
    can: [{ text: "Top up your balance with SKR on Solana", live: true }, { text: "Pay for plans and hires with SKR, 5% bonus", live: true }],
    tags: "skr seeker solana mobile saga token",
  },
  {
    id: "self", name: "Its own settings", category: "data", status: "live", addable: false, moves: false, chains: ["Lexari"], builtin: "all",
    blurb: "Agents rename themselves and change their face, tone or model, after you confirm.",
    about: "Ask an agent to change its name, face, persona or model and it shows a Confirm card. Nothing changes until you confirm. Agents can never change their own integrations, limits, wallets or keys.",
    can: [{ text: "Rename, new face, tone and model", live: true }, { text: "Integrations, limits and wallets", live: false }],
    tags: "self rename avatar persona model settings",
  },
];

/**
 * Integrations with a real, wired mainnet path (lib/network.ts). Everything else is hidden on a mainnet build: not in
 * the catalog, not grantable, and its tools are not offered to agents.
 *  - Chains: Solana mainnet-beta; Base 8453, Ethereum 1, Arbitrum One 42161 and Monad 143 with Circle USDC.
 *  - Read-only market data: Jupiter, LI.FI cross-chain quotes, Polymarket, Zcash, market prices, Nansen, Alchemy.
 *  - Aurora Intents (already mainnet), agent payments, SKR, Solami (mainnet only), Mera, and an agent's own settings.
 * Hidden on mainnet: Orca (devnet pools), Uniswap (Sepolia contracts), Robinhood Chain (no public mainnet), Tempo and
 * Hyperliquid (mainnets exist, Lexari's code is only verified on testnet), Agora AUSD and Kuru (testnet contracts),
 * Panta (paper trading on devnet) and ORE practice mining.
 */
export const MAINNET_INTEGRATIONS: ReadonlySet<IntegrationId> = new Set<IntegrationId>([
  "solana", "jupiter", "bridge", "polymarket", "base", "ethereum", "arbitrum", "monad", "zcash", "prices", "nansen",
  "alchemy", "intents", "payments", "skr", "solami", "mera", "self",
]);
/** True when this integration exists in this build's network mode. */
export const availableOnNetwork = (id: IntegrationId) => IS_TESTNET || MAINNET_INTEGRATIONS.has(id);

/** Mainnet wording for integrations whose testnet copy talks about test funds. */
const MAINNET_COPY: Partial<Record<IntegrationId, Partial<IntegrationInfo>>> = {
  solana: {
    status: "live", blurb: "Agent wallets, balances and transfers on Solana.", tags: "sol wallet transfer send usdc mainnet",
    about: "Your agents use their own Solana wallets: check what they hold and send USDC or SOL to an address you approve. Every transfer waits for your Confirm in chat, inside your per trade and daily limits. Real funds.",
    can: [{ text: "Read its wallet address and balances", live: true }, { text: "Send USDC or SOL, after you confirm", live: true }],
  },
  base: {
    chains: ["Base"], blurb: "Agent wallet and sends on Base.", tags: "evm base base usdc send transfer",
    about: "Each agent has its own address on Base. Agents read their balances and send ETH or USDC to an address you approve. Every send waits for your Confirm, inside your per trade and daily limits. Real funds.",
    can: [{ text: "Its Base address and balances", live: true }, { text: "Send ETH or USDC, after you confirm", live: true }],
  },
  ethereum: {
    chains: ["Ethereum"], blurb: "Agent wallet and sends on Ethereum.", tags: "evm ethereum ethereum usdc send transfer",
    about: "Each agent has its own address on Ethereum. Agents read their balances and send ETH or USDC to an address you approve. Every send waits for your Confirm, inside your per trade and daily limits. Real funds.",
    can: [{ text: "Its Ethereum address and balances", live: true }, { text: "Send ETH or USDC, after you confirm", live: true }],
  },
  arbitrum: {
    chains: ["Arbitrum One"], blurb: "Agent wallet and sends on Arbitrum One.", tags: "evm arbitrum arbitrum usdc send transfer",
    about: "Each agent has its own address on Arbitrum One. Agents read their balances and send ETH or USDC to an address you approve. Every send waits for your Confirm, inside your per trade and daily limits. Real funds.",
    can: [{ text: "Its Arbitrum One address and balances", live: true }, { text: "Send ETH or USDC, after you confirm", live: true }],
  },
  monad: {
    chains: ["Monad"], blurb: "Agent wallet and sends on Monad.", tags: "evm monad monad usdc send transfer",
    about: "Each agent has its own address on Monad. Agents read their balances and send MON or USDC to an address you approve. Every send waits for your Confirm, inside your per trade and daily limits. Real funds.",
    can: [{ text: "Its Monad address and balances", live: true }, { text: "Send MON or USDC, after you confirm", live: true }],
  },
  alchemy: { chains: ["Monad"] },
  payments: {
    status: "live",
    about: "Agents pay per request for x402 services and hire other agents per task, in USDC from their own wallet. Every payment waits for your Confirm, and the card flags anything over the agent's budget.",
    can: [{ text: "Pay x402 services in USDC", live: true }, { text: "Hire another agent per task", live: true }],
  },
};

/** The catalog for this build's network mode. */
export const INTEGRATIONS: IntegrationInfo[] = ALL_INTEGRATIONS.filter((i) => availableOnNetwork(i.id)).map((i) => (IS_MAINNET ? { ...i, ...MAINNET_COPY[i.id] } : i));

export const integrationById = (id: string) => INTEGRATIONS.find((i) => i.id === id);

/** Limits for integrations that move money, in whole dollars and basis points. Enforced on the server. */
/** Per-trade, daily and slippage limits for grants and Confirm cards. Lower on mainnet (lib/network.ts). */
export const LIMITS = SPEND_LIMITS;

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
  /** what you allowed in the consent popup */
  scopes: Scope[];
  /** when the grant stops on its own (ms); null for grants made before expiry existed */
  expiresAt: number | null;
  addresses: { agent: string; chain: string; address: string; explorer: string }[];
  activity: ActivityRow[];
  at: number;
};

/**
 * What an agent may do with an integration, asked for up front in the consent popup. "read" is always part of a
 * grant. "withdraw" sends only to wallets you linked in Settings > Wallets; "transfer" may send to any address.
 */
export type Scope = "read" | "trade" | "bet" | "withdraw" | "transfer";
export const SCOPE_INFO: Record<Scope, { title: string; body: string; risky?: boolean }> = {
  read: { title: "See balances and prices", body: "Read its wallet, positions and live market data. Nothing moves." },
  trade: { title: "Trade", body: "Swap or place orders from its own wallet, inside your limits, after you confirm." },
  bet: { title: "Take positions", body: "Open prediction market positions, inside your limits, after you confirm." },
  withdraw: { title: "Send to your linked wallets", body: "Move funds back to a wallet you linked in Settings > Wallets. Nowhere else." },
  transfer: { title: "Send to any address", body: "Pay an address you name in chat, after you confirm. Leave this off unless you need it.", risky: true },
};
const SCOPES: Partial<Record<IntegrationId, Scope[]>> = {
  solana: ["read", "withdraw", "transfer"],
  orca: ["read", "trade"],
  tempo: ["read", "trade", "withdraw", "transfer"],
  hyperliquid: ["read", "trade"],
  kuru: ["read", "trade"],
  agora: ["read", "transfer"],
  intents: ["read", "trade"],
  panta: ["read", "bet"],
  base: ["read", "withdraw", "transfer"],
  ethereum: ["read", "withdraw", "transfer"],
  arbitrum: ["read", "withdraw", "transfer"],
  robinhood: ["read", "withdraw", "transfer"],
  monad: ["read", "withdraw", "transfer"],
  uniswap: ["read", "trade"],
  polymarket: ["read", "bet"],
  zcash: ["read", "trade"],
};
/** The scopes an integration can ask for. */
export const scopesOf = (id: string): Scope[] => SCOPES[id as IntegrationId] ?? ["read"];
/** Asked for by default: everything except sending to any address. */
export const defaultScopes = (id: string): Scope[] => scopesOf(id).filter((s) => s !== "transfer");
/** The scope a tool needs. Transfers need "withdraw" when the address is one of your linked wallets, "transfer" otherwise. */
export function scopeOfTool(tool: string, risk: "read" | "sign"): Scope {
  if (risk === "read") return "read";
  if (/\.transfer$/.test(tool)) return "transfer";
  if (tool === "panta.position" || tool === "polymarket.order") return "bet";
  if (tool.startsWith("ausd.")) return "transfer";
  return "trade";
}
/** How long a grant lasts. */
export const EXPIRY_DAYS = [1, 7, 30, 90] as const;
export const DEFAULT_EXPIRY_DAYS = 30;

/** One line of the audit log: a grant change you made, or something an agent did (or was stopped from doing). */
export type AuditRow = {
  id: string;
  connector: IntegrationId;
  at: number;
  /** consent | change | revoke | expire | remove | read | confirmed | rejected | denied | cancelled | pending | failed */
  kind: string;
  title: string;
  agent?: string;
  usd?: number;
  detail?: string;
  explorer?: string;
};
