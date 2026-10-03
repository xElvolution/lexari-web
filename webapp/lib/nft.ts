/**
 * Agent ID card helpers shared by the mint screen.
 * The card is a Metaplex Core asset on Solana. The registry that ties the asset
 * to a name, role and face lives in contracts/solana.
 */
import type { Variant } from "@shared/components/avatar";
import { BACKGROUNDS } from "@shared/lib/backgrounds";

export const SOLANA_CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet") as "devnet" | "mainnet-beta";
export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC
  || (SOLANA_CLUSTER === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
export const CHAIN_NAME = SOLANA_CLUSTER === "mainnet-beta" ? "Solana" : "Solana Devnet";
/** Lexari agent registry. Built from contracts/solana. */
export const LEXARI_PROGRAM_ID = "BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po";

const clusterQuery = SOLANA_CLUSTER === "mainnet-beta" ? "" : `?cluster=${SOLANA_CLUSTER}`;
export const txUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}${clusterQuery}`;
export const tokenUrl = (asset: string) => `https://explorer.solana.com/address/${asset}${clusterQuery}`;

/** Index of a background, same order as backgrounds.json. */
export const bgIndex = (id?: string) => Math.max(0, BACKGROUNDS.findIndex((b) => b.id === (id || "black")));

/** Compact face recipe stored in the agent registry. */
export function faceDna(v: Variant, bg?: string) {
  return [`shape=${v.shape}`, `color=${v.color}`, `eyes=${v.eyes}`, `mouth=${v.mouth}`, `extra=${v.extra}`, `brows=${v.brows ?? "none"}`, `orbit=${v.orbit ?? "none"}`, `dots=${v.dots ?? 0}`, `blush=${v.blush ? 1 : 0}`, `bg=${bg || "black"}`]
    .map((x) => x.replace(/[^A-Za-z0-9=._-]/g, "")).join(";");
}

/** Turns a rendered face into an SVG fragment. */
export function faceFragment(svg: SVGSVGElement | null): string | null {
  if (!svg) return null;
  const inner = svg.innerHTML.replace(/<!--.*?-->/g, "").replace(/\s(xlink:)?href="[^"]*"/g, "");
  const frag = `<g>${inner}</g>`;
  if (frag.length > 16000 || /<script|<foreign|href|<!|<\/svg/i.test(frag)) return null;
  return frag;
}

export function faceSvg(fragment: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -12 116 116">${fragment}</svg>`;
}

export const cleanName = (s: string) => (s.replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 16) || "Agent");
export const cleanRole = (s: string) => s.replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 28);

export type NftRecord = {
  /** Metaplex Core asset address. */
  tokenId: string;
  tx: string;
  dna: string;
  name: string;
  role: string;
  owner: string;
  at: number;
  uri?: string;
  /** False when the Core asset exists but the registry account was not written. */
  registered?: boolean;
};
