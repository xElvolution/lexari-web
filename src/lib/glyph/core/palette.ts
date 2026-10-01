import { hsl, luma, mix } from './color';
import type { Rng } from './rng';
import type { Traits } from './traits';

/** Brand anchors */
export const BRAND = {
  primary: '#5B2BFF',
  light: '#A58BFF',
  black: '#000000',
  surface: '#13101F',
  white: '#FFFFFF',
  primaryHue: 254,
} as const;

/**
 * Colour "scheme" = how the brand trio is distributed over body / features.
 *  brand    : purple body, white features (hero look)
 *  midnight : #13101F body, white features, purple rim
 *  lilac    : light-purple body, ink features
 *  mono     : white body, purple / ink features
 */
export type Scheme = 'brand' | 'midnight' | 'lilac' | 'mono' | 'vivid';
export const SCHEMES: Scheme[] = ['brand', 'midnight', 'lilac', 'mono'];

/**
 * Lexari web "vivid" palette: the same bright hues the web faces always used
 * (orange, blue, green, yellow, red, teal, pink, lilac, purple, sky) plus a few
 * extras. A vivid face has a body colour, an accent colour (antenna, ears,
 * chip, orbit, echo) and a finish: solid, or a gradient from body to accent.
 */
export const VIVID = {
  orange: { fill: '#FF8A3D', shade: '#D65F16' },
  yellow: { fill: '#FCD34D', shade: '#D19B04' },
  lime: { fill: '#A3E635', shade: '#5E9A0B' },
  green: { fill: '#34D399', shade: '#079669' },
  teal: { fill: '#2DD4BF', shade: '#0D8F84' },
  sky: { fill: '#7DD3FC', shade: '#0B84C4' },
  blue: { fill: '#3B82F6', shade: '#1E4FD6' },
  indigo: { fill: '#6366F1', shade: '#3730C8' },
  purple: { fill: '#8B5CF6', shade: '#5B2BFF' },
  lilac: { fill: '#C9B8FF', shade: '#8F6BFF' },
  pink: { fill: '#F9A8D4', shade: '#D9579E' },
  magenta: { fill: '#E64BD8', shade: '#A61F9A' },
  red: { fill: '#F45B5B', shade: '#C42A2A' },
  coral: { fill: '#FF8F7A', shade: '#D9573F' },
} as const;
export type VividKey = keyof typeof VIVID;
export const VIVID_KEYS = Object.keys(VIVID) as VividKey[];
export type Finish = 'solid' | 'gradient';
/** a second colour that pops against each body colour (two-tone default) */
export const VIVID_ACCENT: Record<VividKey, VividKey> = {
  orange: 'blue', yellow: 'blue', lime: 'purple', green: 'yellow', teal: 'pink', sky: 'red', blue: 'yellow', indigo: 'lime',
  purple: 'yellow', lilac: 'magenta', pink: 'teal', magenta: 'yellow', red: 'sky', coral: 'teal',
};
/** ready-made two-colour gradients for the Colour tab */
export const VIVID_GRADIENTS: { id: string; label: string; body: VividKey; accent: VividKey }[] = [
  { id: 'sunset', label: 'Sunset', body: 'orange', accent: 'pink' },
  { id: 'ocean', label: 'Ocean', body: 'sky', accent: 'indigo' },
  { id: 'lagoon', label: 'Lagoon', body: 'teal', accent: 'blue' },
  { id: 'citrus', label: 'Citrus', body: 'yellow', accent: 'lime' },
  { id: 'berry', label: 'Berry', body: 'pink', accent: 'purple' },
  { id: 'ember', label: 'Ember', body: 'red', accent: 'orange' },
  { id: 'aurora', label: 'Aurora', body: 'green', accent: 'purple' },
  { id: 'candy', label: 'Candy', body: 'lilac', accent: 'magenta' },
];

export interface Palette {
  hue: number;
  scheme: Scheme;
  body: string;
  bodyHi: string;
  bodyLo: string;
  rim: string;
  feature: string; // eyes / mouth
  pupil: string;
  accent: string;
  accentSoft: string;
  blush: string;
  ink: string;
  white: string;
  /** small dot on antenna tips / mark chip */
  tip: string;
  /** open-mouth cavity */
  cavity: string;
  tongue: string;
  /** vivid only: the chosen keys, so a customizer can read them back */
  vivid?: VividKey;
  accentKey?: VividKey;
  finish?: Finish;
}

export interface ColorOverride {
  /** absolute hue 0..360 (brand = 254). UI: slider limited to 220..300 to stay on-brand */
  hue?: number;
  scheme?: Scheme;
  /** vivid scheme: body colour, accent colour and finish */
  body?: VividKey;
  accent?: VividKey;
  finish?: Finish;
}

