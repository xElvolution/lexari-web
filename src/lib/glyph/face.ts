/**
 * Face DNA helpers for the web app: a Glyph face with the vivid palette.
 * Persist the whole FaceDNA object; it renders the same everywhere.
 */
import { createAvatar, makeRng, VIVID_ACCENT, VIVID_KEYS, GLYPH_CATALOG, randomGlyphParts } from './index';
import type { AvatarDNA, GlyphParts, VividKey, Finish } from './index';

export type FaceDNA = AvatarDNA & { glyph: GlyphParts; color: { scheme: 'vivid'; body: VividKey; accent: VividKey; finish: Finish } };

export const isFace = (x: unknown): x is FaceDNA => !!x && typeof x === 'object' && (x as FaceDNA).direction === 'glyph';

/** A full, stable face for an id (what a brand-new agent gets before you customise it). */
export function defaultFace(agentId: string, personality?: string): FaceDNA {
  const a = createAvatar({ v: 1, direction: 'glyph', agentId, personality });
  const p = a.spec.palette;
  return { v: 1, direction: 'glyph', agentId, personality, glyph: { ...a.spec.parts }, color: { scheme: 'vivid', body: p.vivid ?? 'purple', accent: p.accentKey ?? 'yellow', finish: p.finish ?? 'solid' } };
}

/** Randomize: new parts (personality-weighted) and new vivid colours. */
export function randomFace(base: FaceDNA, seed = Date.now()): FaceDNA {
  const rng = makeRng(seed >>> 0);
  const traits = createAvatar(base).spec.traits;
  const body = rng.pick(VIVID_KEYS);
  const accent = rng.chance(0.55) ? VIVID_ACCENT[body] : rng.pick(VIVID_KEYS.filter((k) => k !== body));
  return { ...base, glyph: randomGlyphParts(rng, traits), color: { scheme: 'vivid', body, accent, finish: rng.chance(0.35) ? 'gradient' : 'solid' } };
}

export { GLYPH_CATALOG };

/** nearest colour key of the original web palette (tiles, cards and wallets still key off it) */
export function legacyColor(k: VividKey): 'orange' | 'blue' | 'green' | 'yellow' | 'red' | 'teal' | 'pink' | 'lilac' | 'purple' | 'sky' {
  const map: Partial<Record<VividKey, ReturnType<typeof legacyColor>>> = { lime: 'green', indigo: 'blue', magenta: 'pink', coral: 'red' };
  return map[k] ?? (k as ReturnType<typeof legacyColor>);
}
