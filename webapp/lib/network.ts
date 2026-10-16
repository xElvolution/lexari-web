/**
 * Network mode: one codebase, two fully separate deployments.
 *
 *   LEXARI_NETWORK=testnet  testnet.lexari.ai  Solana devnet, Monad testnet 10143, Base/Ethereum/Arbitrum Sepolia ...
 *   LEXARI_NETWORK=mainnet  app.lexari.ai      Solana mainnet-beta, Monad 143, Base 8453, Ethereum 1, Arbitrum 42161
 *
 * The mode is fixed at build time (next.config.ts copies LEXARI_NETWORK into NEXT_PUBLIC_LEXARI_NETWORK so the
 * browser bundle and the server agree) and every chain id, RPC default, token address and explorer below is picked
 * from it. Nothing reads "the other" table at runtime, so a mainnet build cannot reach a testnet chain and the
 * reverse. Each mode also needs its own DATABASE_URL and its own secrets (see docs/MAINNET.md); server/network.ts
 * refuses to start against a database stamped for the other mode.
 *
 * Isomorphic: safe to import from client components and server code.
 */
export type NetworkMode = "mainnet" | "testnet";

function readMode(): NetworkMode {
  const raw = (process.env.NEXT_PUBLIC_LEXARI_NETWORK || process.env.LEXARI_NETWORK || "testnet").trim().toLowerCase();
  if (raw !== "mainnet" && raw !== "testnet") throw new Error(`LEXARI_NETWORK must be "mainnet" or "testnet" (got "${raw}").`);
  return raw;
}

export const NETWORK: NetworkMode = readMode();
export const IS_MAINNET = NETWORK === "mainnet";
export const IS_TESTNET = !IS_MAINNET;

/** Solana cluster for this mode. */
export const SOLANA_CLUSTER_FOR_MODE: "mainnet-beta" | "devnet" = IS_MAINNET ? "mainnet-beta" : "devnet";

export type EvmNet = {
  /** shown on every warning: "Base Sepolia" / "Base" */
  network: string;
  chainId: number;
  /** env var that overrides the public RPC */
  rpcEnv: string;
  /** Alchemy subdomain when ALCHEMY_API_KEY is set */
  alchemy?: string;
  publicRpc: string;
  /** Circle USDC on this chain ("" when there is none) */
  usdc: string;
  explorer: string;
  /** false: no usable network in this mode, so the chain is hidden */
  available: boolean;
};

export type EvmKey = "base" | "ethereum" | "arbitrum" | "robinhood" | "monad" | "bnb" | "tempo" | "hyperevm";

