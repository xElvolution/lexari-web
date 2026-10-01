/**
 * Hand-picked Glyph faces for the landing page and the marketplace cast.
 * Clean bodies, friendly eyes and mouths, vivid colours and gradients.
 * Index i matches the roster / SPECIALISTS order, so an agent looks the same everywhere.
 */
import type { FaceDNA } from './face';
import type { GlyphParts, VividKey, Finish } from './index';

const f = (id: string, g: Partial<GlyphParts> & Pick<GlyphParts, 'body' | 'eyes' | 'mouth'>, body: VividKey, accent: VividKey, finish: Finish = 'solid', personality = 'friendly'): FaceDNA => ({
  v: 1, direction: 'glyph', agentId: `lexari-cast:${id}`, personality,
  glyph: { roundness: 0.5, eyeSize: 1, eyeGap: 0.5, brows: 'none', accent: 'none', orbit: 'dots', ...g },
  color: { scheme: 'vivid', body, accent, finish },
});

/** your own agent before you customise it: the house face on the hero badge */
export const HOUSE: FaceDNA = f('house', { body: 'block', eyes: 'logo', mouth: 'smile', brows: 'soft', roundness: 0.6, eyeSize: 1.12, eyeGap: 0.45, accent: 'antenna', orbit: 'dots' }, 'lilac', 'magenta', 'gradient', 'warm friendly');

export const CAST: FaceDNA[] = [
  f('scout', { body: 'block', eyes: 'wide', mouth: 'smile', brows: 'raised', accent: 'antenna', orbit: 'dots', roundness: 0.5, eyeSize: 1.05 }, 'orange', 'pink', 'gradient', 'curious'),
  f('quill', { body: 'tall', eyes: 'pupil', mouth: 'smirk', brows: 'soft', accent: 'mark-chip', orbit: 'ring', roundness: 0.6, eyeGap: 0.4 }, 'sky', 'indigo', 'gradient', 'witty'),
  f('tally', { body: 'wide', eyes: 'ring', mouth: 'grin', accent: 'side-tiles', orbit: 'tiles', roundness: 0.35, eyeGap: 0.6 }, 'green', 'yellow', 'solid', 'precise'),
  f('frame', { body: 'pill', eyes: 'star', mouth: 'open', accent: 'ears', orbit: 'comet', roundness: 0.7, eyeSize: 1.05 }, 'yellow', 'lime', 'gradient', 'creative'),
  f('echo', { body: 'block', eyes: 'logo', mouth: 'cat', accent: 'ears', orbit: 'pulse', roundness: 0.65, eyeSize: 1.15, eyeGap: 0.4 }, 'red', 'orange', 'gradient', 'cheerful'),
  f('relay', { body: 'wide', eyes: 'pupil', mouth: 'smile', brows: 'flat', accent: 'twin-antenna', orbit: 'ring', roundness: 0.45 }, 'teal', 'blue', 'gradient', 'calm'),
  f('pink', { body: 'pill', eyes: 'wink', mouth: 'tongue', accent: 'pointy-ears', orbit: 'dots', roundness: 0.8 }, 'pink', 'purple', 'gradient', 'playful'),
  f('sky', { body: 'tall', eyes: 'dot', mouth: 'smile', brows: 'soft', accent: 'antenna', orbit: 'comet', roundness: 0.55, eyeSize: 1.1 }, 'sky', 'red', 'solid', 'gentle'),
  f('violet', { body: 'block', eyes: 'mono', mouth: 'open', accent: 'echo', orbit: 'dots', roundness: 0.5 }, 'purple', 'yellow', 'solid', 'curious'),
  f('candy', { body: 'pill', eyes: 'sleepy', mouth: 'smile', accent: 'ears', orbit: 'pulse', roundness: 0.75 }, 'lilac', 'magenta', 'gradient', 'kind'),
  f('coral', { body: 'wide', eyes: 'wide', mouth: 'grin', accent: 'mark-chip', orbit: 'tiles', roundness: 0.5, eyeSize: 0.95 }, 'coral', 'teal', 'solid', 'fun'),
  f('indigo', { body: 'tall', eyes: 'pixel', mouth: 'smile', accent: 'antenna', orbit: 'ring', roundness: 0.4 }, 'indigo', 'lime', 'solid', 'focused'),
];
export const castFace = (i: number) => CAST[((i % CAST.length) + CAST.length) % CAST.length];
