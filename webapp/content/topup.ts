/**
 * Top up: every coin and chain the Lexari balance accepts, in ONE place. The Top up sheet, the price lookup, the
 * deposit addresses and the server-side crediting all read this file, so adding a coin or a chain is one entry here.
 *
 * The Lexari balance is in US dollars. Whatever you send is valued at a live MAINNET price (Coinbase spot for majors,
 * Jupiter for Solana tokens; stablecoins at $1) at the moment the deposit is confirmed (deposits) or when the payment
 * is created (Solana wallet payments, price locked for 30 minutes), and credited once.
 *
 * TESTNET BUILD. Everything below points at testnets / devnet. Mainnet values are listed in comments where known, and
 * the mainnet switch replaces this table (see "MAINNET" notes). Verified on chain Oct 9 2026 (symbol + decimals read
 * from each contract): Sepolia USDC/USDT, Base Sepolia USDC, Arbitrum Sepolia USDC, BNB testnet USDC/USDT, Tron Nile
 * USDT, Tempo Moderato pathUSD/AlphaUSD. Solana test mints (SKR, ORE, USDT, BONK, JUP) were created by Lexari on devnet,
 * mint authority = the Lexari devnet faucet; they are NOT the real tokens and are always labelled "test".
 *
 * Two ways to pay:
 *  - "wallet": Solana. Paid from your Lexari Solana wallet in one tap (or any wallet through a Solana Pay link). The
 *    transfer carries a one-time reference key; the server finds it on chain and checks mint, decimals, amount,
 *    recipient (the treasury), time window and that the signature was never used before, then credits.
 *  - "deposit": every other chain. You get your own deposit address on that network (XRP: the Lexari address plus
 *    your personal destination tag). The server reads the address's CONFIRMED balance (at `confirmations` depth) and
 *    credits only the increase since the last credit, once, under a per-person lock. Amounts under `min` wait until
 *    the total reaches the minimum. XRP payments are credited per transaction hash, only with your tag.
 *
 * Wrong network protection: each option names its network in the sheet ("Send only USDT on Tron Nile testnet") and
 * the deposit address format is per family, so most wrong-chain sends are rejected by the sending wallet. EVM chains
 * share one address format: a token sent on an EVM chain we don't list for it is not credited (we only read the
 * chains and contracts in this table), so the sheet says which network in bold above the address.
 */

export type ChainId =
  | "solana" | "ethereum" | "base" | "arbitrum" | "bnb" | "tempo" | "bitcoin" | "litecoin" | "tron" | "xrpl" | "dogecoin";
export type Family = "solana" | "evm" | "btc" | "tron" | "xrpl";

export type ChainInfo = {
  id: ChainId;
  name: string;
  /** the exact network, shown on every warning */
  network: string;
  family: Family;
  /** EVM chain id */
  chainId?: number;
  /** blocks (or validated ledgers) a deposit must be under before it is credited */
  confirmations: number;
  /** rough time to credit, for the sheet */
  eta: string;
  explorerAddress: (a: string) => string;
  /** false: listed, not open on testnet */
  live: boolean;
  why?: string;
};

