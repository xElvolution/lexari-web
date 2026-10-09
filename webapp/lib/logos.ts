/**
 * Self-hosted brand marks for coins, chains and AI providers. Paths live under /logos/ so they pass the site's CSP
 * (img-src 'self'). Sources: cryptocurrency-icons (coins), Trust Wallet assets (chains), CoinGecko / ore.supply /
 * dexscreener (SKR, ORE, pathUSD), Tempo favicon (Tempo), lobehub icons (model providers). ALPHAUSD has no public
 * official mark yet, so we ship a simple Tempo-style glyph.
 */
import type { ChainId, CoinId } from "@/content/topup";
import type { KeyProvider } from "@/content/models";

const COIN_FILE: Record<CoinId, string> = {
  SOL: "SOL.svg",
  USDC: "USDC.svg",
  USDT: "USDT.svg",
  SKR: "SKR.png",
  ORE: "ORE.png",
  BTC: "BTC.svg",
  ETH: "ETH.svg",
  BNB: "BNB.svg",
  XRP: "XRP.svg",
  TRX: "TRX.svg",
  LTC: "LTC.svg",
  DOGE: "DOGE.svg",
  BONK: "BONK.webp",
  JUP: "JUP.webp",
  PATHUSD: "PATHUSD.png",
  ALPHAUSD: "ALPHAUSD.svg",
};

const CHAIN_FILE: Record<ChainId | "polygon", string> = {
  solana: "solana.png",
  ethereum: "ethereum.png",
  base: "base.png",
  arbitrum: "arbitrum.png",
  bnb: "bnb.png",
  tempo: "tempo.png",
  bitcoin: "bitcoin.png",
  litecoin: "litecoin.png",
  tron: "tron.png",
  xrpl: "xrpl.png",
  dogecoin: "dogecoin.png",
  polygon: "polygon.png",
};

/** API key providers in Settings > Models. */
const PROVIDER_FILE: Record<KeyProvider, string> = {
  openai: "openai.png",
  anthropic: "anthropic.png",
  gemini: "google.png",
  xai: "xai.png",
  openrouter: "openrouter.png",
};

/** Maker name → logo (ModelInfo.maker and KEY_PROVIDERS.maker). */
const MAKER_FILE: Record<string, string> = {
  Lexari: "", // Lamina mark is drawn inline
  OpenAI: "openai.png",
  Anthropic: "anthropic.png",
  Google: "google.png",
  xAI: "xai.png",
  OpenRouter: "openrouter.png",
  Custom: "",
};

export const coinLogoSrc = (id: string): string | null => {
  const f = COIN_FILE[id as CoinId];
  return f ? `/logos/coins/${f}` : null;
};

export const chainLogoSrc = (id: string): string | null => {
  const f = CHAIN_FILE[id as ChainId | "polygon"];
  return f ? `/logos/chains/${f}` : null;
};

export const providerLogoSrc = (id: string): string | null => {
  const f = PROVIDER_FILE[id as KeyProvider];
  return f ? `/logos/models/${f}` : null;
};

export const makerLogoSrc = (maker: string): string | null => {
  if (!(maker in MAKER_FILE)) return null;
  const f = MAKER_FILE[maker];
  return f ? `/logos/models/${f}` : null;
};

/** Soft brand tile behind a mono / transparent provider mark. */
export const MAKER_TILE: Record<string, string> = {
  OpenAI: "#10a37f",
  Anthropic: "#d97757",
  Google: "#1a73e8",
  xAI: "#111111",
  OpenRouter: "#6467f2",
  Custom: "var(--ink)",
};
