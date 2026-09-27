/**
 * Generated agent avatars, built in code from parts. The avatars are the one place the
 * site uses a full bright palette; the UI itself stays black, purple and white.
 * A seed always produces the same face, so seats never flicker.
 */
export const PALETTE = {
  orange: { fill: "#ff8a3d", shade: "#d65f16", fc: "#0a0a0a" },
  blue: { fill: "#3b82f6", shade: "#1e4fd6", fc: "#ffffff" },
  green: { fill: "#34d399", shade: "#079669", fc: "#0a0a0a" },
  yellow: { fill: "#fcd34d", shade: "#d19b04", fc: "#0a0a0a" },
  red: { fill: "#f45b5b", shade: "#c42a2a", fc: "#ffffff" },
  teal: { fill: "#2dd4bf", shade: "#0d8f84", fc: "#0a0a0a" },
  pink: { fill: "#f9a8d4", shade: "#d9579e", fc: "#0a0a0a" },
  lilac: { fill: "#c9b8ff", shade: "#8f6bff", fc: "#0a0a0a" },
  purple: { fill: "#8b5cf6", shade: "#5b2bff", fc: "#ffffff" },
  sky: { fill: "#7dd3fc", shade: "#0b84c4", fc: "#0a0a0a" },
} as const;
export type ColorKey = keyof typeof PALETTE;
export const COLORS = Object.keys(PALETTE) as ColorKey[];

export type Shape = "round" | "square" | "tall" | "blob" | "hex" | "tri" | "robot" | "egg" | "wide";
export type Eyes = "oval" | "dot" | "happy" | "wink" | "visor" | "big" | "sleepy" | "glasses";
export type Mouth = "smile" | "flat" | "o" | "grin" | "none" | "tongue" | "cat" | "teeth";
export type Extra = "none" | "antenna" | "ears" | "catEars" | "tuft" | "beanie" | "cap" | "horns" | "headphones" | "party";
export type Variant = { shape: Shape; color: ColorKey; eyes: Eyes; mouth: Mouth; extra: Extra; blush: boolean; plain?: boolean };

const SHAPES: Shape[] = ["round", "square", "tall", "blob", "hex", "tri", "robot", "egg", "wide"];
const EYES: Eyes[] = ["oval", "dot", "happy", "wink", "visor", "big", "sleepy", "glasses"];
const MOUTHS: Mouth[] = ["smile", "flat", "o", "grin", "none", "tongue", "cat", "teeth"];
const EXTRAS: Extra[] = ["none", "antenna", "ears", "catEars", "tuft", "beanie", "cap", "horns", "headphones", "party", "none"];

function rng(seed: number) {
  let t = (seed * 2654435761) >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

export function variantFor(seed: number): Variant {
  const r = rng(seed + 1);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const shape = pick(SHAPES);
  let extra = pick(EXTRAS);
  if (shape === "robot") extra = "antenna";
  if (shape === "tri" && extra !== "none") extra = "party";
  return { shape, color: pick(COLORS), eyes: pick(EYES), mouth: pick(MOUTHS), extra, blush: r() < 0.4 };
}

/** The house face on the hero badge. Kept exactly as designed: flat lilac, no outline. */
export const HOME: Variant = { shape: "round", color: "lilac", eyes: "oval", mouth: "smile", extra: "none", blush: false, plain: true };
