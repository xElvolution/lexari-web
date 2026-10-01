import type { Rng } from './rng';
import { clamp } from './rng';

/** Personality knobs, all 0..1. They bias shape, colour and motion. */
export interface Traits {
  energy: number; // motion speed/amplitude, bounce
  warmth: number; // roundness, warmer hue, blush
  curiosity: number; // eye size, more nodes/modules
  playfulness: number; // asymmetry, extra modules, wobble
  focus: number; // sharper geometry, tighter eyes
}

const KEYWORDS: Record<string, Partial<Traits>> = {
  playful: { playfulness: 0.9, energy: 0.7 },
  fun: { playfulness: 0.85, energy: 0.65 },
  chaotic: { playfulness: 1, energy: 0.9, focus: 0.15 },
  witty: { playfulness: 0.7, curiosity: 0.6 },
  sarcastic: { playfulness: 0.6, warmth: 0.3, focus: 0.7 },
  calm: { energy: 0.15, focus: 0.6 },
  gentle: { energy: 0.25, warmth: 0.85 },
  stoic: { energy: 0.1, warmth: 0.3, focus: 0.85 },
  warm: { warmth: 0.9 },
  friendly: { warmth: 0.85, energy: 0.55 },
  cheerful: { warmth: 0.8, energy: 0.8, playfulness: 0.65 },
  kind: { warmth: 0.9, energy: 0.35 },
  curious: { curiosity: 0.95, energy: 0.6 },
  creative: { curiosity: 0.8, playfulness: 0.7 },
  analytical: { focus: 0.9, warmth: 0.35, energy: 0.3 },
  precise: { focus: 0.95, playfulness: 0.15 },
  focused: { focus: 0.9 },
  thoughtful: { curiosity: 0.7, energy: 0.25, focus: 0.65 },
  bold: { energy: 0.85, focus: 0.7, warmth: 0.45 },
  energetic: { energy: 0.95 },
  sharp: { focus: 0.85, warmth: 0.3 },
  wise: { focus: 0.7, energy: 0.2, curiosity: 0.6 },
  shy: { energy: 0.2, curiosity: 0.4, warmth: 0.7 },
  trader: { focus: 0.85, energy: 0.6 },
  degen: { playfulness: 0.9, energy: 0.95, focus: 0.3 },
};

export function resolveTraits(rng: Rng, personality?: string, explicit?: Partial<Traits>): Traits {
  const base: Traits = {
    energy: rng.range(0.25, 0.75),
    warmth: rng.range(0.25, 0.75),
    curiosity: rng.range(0.25, 0.75),
    playfulness: rng.range(0.25, 0.75),
    focus: rng.range(0.25, 0.75),
  };
  if (personality) {
    const words = personality.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const hits = words.map((w) => KEYWORDS[w]).filter(Boolean) as Partial<Traits>[];
    for (const key of Object.keys(base) as (keyof Traits)[]) {
      const vals = hits.map((h) => h[key]).filter((v): v is number => v !== undefined);
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        base[key] = clamp(base[key] * 0.3 + avg * 0.7);
      }
    }
  }
  return { ...base, ...explicit };
}
