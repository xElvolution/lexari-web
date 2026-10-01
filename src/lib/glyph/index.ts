import { exprFor, makeMotion, mixExpr, posterExpr, STATES } from './core/expr';
import type { AvatarState, Expr } from './core/expr';
import { makePalette } from './core/palette';
import type { Theme } from './core/palette';
import { hashString, makeRng } from './core/rng';
import { h, r2, toSvg } from './core/svg';
import type { El } from './core/svg';
import { resolveTraits } from './core/traits';
import type { AvatarDNA, Direction, DirectionId, DrawOpts } from './core/types';
import { glyph } from './directions/glyph';

export * from './core/types';
export * from './core/expr';
export * from './core/palette';
export { toSvg, h } from './core/svg';
export type { El } from './core/svg';
export { hashString, makeRng } from './core/rng';
export { resolveTraits } from './core/traits';
export { mix, luma } from './core/color';

/** The web app only ships the Glyph direction. */
export const DIRECTIONS: Partial<Record<DirectionId, Direction>> = { glyph };
export const DIRECTION_IDS = Object.keys(DIRECTIONS) as DirectionId[];

export interface Avatar {
  dna: AvatarDNA;
  direction: Direction;
  spec: any;
  seed: number;
  /** expression for a state at time t (seconds) */
  expr(state: AvatarState, t: number): Expr;
  poster(state: AvatarState): Expr;
  /** inner tree (no <svg> wrapper). `externalTransform` skips bob/tilt so a native view can animate it */
  tree(e: Expr, o: DrawOpts & { externalTransform?: boolean }): El[];
  /** full <svg> string */
  svg(e: Expr, o: Partial<DrawOpts> & { size?: number }): string;
}

/** 0..1, log scaled: ~0 for a new agent, ~0.5 at 30 memories, 1 at ~300 engrams */
export function growthOf(dna: AvatarDNA): number {
  const e = dna.engram ?? {};
  const n = (e.memories ?? 0) + 2 * (e.skills ?? 0);
  return Math.max(0, Math.min(1, Math.log10(1 + n) / 2.5));
}

export function seedFor(dna: Pick<AvatarDNA, 'agentId' | 'reroll'>): number {
  return hashString(`${dna.agentId}:${dna.reroll ?? 0}`);
}

export function createAvatar(dna: AvatarDNA): Avatar {
  const direction = DIRECTIONS[dna.direction] ?? glyph;
  const seed = seedFor(dna);
  const root = makeRng(seed);
  // Traits & palette depend only on the seed (not the direction) so switching
  // direction in the picker keeps the agent's colour/personality.
  const traits = resolveTraits(root.fork('traits'), dna.personality, dna.traits);
  const palette = makePalette(root.fork('palette'), traits, dna.color);
  const motion = makeMotion(root.fork('motion'), traits);
  const growth = growthOf(dna);
  const spec = direction.makeSpec({ rng: root.fork(direction.id), traits, palette, motion, dna, growth });

  const tree = (e: Expr, o: DrawOpts & { externalTransform?: boolean }): El[] => {
    const inner = direction.draw(spec, e, o);
    if (o.externalTransform) return inner;
    return [h('g', { transform: globalTransform(direction, e) }, inner)];
  };

  return {
    dna,
    direction,
    spec,
    seed,
    expr: (state, t) => exprFor(state, t, motion),
    poster: (state) => posterExpr(state, motion),
    tree,
    svg: (e, o) => {
      const size = o.size ?? 256;
      const opts: DrawOpts = { uid: o.uid ?? `a${seed.toString(36)}`, theme: o.theme ?? 'dark', compact: o.compact };
      return toSvg(h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 100 100' }, tree(e, opts)));
    },
  };
}

export function globalTransform(d: Direction, e: Expr): string {
  const [px, py] = d.pivot;
  const sy = e.squash;
  const sx = 1 / Math.sqrt(sy);
  return `translate(0 ${r2(e.bob)}) rotate(${r2(e.tilt)} ${px} ${py}) translate(${px} ${py}) scale(${r2(sx * 1000) / 1000} ${r2(sy * 1000) / 1000}) translate(${-px} ${-py})`;
}

export { exprFor, mixExpr, STATES };
export type { AvatarState, Expr, Theme };

export { CATALOG as GLYPH_CATALOG, LABELS as GLYPH_LABELS, label as glyphLabel, randomGlyphParts } from './directions/glyph-parts';
export type { GlyphParts, PartKey as GlyphPartKey } from './directions/glyph-parts';
