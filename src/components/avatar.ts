/**
 * Generated agent avatars. Every face is built in code from a small set of parts,
 * using only the brand palette (purple, black, white). A seed always gives the same face.
 */
export type Shape = "round" | "tall" | "square" | "hex" | "blob";
export type Eyes = "oval" | "dot" | "happy" | "wink" | "visor" | "big";
export type Mouth = "smile" | "flat" | "o" | "grin" | "none";
export type Extra = "none" | "antenna" | "ears" | "bolt";
export type Variant = { shape: Shape; body: string; eyes: Eyes; mouth: Mouth; extra: Extra };

export const BODIES = ["#5b2bff", "#8f6bff", "#c9b8ff", "#0a0a0a", "#ffffff"] as const;
const SHAPES: Shape[] = ["round", "tall", "square", "hex", "blob"];
const EYES: Eyes[] = ["oval", "dot", "happy", "wink", "visor", "big"];
const MOUTHS: Mouth[] = ["smile", "flat", "o", "grin", "none"];
const EXTRAS: Extra[] = ["none", "antenna", "ears", "bolt", "none"];

function rng(seed: number) {
  let t = (seed * 2654435761) >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

export function variantFor(seed: number): Variant {
  const r = rng(seed + 1);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  return { shape: pick(SHAPES), body: pick(BODIES), eyes: pick(EYES), mouth: pick(MOUTHS), extra: pick(EXTRAS) };
}

/** The house face used on the hero badge. */
export const HOME: Variant = { shape: "round", body: "#c9b8ff", eyes: "oval", mouth: "smile", extra: "none" };

/** Dark bodies get white features, light bodies get black ones. */
export const featureColor = (body: string) => (body === "#5b2bff" || body === "#0a0a0a" ? "#ffffff" : "#0a0a0a");
