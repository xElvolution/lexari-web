import type { Expr, Motion } from './expr';
import type { ColorOverride, Palette, Theme } from './palette';
import type { Rng } from './rng';
import type { El } from './svg';
import type { Traits } from './traits';
import type { GlyphParts } from '../directions/glyph-parts';

export type DirectionId = 'glyph' | 'flux' | 'facet' | 'badge' | 'engram';

/**
 * "Avatar DNA": the only thing you need to persist per agent. Everything else
 * is regenerated deterministically. Keep `v` so generator changes never
 * silently change an existing user's agent face.
 */
export interface AvatarDNA {
  v: 1;
  direction: DirectionId;
  /** stable agent id (uuid / ulid). Seed = hash(id + ':' + reroll) */
  agentId: string;
  /** incremented by the "reroll" button; 0 = first face */
  reroll?: number;
  name?: string;
  personality?: string;
  traits?: Partial<Traits>;
  color?: ColorOverride;
  /**
   * Engram brain stats (see grimoire Engram: memory neurons = explicit,
   * skill neurons = procedural). `engram` direction is built from these;
   * every other direction reflects `growth` subtly. Update as the agent learns.
   */
  engram?: EngramStats;
  /** Glyph customizer choices (any omitted part falls back to the seeded default) */
  glyph?: Partial<GlyphParts>;
}

export interface EngramStats {
  memories?: number; // explicit / declarative engrams
  skills?: number; // procedural engrams (minted skills)
  recalls?: number; // lifetime retrievals -> synapse thickness (plasticity)
  topics?: string[]; // memory clusters (labels) -> satellite clusters
}

export interface SeedCtx {
  /** 0..1 log-scaled learning progress derived from engram stats */
  growth: number;
  rng: Rng;
  traits: Traits;
  palette: Palette;
  motion: Motion;
  dna: AvatarDNA;
}

export interface DrawOpts {
  /** unique per rendered instance (gradient ids) */
  uid: string;
  theme: Theme;
  /** small sizes (<= 40px): simplified silhouette, thicker strokes */
  compact?: boolean;
}

export interface BaseSpec {
  growth: number;
  palette: Palette;
  motion: Motion;
  traits: Traits;
}

export interface Direction<S extends BaseSpec = any> {
  id: DirectionId;
  name: string;
  tagline: string;
  grammar: string[];
  makeSpec(ctx: SeedCtx): S;
  /** draw content in a 0..100 viewBox WITHOUT the global bob/tilt/squash transform */
  draw(spec: S, e: Expr, o: DrawOpts): El[];
  /** pivot for global tilt / squash (viewBox units) */
  pivot: [number, number];
}
