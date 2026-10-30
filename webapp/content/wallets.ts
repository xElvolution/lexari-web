import { IS_MAINNET } from "@/lib/network";

/** Wallets you link (Settings > Wallets) and the chains you can make active. Shared by the web app, the API and the phone app. */
export type WalletFamily = "solana" | "evm";
export type WalletChain = { id: string; name: string; family: WalletFamily; network: string };

const TESTNET_WALLET_CHAINS: WalletChain[] = [
  { id: "solana", name: "Solana", family: "solana", network: "Devnet" },
  { id: "base", name: "Base", family: "evm", network: "Base Sepolia" },
  { id: "ethereum", name: "Ethereum", family: "evm", network: "Sepolia" },
  { id: "tempo", name: "Tempo", family: "evm", network: "Testnet" },
  { id: "hyperliquid", name: "Hyperliquid", family: "evm", network: "Testnet" },
  { id: "monad", name: "Monad", family: "evm", network: "Testnet" },
];
/** Mainnet: Tempo and Hyperliquid are testnet-only in Lexari today (lib/network.ts), so they are not offered. */
const MAINNET_WALLET_CHAINS: WalletChain[] = [
  { id: "solana", name: "Solana", family: "solana", network: "Mainnet" },
  { id: "base", name: "Base", family: "evm", network: "Base" },
  { id: "ethereum", name: "Ethereum", family: "evm", network: "Ethereum" },
  { id: "monad", name: "Monad", family: "evm", network: "Monad" },
];
export const WALLET_CHAINS: WalletChain[] = IS_MAINNET ? MAINNET_WALLET_CHAINS : TESTNET_WALLET_CHAINS;
export const chainById = (id: string) => WALLET_CHAINS.find((c) => c.id === id);
export const chainsFor = (family: WalletFamily) => WALLET_CHAINS.filter((c) => c.family === family);

export type LinkedWallet = {
  address: string;
  family: WalletFamily;
  /** phantom, metamask, privy, ...; "lexari" for the wallet you sign in with */
  client: string;
  /** the wallet you sign in with: always yours, can't be unlinked here */
  login?: boolean;
  verifiedAt: number;
};
export type WalletsReply = { wallets: LinkedWallet[]; active: { address: string; chain: string } | null };

export const familyOf = (address: string): WalletFamily | null =>
  /^0x[0-9a-fA-F]{40}$/.test(address) ? "evm" : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) ? "solana" : null;
export const normAddress = (address: string) => (familyOf(address) === "evm" ? address.toLowerCase() : address);

const CLIENT_NAME: Record<string, string> = { phantom: "Phantom", solflare: "Solflare", backpack: "Backpack", metamask: "MetaMask", coinbase_wallet: "Coinbase Wallet", rainbow: "Rainbow", wallet_connect: "WalletConnect", privy: "Privy wallet", lexari: "Sign-in wallet", rabby_wallet: "Rabby" };
export const clientName = (c: string) => CLIENT_NAME[c] || (c ? c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Wallet");