const TESTNET_EVM: Record<EvmKey, EvmNet> = {
  base: { network: "Base Sepolia", chainId: 84532, rpcEnv: "BASE_SEPOLIA_RPC", publicRpc: "https://sepolia.base.org", usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", explorer: "https://sepolia.basescan.org", available: true },
  ethereum: { network: "Sepolia", chainId: 11155111, rpcEnv: "SEPOLIA_RPC", publicRpc: "https://ethereum-sepolia-rpc.publicnode.com", usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", explorer: "https://sepolia.etherscan.io", available: true },
  arbitrum: { network: "Arbitrum Sepolia", chainId: 421614, rpcEnv: "ARBITRUM_SEPOLIA_RPC", alchemy: "arb-sepolia", publicRpc: "https://sepolia-rollup.arbitrum.io/rpc", usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", explorer: "https://sepolia.arbiscan.io", available: true },
  robinhood: { network: "Robinhood Chain testnet", chainId: 46630, rpcEnv: "ROBINHOOD_TESTNET_RPC", publicRpc: "https://rpc.testnet.chain.robinhood.com", usdc: "", explorer: "https://explorer.testnet.chain.robinhood.com", available: true },
  monad: { network: "Monad testnet", chainId: 10143, rpcEnv: "MONAD_RPC", alchemy: "monad-testnet", publicRpc: "https://testnet-rpc.monad.xyz", usdc: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea", explorer: "https://testnet.monadexplorer.com", available: true },
  bnb: { network: "BNB Smart Chain testnet", chainId: 97, rpcEnv: "TOPUP_RPC_BNB", publicRpc: "https://bsc-testnet-rpc.publicnode.com", usdc: "0x64544969ed7EBf5f083679233325356EbE738930", explorer: "https://testnet.bscscan.com", available: true },
  tempo: { network: "Tempo Moderato testnet", chainId: 42431, rpcEnv: "TOPUP_RPC_TEMPO", publicRpc: "https://rpc.moderato.tempo.xyz", usdc: "", explorer: "https://explore.testnet.tempo.xyz", available: true },
  hyperevm: { network: "Hyperliquid testnet (HyperEVM)", chainId: 998, rpcEnv: "TOPUP_RPC_HYPEREVM", publicRpc: "https://rpc.hyperliquid-testnet.xyz/evm", usdc: "", explorer: "https://testnet.purrsec.com", available: true },
};

/**
 * Mainnet values, checked against the chains' own docs (Oct 2026): Circle's USDC address list, docs.monad.xyz
 * (chain 143, rpc.monad.xyz), tempo.xyz (chain 4217). Robinhood Chain has no public mainnet, so it is hidden.
 * Tempo and HyperEVM have mainnets, but Lexari's Tempo and Hyperliquid code is only verified on testnet, so they
 * stay hidden until that work lands (docs/MAINNET.md, open decisions).
 */
const MAINNET_EVM: Record<EvmKey, EvmNet> = {
  base: { network: "Base", chainId: 8453, rpcEnv: "BASE_RPC", alchemy: "base-mainnet", publicRpc: "https://mainnet.base.org", usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", explorer: "https://basescan.org", available: true },
  ethereum: { network: "Ethereum", chainId: 1, rpcEnv: "ETHEREUM_RPC", alchemy: "eth-mainnet", publicRpc: "https://ethereum-rpc.publicnode.com", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", explorer: "https://etherscan.io", available: true },
  arbitrum: { network: "Arbitrum One", chainId: 42161, rpcEnv: "ARBITRUM_RPC", alchemy: "arb-mainnet", publicRpc: "https://arb1.arbitrum.io/rpc", usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", explorer: "https://arbiscan.io", available: true },
  robinhood: { network: "Robinhood Chain", chainId: 0, rpcEnv: "ROBINHOOD_RPC", publicRpc: "", usdc: "", explorer: "", available: false },
  monad: { network: "Monad", chainId: 143, rpcEnv: "MONAD_RPC", alchemy: "monad-mainnet", publicRpc: "https://rpc.monad.xyz", usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603", explorer: "https://monadscan.com", available: true },
  bnb: { network: "BNB Smart Chain", chainId: 56, rpcEnv: "TOPUP_RPC_BNB", publicRpc: "https://bsc-rpc.publicnode.com", usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", explorer: "https://bscscan.com", available: true },
  tempo: { network: "Tempo", chainId: 4217, rpcEnv: "TOPUP_RPC_TEMPO", publicRpc: "https://rpc.tempo.xyz", usdc: "", explorer: "", available: false },
  hyperevm: { network: "HyperEVM", chainId: 999, rpcEnv: "TOPUP_RPC_HYPEREVM", publicRpc: "https://rpc.hyperliquid.xyz/evm", usdc: "", explorer: "", available: false },
};

export const EVM_NETS: Record<EvmKey, EvmNet> = IS_MAINNET ? MAINNET_EVM : TESTNET_EVM;

/** RPC for an EVM chain in this mode: its env override, then Alchemy when keyed, then the public endpoint. */
export function evmRpcFor(k: EvmKey): string {
  const n = EVM_NETS[k];
  if (!n.available) return "";
  const env = typeof process !== "undefined" ? process.env : ({} as Record<string, string | undefined>);
  const o = (env[n.rpcEnv] || "").trim();
  if (o) return o;
  if (n.alchemy && env.ALCHEMY_API_KEY) return `https://${n.alchemy}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
  return n.publicRpc;
}

/** Solana tokens for this mode. Testnet test mints are Lexari-made stand-ins and always labelled "test". */
export const SOLANA_TOKENS = IS_MAINNET
  ? { USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" }
  : { USDC: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", USDT: "GDaRV9vPQDx5y1mv63dFRy1o4DDqqgUQ8YTmYAi3RwzA" };

/** Solana explorer link suffix for this mode. */
export const SOLANA_EXPLORER_QS = IS_MAINNET ? "" : "?cluster=devnet";

/**
 * Integration and Confirm-card spend limits (US dollars). Mainnet starts lower: a new grant defaults to $2 a trade
 * and $10 a day, capped at $10 and $50, until people raise them on purpose.
 */
export const SPEND_LIMITS = IS_MAINNET
  ? { perTx: { min: 1, max: 10, def: 2 }, daily: { min: 1, max: 50, def: 10 }, slippageBps: { min: 10, max: 300, def: 50 } }
  : { perTx: { min: 1, max: 25, def: 5 }, daily: { min: 1, max: 100, def: 20 }, slippageBps: { min: 10, max: 500, def: 100 } };

/** Faucets (devnet SOL, test tokens) exist only on testnet. */
export const FAUCETS_ENABLED = IS_TESTNET;
/** ORE practice mining (real hashing, no rewards) is a testnet feature. */
export const ORE_PRACTICE_ENABLED = IS_TESTNET;

/** Short label for UI copy. */
export const NETWORK_LABEL = IS_MAINNET ? "Mainnet" : "Testnet";