export function makePalette(rng: Rng, traits: Traits, ov: ColorOverride = {}): Palette {
  // the web app is vivid by default; the brand schemes stay available by name
  if (!ov.scheme || ov.scheme === 'vivid') {
    const body = ov.body && VIVID[ov.body] ? ov.body : rng.pick(VIVID_KEYS);
    const accent = ov.accent && VIVID[ov.accent] ? ov.accent : VIVID_ACCENT[body];
    const finish = ov.finish ?? (rng.chance(0.3) ? 'gradient' : 'solid');
    return vividPalette(body, accent, finish);
  }
  const jitter = rng.range(-18, 22) + (traits.warmth - 0.5) * 22;
  const hue = ov.hue ?? BRAND.primaryHue + Math.max(-8, Math.min(30, jitter));
  const scheme =
    ov.scheme ??
    rng.weighted<Scheme>([
      ['brand', 0.46],
      ['midnight', 0.2],
      ['lilac', 0.19],
      ['mono', 0.15],
    ]);
  return paletteFor(hue, scheme);
}

export function vividPalette(body: VividKey, accent: VividKey, finish: Finish = 'solid'): Palette {
  const B = VIVID[body];
  const A = VIVID[accent];
  const grad = finish === 'gradient' && accent !== body;
  const mid = grad ? mix(B.fill, A.fill, 0.5) : B.fill;
  const light = luma(mid) > 0.56;
  const feature = light ? '#0A0A0A' : '#FFFFFF';
  return {
    hue: 0, scheme: 'vivid', vivid: body, accentKey: accent, finish,
    body: mid,
    bodyHi: grad ? mix(B.fill, '#FFFFFF', 0.12) : mix(B.fill, '#FFFFFF', 0.22),
    bodyLo: grad ? A.fill : mix(B.fill, B.shade, 0.6),
    rim: B.shade,
    feature,
    pupil: light ? '#FFFFFF' : '#0A0A0A',
    accent: A.fill,
    accentSoft: mix(A.fill, '#FFFFFF', 0.4),
    blush: mix(A.fill, '#FF5A7A', 0.5),
    ink: '#0A0A0A',
    white: '#FFFFFF',
    tip: luma(A.fill) > 0.6 ? '#0A0A0A' : '#FFFFFF',
    cavity: '#0A0A0A',
    tongue: '#F45B7A',
  };
}

export function paletteFor(hue: number, scheme: Scheme): Palette {
  if (scheme === 'vivid') return vividPalette('purple', 'yellow');
  const P = (s: number, l: number) => hsl(hue, s, l);
  const tipFor = scheme === 'lilac' || scheme === 'mono' ? BRAND.white : BRAND.surface;
  const common = { hue, scheme, ink: BRAND.surface, white: BRAND.white, blush: P(100, 80), tip: tipFor, cavity: scheme === 'midnight' ? '#000000' : BRAND.surface, tongue: '' };
  switch (scheme) {
    case 'brand':
      return { ...common, body: P(100, 58), bodyHi: P(100, 71), bodyLo: hsl(hue + 12, 82, 40), rim: P(100, 77), feature: '#FFFFFF', pupil: BRAND.surface, accent: P(100, 77), accentSoft: P(100, 88), blush: mix(P(100, 77), '#FF8AD8', 0.35) };
    case 'midnight':
      return { ...common, body: P(42, 11), bodyHi: P(40, 22), bodyLo: P(50, 6), rim: P(100, 66), feature: '#FFFFFF', pupil: P(100, 58), accent: P(100, 66), accentSoft: P(60, 30), blush: P(100, 58) };
    case 'lilac':
      return { ...common, body: P(100, 77), bodyHi: P(100, 87), bodyLo: P(78, 63), rim: P(100, 58), feature: BRAND.surface, pupil: '#FFFFFF', accent: P(100, 58), accentSoft: P(100, 92), blush: mix(P(100, 70), '#FF7AC8', 0.35) };
    case 'mono':
      return { ...common, body: P(60, 97), bodyHi: '#FFFFFF', bodyLo: P(36, 85), rim: P(100, 58), feature: P(100, 56), pupil: BRAND.surface, accent: P(100, 58), accentSoft: P(100, 90), blush: P(100, 86) };
  }
}

export type Theme = 'dark' | 'light';

/** Whether the silhouette needs an outline to separate from the app background. */
export function needsRim(p: Palette, theme: Theme): boolean {
  return (p.scheme === 'midnight' && theme === 'dark') || (p.scheme === 'mono' && theme === 'light');
}
