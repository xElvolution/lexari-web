/**
 * Glyph customizer catalogue: every part of a Glyph face is a named option.
 * The catalogue drives both the generator and the customizer UI (tabs, option
 * grids, labels). Persist the chosen ids in `AvatarDNA.glyph`.
 */
import type { Rng } from '../core/rng';

export const BODY = ['block', 'tall', 'wide', 'pill', 'leaf', 'diamond', 'tee', 'l-left', 'l-right', 'tail', 'step', 'pedestal'] as const;
export const EYES = ['logo', 'pupil', 'dot', 'ring', 'wide', 'sleepy', 'wink', 'pixel', 'visor', 'mono', 'odd', 'star'] as const;
export const MOUTH = ['smile', 'line', 'open', 'cat', 'grin', 'o', 'smirk', 'dot', 'fang', 'wave', 'tongue', 'none'] as const;
export const BROWS = ['none', 'flat', 'sharp', 'soft', 'raised', 'thick', 'uni'] as const;
export const ACCENT = ['none', 'antenna', 'twin-antenna', 'ears', 'pointy-ears', 'side-tiles', 'mark-chip', 'echo'] as const;
export const ORBIT = ['none', 'dots', 'ring', 'tiles', 'comet', 'pulse'] as const;

export type BodyId = (typeof BODY)[number];
export type EyeId = (typeof EYES)[number];
export type MouthId = (typeof MOUTH)[number];
export type BrowId = (typeof BROWS)[number];
export type AccentId = (typeof ACCENT)[number];
export type OrbitId = (typeof ORBIT)[number];

export interface GlyphParts {
  body: BodyId;
  /** 0 = crisp squircle, 1 = very round */
  roundness: number;
  eyes: EyeId;
  /** 0.8 .. 1.25 */
  eyeSize: number;
  /** 0 = close-set, 1 = wide-set */
  eyeGap: number;
  mouth: MouthId;
  brows: BrowId;
  accent: AccentId;
  orbit: OrbitId;
}

export const LABELS: { [K in PartKey]: Record<string, string> } = {
  body: { block: 'Block', tall: 'Tall', wide: 'Wide', pill: 'Pill', leaf: 'Leaf', diamond: 'Diamond', tee: 'Tee', 'l-left': 'L-left', 'l-right': 'L-right', tail: 'Tail', step: 'Step', pedestal: 'Pedestal' },
  eyes: { logo: 'Logo dot', pupil: 'Pupil', dot: 'Dot', ring: 'Ring', wide: 'Wide', sleepy: 'Sleepy', wink: 'Wink', pixel: 'Pixel', visor: 'Visor', mono: 'Cyclops', odd: 'Odd pair', star: 'Spark' },
  mouth: { smile: 'Smile', line: 'Line', open: 'Open', cat: 'Cat', grin: 'Grin', o: 'O', smirk: 'Smirk', dot: 'Dot', fang: 'Fang', wave: 'Wave', tongue: 'Tongue', none: 'None' },
  brows: { none: 'None', flat: 'Flat', sharp: 'Sharp', soft: 'Soft', raised: 'Raised', thick: 'Thick', uni: 'Uni' },
  accent: { none: 'None', antenna: 'Antenna', 'twin-antenna': 'Twin antenna', ears: 'Ears', 'pointy-ears': 'Pointy ears', 'side-tiles': 'Side tiles', 'mark-chip': 'Mark chip', echo: 'Echo' },
  orbit: { none: 'None', dots: 'Logo dots', ring: 'Ring', tiles: 'Tiles', comet: 'Comet', pulse: 'Pulse' },
};
export const label = (part: PartKey, id: string) => LABELS[part][id] ?? id;

export const CATALOG = { body: BODY, eyes: EYES, mouth: MOUTH, brows: BROWS, accent: ACCENT, orbit: ORBIT } as const;
export type PartKey = keyof typeof CATALOG;

/** "Randomize" button + default face for a new seed. Personality nudges the odds. */
export function randomGlyphParts(rng: Rng, t: { warmth: number; playfulness: number; focus: number; curiosity: number }): GlyphParts {
  const pick = <T>(arr: readonly T[]) => rng.pick(arr);
  return {
    body: rng.weighted<BodyId>([['block', 1.4], ['tall', 1], ['wide', 1], ['pill', 0.8], ['leaf', 0.7], ['diamond', 0.5], ['tee', 0.6], ['l-left', 0.8], ['l-right', 0.8], ['tail', 0.8], ['step', 0.6], ['pedestal', 0.6]]),
    roundness: Math.min(1, Math.max(0, t.warmth * 0.8 + rng.range(-0.15, 0.3))),
    eyes: rng.weighted<EyeId>([['logo', 1.5], ['pupil', 1.4], ['dot', 0.8], ['ring', 0.8], ['wide', 0.6 + t.curiosity], ['sleepy', 0.6], ['wink', 0.4 + t.playfulness * 0.6], ['pixel', 0.7], ['visor', 0.6 + t.focus * 0.4], ['mono', 0.8], ['odd', 0.5 + t.playfulness * 0.5], ['star', 0.4]]),
    eyeSize: 0.85 + t.curiosity * 0.3 + rng.range(-0.05, 0.08),
    eyeGap: rng.range(0.2, 0.85),
    mouth: rng.weighted<MouthId>([['smile', 1.4 + t.warmth], ['line', 0.8 + t.focus * 0.5], ['open', 0.7], ['cat', 0.5 + t.playfulness * 0.6], ['grin', 0.5 + t.playfulness * 0.5], ['o', 0.5], ['smirk', 0.4 + t.focus * 0.4], ['dot', 0.6], ['fang', 0.4 + t.playfulness * 0.4], ['wave', 0.4], ['tongue', 0.3 + t.playfulness * 0.5], ['none', 0.4]]),
    brows: rng.weighted<BrowId>([['none', 2.2], ['flat', 0.6], ['sharp', 0.3 + t.focus * 0.6], ['soft', 0.4 + t.warmth * 0.5], ['raised', 0.3 + t.curiosity * 0.5], ['thick', 0.3], ['uni', 0.2]]),
    accent: rng.weighted<AccentId>([['none', 1.6], ['antenna', 0.8], ['twin-antenna', 0.5], ['ears', 0.7], ['pointy-ears', 0.5], ['side-tiles', 0.6], ['mark-chip', 0.9], ['echo', 0.8]]),
    orbit: pick(['dots', 'dots', 'ring', 'tiles', 'comet', 'pulse'] as const),
  };
}
