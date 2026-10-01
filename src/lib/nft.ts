/**
 * Onchain Agent ID card (ERC-721 + ERC-4906) on Arbitrum Sepolia.
 * The contract stores the card's name, role, face DNA, the face SVG and a background index,
 * and builds the whole card SVG + tokenURI JSON onchain. Source: /contracts.
 */
import type { Variant } from "@/components/avatar";
import { BACKGROUNDS } from "./backgrounds";
import abi from "./abi/LexariAgentCard.json";

export const NFT_ABI = abi as readonly unknown[];
export const NFT_CHAIN = {
  id: 421614,
  hex: "0x66eee",
  name: "Arbitrum Sepolia",
  rpc: "https://sepolia-rollup.arbitrum.io/rpc",
  explorer: "https://sepolia.arbiscan.io",
} as const;

/** Set NEXT_PUBLIC_LXID_ADDRESS at build time once the contract is deployed. null = not deployed yet. */
const BUILT = process.env.NEXT_PUBLIC_LXID_ADDRESS || "";
const isAddr = (a: string | null | undefined): a is `0x${string}` => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);
/** Testing hook: localStorage "lexari-nft-address" points the UI at a contract you deployed yourself (e.g. on a fork). */
export function nftAddress(): `0x${string}` | null {
  if (isAddr(BUILT)) return BUILT;
  if (typeof window !== "undefined") { try { const o = localStorage.getItem("lexari-nft-address"); if (isAddr(o)) return o; } catch {} }
  return null;
}

/** Index of a background in the onchain LexariBackgrounds contract (same order as backgrounds.json). */
export const bgIndex = (id?: string) => Math.max(0, BACKGROUNDS.findIndex((b) => b.id === (id || "black")));

/** Compact, human-readable face DNA kept onchain next to the SVG. Only uses [a-z0-9=;,]. */
export function faceDna(v: Variant, bg?: string) {
  return [`shape=${v.shape}`, `color=${v.color}`, `eyes=${v.eyes}`, `mouth=${v.mouth}`, `extra=${v.extra}`, `brows=${v.brows ?? "none"}`, `orbit=${v.orbit ?? "none"}`, `dots=${v.dots ?? 0}`, `blush=${v.blush ? 1 : 0}`, `bg=${bg || "black"}`]
    .map((x) => x.replace(/[^A-Za-z0-9=._-]/g, "")).join(";");
}

/** Turns a rendered <svg> face into the <g> fragment the contract accepts. */
export function faceFragment(svg: SVGSVGElement | null): string | null {
  if (!svg) return null;
  const inner = svg.innerHTML.replace(/<!--.*?-->/g, "").replace(/\s(xlink:)?href="[^"]*"/g, "");
  const frag = `<g>${inner}</g>`;
  if (frag.length > 16000 || /<script|<foreign|href|<!|<\/svg/i.test(frag)) return null;
  return frag;
}

/** The card name/role charset the contract allows. */
export const cleanName = (s: string) => (s.replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 16) || "Agent");
export const cleanRole = (s: string) => s.replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 28);

export type NftRecord = { tokenId: string; tx: string; dna: string; name: string; role: string; owner: string; at: number };
export const txUrl = (h: string) => `${NFT_CHAIN.explorer}/tx/${h}`;
export const tokenUrl = (addr: string, id: string) => `${NFT_CHAIN.explorer}/nft/${addr}/${id}`;
