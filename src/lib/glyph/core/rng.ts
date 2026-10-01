/** Deterministic hashing + PRNG. Everything about an avatar derives from these. */

/** 32-bit string hash (cyrb53-style mix, folded to uint32). Stable across JS engines. */
export function hashString(input: string): number {
  'worklet';
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export interface Rng {
  /** float in [0,1) */
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly (readonly [T, number])[]): T;
  chance(p: number): boolean;
  /** independent sub-stream: adding a new feature never reshuffles existing ones */
  fork(label: string): Rng;
  readonly seed: number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    seed,
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (items) => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of items) {
        if ((r -= w) <= 0) return v;
      }
      return items[items.length - 1][0];
    },
    chance: (p) => next() < p,
    fork: (label) => makeRng(hashString(`${seed}:${label}`)),
  };
  return rng;
}

/** Smooth 1D value noise in [0,1]. Pure + worklet-safe (used per frame). */
export function noise1(x: number, seed = 0): number {
  'worklet';
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    let v = Math.imul((n + seed * 374761393) | 0, 668265263);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

export const clamp = (v: number, lo = 0, hi = 1) => {
  'worklet';
  return v < lo ? lo : v > hi ? hi : v;
};
export const lerp = (a: number, b: number, k: number) => {
  'worklet';
  return a + (b - a) * k;
};
export const smoothstep = (e0: number, e1: number, x: number) => {
  'worklet';
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