export const CHAINS: Record<ChainId, ChainInfo> = {
  solana: { id: "solana", name: "Solana", network: "Solana devnet", family: "solana", confirmations: 1, eta: "a few seconds", live: true, explorerAddress: (a) => `https://explorer.solana.com/address/${a}?cluster=devnet` },
  // MAINNET: chainId 1, 12+ confirmations
  ethereum: { id: "ethereum", name: "Ethereum", network: "Ethereum Sepolia testnet", family: "evm", chainId: 11155111, confirmations: 3, eta: "about 1 minute", live: true, explorerAddress: (a) => `https://sepolia.etherscan.io/address/${a}` },
  // MAINNET: chainId 8453
  base: { id: "base", name: "Base", network: "Base Sepolia testnet", family: "evm", chainId: 84532, confirmations: 10, eta: "about 30 seconds", live: true, explorerAddress: (a) => `https://sepolia.basescan.org/address/${a}` },
  // MAINNET: chainId 42161
  arbitrum: { id: "arbitrum", name: "Arbitrum", network: "Arbitrum Sepolia testnet", family: "evm", chainId: 421614, confirmations: 20, eta: "about 30 seconds", live: true, explorerAddress: (a) => `https://sepolia.arbiscan.io/address/${a}` },
  // MAINNET: chainId 56
  bnb: { id: "bnb", name: "BNB Chain", network: "BNB Smart Chain testnet", family: "evm", chainId: 97, confirmations: 15, eta: "about 1 minute", live: true, explorerAddress: (a) => `https://testnet.bscscan.com/address/${a}` },
  // MAINNET: chainId 4217, rpc.tempo.xyz. Tempo has deterministic finality, so one block is final.
  tempo: { id: "tempo", name: "Tempo", network: "Tempo Moderato testnet", family: "evm", chainId: 42431, confirmations: 1, eta: "a few seconds", live: true, explorerAddress: (a) => `https://explore.testnet.tempo.xyz/address/${a}` },
  // MAINNET: bc1 addresses, 2 confirmations
  bitcoin: { id: "bitcoin", name: "Bitcoin", network: "Bitcoin testnet4", family: "btc", confirmations: 1, eta: "about 10 minutes", live: true, explorerAddress: (a) => `https://mempool.space/testnet4/address/${a}` },
  // MAINNET: ltc1 addresses, 6 confirmations
  litecoin: { id: "litecoin", name: "Litecoin", network: "Litecoin testnet", family: "btc", confirmations: 3, eta: "about 8 minutes", live: true, explorerAddress: (a) => `https://litecoinspace.org/testnet/address/${a}` },
  // MAINNET: api.trongrid.io; Nile credits from the solidified (irreversible) state
  tron: { id: "tron", name: "Tron", network: "Tron Nile testnet", family: "tron", confirmations: 19, eta: "about 1 minute", live: true, explorerAddress: (a) => `https://nile.tronscan.org/#/address/${a}` },
  // MAINNET: same flow on xrplcluster.com, validated ledgers only
  xrpl: { id: "xrpl", name: "XRP Ledger", network: "XRP Ledger testnet", family: "xrpl", confirmations: 1, eta: "a few seconds", live: true, explorerAddress: (a) => `https://testnet.xrpl.org/accounts/${a}` },
  dogecoin: { id: "dogecoin", name: "Dogecoin", network: "Dogecoin mainnet", family: "btc", confirmations: 6, eta: "about 6 minutes", live: false, why: "Dogecoin has no public testnet indexer, so it opens with mainnet.", explorerAddress: (a) => `https://dogechain.info/address/${a}` },
};

export type CoinId = "SOL" | "USDC" | "USDT" | "SKR" | "ORE" | "BTC" | "ETH" | "BNB" | "XRP" | "TRX" | "LTC" | "DOGE" | "BONK" | "JUP" | "PATHUSD" | "ALPHAUSD";

/** One coin on one chain. `token` is the mint / contract (absent for the chain's own coin). */
export type Rail = {
  coin: CoinId;
  chain: ChainId;
  token?: string;
  decimals: number;
  /** smallest deposit credited, in whole coins */
  min: number;
  /** the coin on this chain is a Lexari devnet/testnet stand-in, not the real asset */
  test: boolean;
  /** XRP: pay to the Lexari address with your destination tag */
  tag?: boolean;
  live: boolean;
  why?: string;
};

export type CoinInfo = {
  id: CoinId;
  symbol: string;
  name: string;
  /** stablecoins are valued at $1 */
  stable?: boolean;
  /** how the live price is looked up: a Coinbase spot symbol, or a Solana MAINNET mint on Jupiter */
  price: { coinbase: string } | { jupiter: string } | { usd: 1 };
  color: string;
  /** search words */
  tags: string;
};

