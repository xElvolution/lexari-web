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
export type Eyes = "oval" | "dot" | "happy" | "wink" | "visor" | "big" | "sleepy" | "glasses" | "star" | "pixel" | "cyclops";
export type Mouth = "smile" | "flat" | "o" | "grin" | "none" | "tongue" | "cat" | "teeth" | "wave" | "fang" | "smirk";
export type Extra = "none" | "antenna" | "ears" | "catEars" | "tuft" | "beanie" | "cap" | "horns" | "headphones" | "party";
export type Brows = "none" | "flat" | "raised" | "angry" | "soft" | "uni";
export type Orbit = "none" | "dots" | "ring" | "comet" | "sparkle";
export type FaceState = "idle" | "thinking" | "speaking" | "happy";
export type Variant = {
  shape: Shape; color: ColorKey; eyes: Eyes; mouth: Mouth; extra: Extra; blush: boolean; plain?: boolean;
  /** added with the face creator; all optional so every older face renders exactly as before */
  brows?: Brows; orbit?: Orbit; dots?: number; bg?: string;
};
/** A face you built in the creator. Saved as the agent's look and printed on its ID card / NFT. */
export type FaceLook = Variant;

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
  if (shape === "tri") extra = "none";
  if (extra === "beanie" || extra === "cap" || extra === "party") extra = "none"; // no hats
  return { shape, color: pick(COLORS), eyes: pick(EYES), mouth: pick(MOUTHS), extra, blush: r() < 0.4 };
}

/** The house face on the hero badge. Kept exactly as designed: flat lilac, no outline. */
export const HOME: Variant = { shape: "round", color: "lilac", eyes: "oval", mouth: "smile", extra: "none", blush: false, plain: true };

/* ---------- creator option lists (the random lists above stay as they were so seeded faces never change) ---------- */
export const ALL_SHAPES: Shape[] = ["round", "square", "blob", "hex", "tri", "robot", "egg", "tall", "wide"];
export const ALL_EYES: Eyes[] = ["oval", "dot", "happy", "wink", "big", "sleepy", "glasses", "visor", "star", "pixel", "cyclops"];
export const ALL_MOUTHS: Mouth[] = ["smile", "grin", "o", "flat", "cat", "tongue", "teeth", "none", "wave", "fang", "smirk"];
export const ALL_BROWS: Brows[] = ["none", "flat", "soft", "raised", "angry", "uni"];
export const ALL_EXTRAS: Extra[] = ["none", "antenna", "ears", "catEars", "tuft", "horns", "headphones", "beanie", "cap", "party"];
export const ALL_ORBITS: Orbit[] = ["none", "dots", "ring", "comet", "sparkle"];
export const LABEL: Record<string, string> = {
  round: "Round", square: "Square", blob: "Blob", hex: "Hex", tri: "Triangle", robot: "Robot", egg: "Egg", tall: "Tall", wide: "Wide",
  oval: "Oval", dot: "Dot", happy: "Happy", wink: "Wink", big: "Big", sleepy: "Sleepy", glasses: "Glasses", visor: "Visor", star: "Star", pixel: "Pixel", cyclops: "Cyclops",
  smile: "Smile", grin: "Grin", o: "O", flat: "Flat", cat: "Cat", tongue: "Tongue", teeth: "Teeth", none: "None", wave: "Wave", fang: "Fang", smirk: "Smirk",
  soft: "Soft", raised: "Raised", angry: "Angry", uni: "Uni",
  antenna: "Antenna", ears: "Ears", catEars: "Cat ears", tuft: "Tuft", horns: "Horns", headphones: "Headphones", beanie: "Beanie", cap: "Cap", party: "Party hat",
  dots: "Memory dots", ring: "Ring", comet: "Comet", sparkle: "Sparkles",
};
/** The full look for any saved value: a seed number, null (house face) or a FaceLook object. */
export function lookVariant(look: number | null | undefined | Partial<Variant>): Variant {
  if (look && typeof look === "object") return { ...HOME, plain: false, ...look } as Variant;
  return look === null || look === undefined ? { ...HOME } : variantFor(look);
}