export const COINS: CoinInfo[] = [
  { id: "SOL", symbol: "SOL", name: "Solana", price: { coinbase: "SOL" }, color: "#9945FF", tags: "solana sol" },
  { id: "USDC", symbol: "USDC", name: "USD Coin", stable: true, price: { usd: 1 }, color: "#2775CA", tags: "usdc circle dollar stablecoin" },
  { id: "USDT", symbol: "USDT", name: "Tether", stable: true, price: { usd: 1 }, color: "#26A17B", tags: "usdt tether dollar stablecoin trc20 erc20 bep20" },
  { id: "SKR", symbol: "SKR", name: "Seeker", price: { jupiter: "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3" }, color: "#14F1D9", tags: "skr seeker solana mobile saga" },
  { id: "ORE", symbol: "ORE", name: "ORE", price: { jupiter: "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp" }, color: "#F5A524", tags: "ore mining regolith" },
  { id: "BTC", symbol: "BTC", name: "Bitcoin", price: { coinbase: "BTC" }, color: "#F7931A", tags: "btc bitcoin sats" },
  { id: "ETH", symbol: "ETH", name: "Ethereum", price: { coinbase: "ETH" }, color: "#627EEA", tags: "eth ether ethereum base arbitrum l2" },
  { id: "BNB", symbol: "BNB", name: "BNB", price: { coinbase: "BNB" }, color: "#F3BA2F", tags: "bnb binance bsc" },
  { id: "XRP", symbol: "XRP", name: "XRP", price: { coinbase: "XRP" }, color: "#23292F", tags: "xrp ripple xrpl" },
  { id: "TRX", symbol: "TRX", name: "Tron", price: { coinbase: "TRX" }, color: "#EB0029", tags: "trx tron" },
  { id: "LTC", symbol: "LTC", name: "Litecoin", price: { coinbase: "LTC" }, color: "#345D9D", tags: "ltc litecoin" },
  { id: "DOGE", symbol: "DOGE", name: "Dogecoin", price: { coinbase: "DOGE" }, color: "#C2A633", tags: "doge dogecoin" },
  { id: "BONK", symbol: "BONK", name: "Bonk", price: { jupiter: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" }, color: "#F8A21B", tags: "bonk meme solana" },
  { id: "JUP", symbol: "JUP", name: "Jupiter", price: { jupiter: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" }, color: "#2BB8A2", tags: "jup jupiter solana" },
  { id: "PATHUSD", symbol: "pathUSD", name: "pathUSD", stable: true, price: { usd: 1 }, color: "#111111", tags: "pathusd tempo stablecoin stripe" },
  { id: "ALPHAUSD", symbol: "AlphaUSD", name: "AlphaUSD", stable: true, price: { usd: 1 }, color: "#4B5563", tags: "alphausd tempo stablecoin test" },
];

const SOL_DEVNET_TEST = {
  SKR: "ExGnANupZkiSRMDQXiTY9JEwPZa33m8ZfA5kKDuf3n68",
  ORE: "GzWiT2UiYA4hiTnkJYseNMcwXdF2sacf3drgthCHMoBD",
  USDT: "GDaRV9vPQDx5y1mv63dFRy1o4DDqqgUQ8YTmYAi3RwzA",
  BONK: "A6nbYVCNVLUpxM4aoUsyosvuc76rv8zt5czKqQqaWet2",
  JUP: "9usZhiH2wUJTRVs29E237efb682c2YvtZN7ZT9o7MPY1",
} as const;
/** Circle's devnet USDC (the same mint the rest of Lexari uses, NEXT_PUBLIC_USDC_MINT). MAINNET: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v */
export const SOLANA_DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

/** Every coin per chain, in the order the chain picker shows them. */
export const RAILS: Rail[] = [
  // Solana (wallet payments)
  { coin: "SOL", chain: "solana", decimals: 9, min: 0.005, test: false, live: true },
  { coin: "USDC", chain: "solana", token: SOLANA_DEVNET_USDC, decimals: 6, min: 1, test: false, live: true },
  { coin: "USDT", chain: "solana", token: SOL_DEVNET_TEST.USDT, decimals: 6, min: 1, test: true, live: true }, // MAINNET: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
  { coin: "SKR", chain: "solana", token: SOL_DEVNET_TEST.SKR, decimals: 6, min: 20, test: true, live: true }, // MAINNET: SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3
  { coin: "ORE", chain: "solana", token: SOL_DEVNET_TEST.ORE, decimals: 11, min: 0.005, test: true, live: true }, // MAINNET: oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp
  { coin: "BONK", chain: "solana", token: SOL_DEVNET_TEST.BONK, decimals: 5, min: 20_000, test: true, live: true },
  { coin: "JUP", chain: "solana", token: SOL_DEVNET_TEST.JUP, decimals: 6, min: 1, test: true, live: true },
  // Stablecoins on other chains
  { coin: "USDC", chain: "ethereum", token: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6, min: 1, test: false, live: true }, // Circle Sepolia. MAINNET: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  { coin: "USDC", chain: "base", token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6, min: 1, test: false, live: true }, // Circle Base Sepolia. MAINNET: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  { coin: "USDC", chain: "arbitrum", token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", decimals: 6, min: 1, test: false, live: true }, // Circle Arbitrum Sepolia. MAINNET: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
  { coin: "USDC", chain: "bnb", token: "0x64544969ed7EBf5f083679233325356EbE738930", decimals: 18, min: 1, test: true, live: true }, // BSC testnet USDC (18 decimals). MAINNET: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d (18)
  { coin: "USDT", chain: "ethereum", token: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", decimals: 6, min: 1, test: true, live: true }, // Aave Sepolia faucet USDT. MAINNET: 0xdAC17F958D2ee523a2206206994597C13D831ec7
  { coin: "USDT", chain: "tron", token: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", decimals: 6, min: 1, test: true, live: true }, // Nile USDT. MAINNET: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
  { coin: "USDT", chain: "bnb", token: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", decimals: 18, min: 1, test: true, live: true }, // BSC testnet USDT (18 decimals). MAINNET: 0x55d398326f99059fF775485246999027B3197955 (18)
  { coin: "USDT", chain: "base", decimals: 6, min: 1, test: false, live: false, why: "There is no USDT on Base Sepolia. It opens with mainnet." },
  { coin: "USDT", chain: "arbitrum", decimals: 6, min: 1, test: false, live: false, why: "There is no USDT on Arbitrum Sepolia. It opens with mainnet." },
  { coin: "PATHUSD", chain: "tempo", token: "0x20c0000000000000000000000000000000000000", decimals: 6, min: 1, test: true, live: true },
  { coin: "ALPHAUSD", chain: "tempo", token: "0x20c0000000000000000000000000000000000001", decimals: 6, min: 1, test: true, live: true },
  // Native coins
  { coin: "BTC", chain: "bitcoin", decimals: 8, min: 0.00002, test: true, live: true },
  { coin: "ETH", chain: "ethereum", decimals: 18, min: 0.0005, test: true, live: true },
  { coin: "ETH", chain: "base", decimals: 18, min: 0.0005, test: true, live: true },
  { coin: "ETH", chain: "arbitrum", decimals: 18, min: 0.0005, test: true, live: true },
  { coin: "BNB", chain: "bnb", decimals: 18, min: 0.002, test: true, live: true },
  { coin: "XRP", chain: "xrpl", decimals: 6, min: 1, test: true, tag: true, live: true },
  { coin: "TRX", chain: "tron", decimals: 6, min: 5, test: true, live: true },
  { coin: "LTC", chain: "litecoin", decimals: 8, min: 0.01, test: true, live: true },
  { coin: "DOGE", chain: "dogecoin", decimals: 8, min: 10, test: false, live: false, why: "Dogecoin has no public testnet indexer, so it opens with mainnet." },
];

export const railId = (r: Pick<Rail, "coin" | "chain">) => `${r.coin}:${r.chain}`;
export const railById = (id: string) => RAILS.find((r) => railId(r) === id);
export const coinById = (id: string) => COINS.find((c) => c.id === id);
export const railsFor = (coin: CoinId) => RAILS.filter((r) => r.coin === coin);
export const payKind = (r: Rail): "wallet" | "deposit" => (r.chain === "solana" ? "wallet" : "deposit");
/** What the sheet calls it: "USDT on Tron", "test SKR on Solana devnet". */
export const railLabel = (r: Rail) => `${r.test ? "test " : ""}${coinById(r.coin)?.symbol || r.coin} on ${CHAINS[r.chain].name}`;
/** Display decimals for an amount of this coin. */
export const coinDigits = (r: Pick<Rail, "decimals" | "coin">) => (coinById(r.coin)?.stable ? 2 : Math.min(r.decimals, 8));

/** Testnet deposits credit real AI usage, so they're capped per person per day. MAINNET: remove. */
export const TESTNET_TOPUP_DAILY_USD = 50;
