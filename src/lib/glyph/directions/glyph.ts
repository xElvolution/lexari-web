/**
 * 01 GLYPH — a letterform-creature fused from Lexari-mark squircles.
 * Every part is a customizer parameter (see glyph-parts.ts):
 *   body (12 compositions) · roundness · eyes (12) · eyeSize · eyeGap ·
 *   mouth (12) · brows (7) · accent (8) · orbit (6) + palette scheme/hue.
 * Unset parts fall back to a seeded, personality-weighted default, so a new
 * agent always has a face and "Randomize" is just a reroll.
 * Orbiting memory dots: count = Engram growth (1 → 5).
 */
import type { Expr } from '../core/expr';
import { mix } from '../core/color';
import { needsRim } from '../core/palette';
import { clamp } from '../core/rng';
import { arcEye, h, mouthPath, polyPoints, r2, roundRectPath, sparkle } from '../core/svg';
import type { El } from '../core/svg';
import type { BaseSpec, Direction, DrawOpts, SeedCtx } from '../core/types';
import { randomGlyphParts } from './glyph-parts';
import type { BodyId, GlyphParts } from './glyph-parts';

/** body rect in grid units; face block is always the 2×2 square at (0,0) */
interface BRect { x: number; y: number; w: number; h: number; radii?: [number, number, number, number]; rot?: number }
const F: BRect = { x: 0, y: 0, w: 2, h: 2 };
const BODIES: Record<BodyId, BRect[]> = {
  block: [F],
  tall: [F, { x: 0, y: 2, w: 2, h: 0.9 }],
  wide: [{ x: -0.55, y: 0.1, w: 3.1, h: 1.8 }],
  pill: [{ x: -0.3, y: 0, w: 2.6, h: 2, radii: [9, 9, 9, 9] }],
  leaf: [{ ...F, radii: [1.6, 0.25, 1.6, 0.25] }],
  diamond: [{ x: 0.12, y: 0.12, w: 1.76, h: 1.76, rot: 45 }],
  tee: [F, { x: -0.85, y: 0, w: 0.85, h: 0.9 }, { x: 2, y: 0, w: 0.85, h: 0.9 }],
  'l-left': [F, { x: -0.95, y: 1.05, w: 0.95, h: 0.95 }],
  'l-right': [F, { x: 2, y: 1.05, w: 0.95, h: 0.95 }],
  tail: [F, { x: 0, y: 2, w: 0.95, h: 0.9 }],
  step: [F, { x: -0.9, y: 1.1, w: 0.9, h: 0.9 }, { x: 2, y: 0, w: 0.9, h: 0.9 }],
  pedestal: [F, { x: 0.5, y: 2, w: 1, h: 0.55 }, { x: 0.15, y: 2.55, w: 1.7, h: 0.5 }],
};

export interface GlyphSpec extends BaseSpec {
  parts: GlyphParts;
  rects: BRect[];
  u: number;
  ox: number;
  oy: number;
  rc: number;
  sats: { n: number; r: number; ang0: number; rx: number; ry: number };
}

function layout(parts: GlyphParts) {
  const rects = BODIES[parts.body];
  const ext = rects.map((r) => (r.rot ? { x0: 1 - 1.25, y0: 1 - 1.25, x1: 1 + 1.25, y1: 1 + 1.25 } : { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
  const x0 = Math.min(...ext.map((e) => e.x0));
  const x1 = Math.max(...ext.map((e) => e.x1));
  const y0 = Math.min(...ext.map((e) => e.y0));
  const y1 = Math.max(...ext.map((e) => e.y1));
  const u = Math.min(68 / (x1 - x0), 58 / (y1 - y0), 27);
  const ox = 50 - ((x0 + x1) / 2) * u;
  const oy = 58 - ((y0 + y1) / 2) * u;
  return { rects, u, ox, oy, gw: x1 - x0 };
}

function makeSpec({ rng, traits, palette, motion, growth, dna }: SeedCtx): GlyphSpec {
  const parts: GlyphParts = { ...randomGlyphParts(rng.fork('parts'), traits), ...(dna.glyph ?? {}) };
  const L = layout(parts);
  return {
    palette, motion, traits, growth, parts,
    rects: L.rects, u: L.u, ox: L.ox, oy: L.oy,
    rc: L.u * (0.22 + parts.roundness * 0.3),
    sats: { n: 1 + Math.round(growth * 4), r: rng.range(2.7, 3.2), ang0: rng.range(0.3, 1.2), rx: Math.min(46, (L.gw * L.u) / 2 + rng.range(8, 10)), ry: rng.range(5.5, 7) },
  };
}

/* ------------------------------------------------------------------ body */
function bodyShapes(s: GlyphSpec, fill: string, extra: Record<string, string | number> = {}, dx = 0, dy = 0): El[] {
  const { u, ox, oy, rc } = s;
  const out: El[] = [];
  const R = s.rects.map((r) => ({ x: ox + r.x * u + dx, y: oy + r.y * u + dy, w: r.w * u, h: r.h * u, r }));
  for (const q of R) {
    const rr = (q.r.radii ?? [1, 1, 1, 1]).map((k) => Math.min(rc * k, q.w / 2, q.h / 2)) as [number, number, number, number];
    const tf = q.r.rot ? `rotate(${q.r.rot} ${r2(q.x + q.w / 2)} ${r2(q.y + q.h / 2)})` : undefined;
    out.push(h('path', { d: roundRectPath(q.x, q.y, q.w, q.h, rr), fill, transform: tf, ...extra }));
  }
  // fuse touching rects with square bridges over the shared edge
  for (let i = 0; i < R.length; i++) {
    for (let j = 0; j < R.length; j++) {
      if (i === j) continue;
      const A = R[i];
      const B = R[j];
      const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
      if (near(A.x + A.w, B.x)) {
        const y0 = Math.max(A.y, B.y);
        const y1 = Math.min(A.y + A.h, B.y + B.h);
        if (y1 - y0 > 1) {
          const m = Math.min(rc, A.w / 2, B.w / 2);
          out.push(h('rect', { x: r2(B.x - m), y: r2(y0), width: r2(2 * m), height: r2(y1 - y0), fill, ...extra }));
        }
      }
      if (near(A.y + A.h, B.y)) {
        const x0 = Math.max(A.x, B.x);
        const x1 = Math.min(A.x + A.w, B.x + B.w);
        if (x1 - x0 > 1) {
          const m = Math.min(rc, A.h / 2, B.h / 2);
          out.push(h('rect', { x: r2(x0), y: r2(B.y - m), width: r2(x1 - x0), height: r2(2 * m), fill, ...extra }));
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ eyes */
function eyesEl(s: GlyphSpec, e: Expr, fx: number, fy: number, r: number, gap: number): El[] {
  const p = s.palette;
  const style = s.parts.eyes;
  const open = Math.max(0.08, clamp(e.eyeOpen));
  const lx = e.lookX;
  const ly = e.lookY;
  const out: El[] = [];
  const arc = (x: number, y: number, rr: number) =>
    h('path', { d: arcEye(x, y + rr * 0.2, rr * 0.95, rr * 0.9), fill: 'none', stroke: p.feature, strokeWidth: r2(Math.max(1.8, rr * 0.5)), strokeLinecap: 'round' });
  const pupilEye = (x: number, y: number, rr: number, pr = 0.48, hl = false): El[] => {
    const g: El[] = [h('ellipse', { cx: r2(x), cy: r2(y), rx: r2(rr), ry: r2(rr * open), fill: p.feature })];
    if (open > 0.25) {
      const px = x + lx * rr * 0.42;
      const py = y + ly * rr * 0.36 * open;
      g.push(h('ellipse', { cx: r2(px), cy: r2(py), rx: r2(rr * pr), ry: r2(rr * pr * open), fill: p.pupil }));
      if (hl) g.push(h('circle', { cx: r2(px + rr * pr * 0.35), cy: r2(py - rr * pr * 0.35 * open), r: r2(rr * pr * 0.32), fill: p.feature === '#FFFFFF' ? '#FFFFFF' : p.white }));
    }
    return g;
  };
  const pairX = [fx - gap, fx + gap];
  let normal: El[] = [];
  let happy: El[] = [];
  switch (style) {
    case 'logo':
      normal = pairX.map((x) => h('ellipse', { cx: r2(x + lx * r * 0.25), cy: r2(fy + ly * r * 0.2), rx: r2(r), ry: r2(r * open), fill: p.feature }));
      happy = pairX.map((x) => arc(x, fy, r));
      break;
    case 'pupil':
      normal = pairX.flatMap((x) => pupilEye(x, fy, r));
      happy = pairX.map((x) => arc(x, fy, r));
      break;
    case 'dot':
      normal = pairX.map((x) => h('ellipse', { cx: r2(x + lx * 1.5), cy: r2(fy + ly * 1.2), rx: r2(r * 0.52), ry: r2(r * 0.52 * open), fill: p.feature }));
      happy = pairX.map((x) => arc(x, fy, r * 0.7));
      break;
    case 'ring':
      normal = pairX.flatMap((x) => [
        h('ellipse', { cx: r2(x), cy: r2(fy), rx: r2(r * 0.82), ry: r2(r * 0.82 * open), fill: 'none', stroke: p.feature, strokeWidth: r2(r * 0.34) }),
        h('ellipse', { cx: r2(x + lx * r * 0.3), cy: r2(fy + ly * r * 0.25), rx: r2(r * 0.3), ry: r2(r * 0.3 * open), fill: p.feature }),
      ]);
      happy = pairX.map((x) => arc(x, fy, r));
      break;
    case 'wide':
      normal = pairX.flatMap((x) => pupilEye(x, fy, r * 1.22, 0.42, true));
      happy = pairX.map((x) => arc(x, fy, r * 1.1));
      break;
    case 'sleepy': {
      const so = Math.min(open, 0.62);
      normal = pairX.flatMap((x) => [
        h('path', { d: `M${r2(x - r)} ${r2(fy - r * 0.05)}A${r2(r)} ${r2(r * so * 1.4)} 0 0 0 ${r2(x + r)} ${r2(fy - r * 0.05)}Z`, fill: p.feature }),
        h('ellipse', { cx: r2(x + lx * r * 0.35), cy: r2(fy + r * 0.32 * so), rx: r2(r * 0.42), ry: r2(r * 0.42 * so), fill: p.pupil }),
        h('line', { x1: r2(x - r * 1.1), y1: r2(fy - r * 0.05), x2: r2(x + r * 1.1), y2: r2(fy - r * 0.05), stroke: p.feature, strokeWidth: 1.6, strokeLinecap: 'round' }),
      ]);
      happy = pairX.map((x) => arc(x, fy, r));
      break;
    }
    case 'wink':
      normal = [...pupilEye(pairX[0], fy, r), h('path', { d: `M${r2(pairX[1] - r)} ${r2(fy - r * 0.15)}Q${r2(pairX[1])} ${r2(fy + r * 0.9)} ${r2(pairX[1] + r)} ${r2(fy - r * 0.15)}`, fill: 'none', stroke: p.feature, strokeWidth: r2(Math.max(1.8, r * 0.48)), strokeLinecap: 'round' })];
      happy = [arc(pairX[0], fy, r), h('path', { d: `M${r2(pairX[1] - r)} ${r2(fy - r * 0.15)}Q${r2(pairX[1])} ${r2(fy + r * 0.9)} ${r2(pairX[1] + r)} ${r2(fy - r * 0.15)}`, fill: 'none', stroke: p.feature, strokeWidth: r2(Math.max(1.8, r * 0.48)), strokeLinecap: 'round' })];
      break;
    case 'pixel':
      normal = pairX.flatMap((x) => {
        const hh = 2 * r * 0.95 * open;
        const g: El[] = [h('rect', { x: r2(x - r * 0.95), y: r2(fy - hh / 2), width: r2(r * 1.9), height: r2(Math.max(1, hh)), rx: r2(r * 0.25), fill: p.feature })];
        if (open > 0.3) g.push(h('rect', { x: r2(x - r * 0.38 + lx * r * 0.45), y: r2(fy - r * 0.38 * open + ly * r * 0.35), width: r2(r * 0.76), height: r2(r * 0.76 * open), fill: p.pupil }));
        return g;
      });
      happy = pairX.map((x) => h('polyline', { points: polyPoints([[x - r, fy + r * 0.4], [x, fy - r * 0.6], [x + r, fy + r * 0.4]]), fill: 'none', stroke: p.feature, strokeWidth: r2(r * 0.5), strokeLinejoin: 'miter', strokeLinecap: 'square' }));
      break;
    case 'visor': {
      const vw = gap * 2 + r * 2.6;
      const vh = r * 2.1;
      const oh = Math.max(1.4, vh * open);
      normal = [
        h('rect', { x: r2(fx - vw / 2), y: r2(fy - oh / 2), width: r2(vw), height: r2(oh), rx: r2(oh / 2), fill: p.feature }),
        ...(open > 0.3 ? pairX.map((x) => h('circle', { cx: r2(x * 0.9 + fx * 0.1 + lx * 3), cy: r2(fy + ly * 1.6), r: r2(r * 0.5 * open), fill: p.pupil })) : []),
      ];
      happy = pairX.map((x) => arc(x, fy, r * 0.95));
      break;
    }
    case 'mono':
      normal = pupilEye(fx, fy, r * 1.75, 0.46, true);
      happy = [arc(fx, fy, r * 1.5)];
      break;
    case 'odd':
      normal = [...pupilEye(pairX[0] - r * 0.15, fy, r * 1.28), ...pupilEye(pairX[1] + r * 0.1, fy + r * 0.3, r * 0.72)];
      happy = [arc(pairX[0], fy, r * 1.2), arc(pairX[1], fy + 1, r * 0.75)];
      break;
    case 'star':
      normal = pairX.map((x) => h('path', { d: sparkle(0, 0, r * 1.25), fill: p.feature, transform: `translate(${r2(x + lx * 1.6)} ${r2(fy + ly * 1.3)}) scale(1 ${r2(open)})` }));
      happy = pairX.map((x) => h('path', { d: sparkle(0, 0, r * 1.5), fill: p.feature, transform: `translate(${r2(x)} ${r2(fy)}) rotate(${r2(e.t * 60)})` }));
      break;
  }
  out.push(h('g', { opacity: r2(1 - e.smile) }, normal));
  out.push(h('g', { opacity: r2(e.smile) }, happy));
  return out;
}

/* ----------------------------------------------------------------- brows */
function browsEl(s: GlyphSpec, e: Expr, fx: number, by: number, gap: number, r: number): El[] {
  const p = s.palette;
  const style = s.parts.brows;
  if (style === 'none') return [];
  const lift = -e.happy * 1.4 - e.think * 0.8;
  const col = p.feature;
  const w = Math.max(5.5, r * 1.5);
  const sideLift = (sd: number) => (e.think > 0 ? (sd === s.motion.lookSide ? -1.8 * e.think : 0) : 0);
  if (style === 'uni') return [h('rect', { x: r2(fx - gap - w / 2), y: r2(by + lift - 1), width: r2(gap * 2 + w), height: 2.2, rx: 1.1, fill: col })];
  return [-1, 1].map((sd) => {
    const x = fx + sd * gap;
    const y = by + lift + sideLift(sd);
    switch (style) {
      case 'flat': return h('rect', { x: r2(x - w / 2), y: r2(y - 0.9), width: r2(w), height: 1.9, rx: 0.95, fill: col });
      case 'thick': return h('rect', { x: r2(x - w * 0.55), y: r2(y - 1.6), width: r2(w * 1.1), height: 3.2, rx: 1.2, fill: col });
      case 'sharp': return h('rect', { x: r2(x - w / 2), y: r2(y - 0.95), width: r2(w), height: 1.9, rx: 0.95, fill: col, transform: `rotate(${sd * 16} ${r2(x)} ${r2(y)})` });
      case 'raised': return h('rect', { x: r2(x - w / 2), y: r2(y - 2), width: r2(w), height: 1.9, rx: 0.95, fill: col, transform: `rotate(${-sd * 14} ${r2(x)} ${r2(y)})` });
      case 'soft':
      default: return h('path', { d: `M${r2(x - w / 2)} ${r2(y + 0.8)}Q${r2(x)} ${r2(y - 2.4)} ${r2(x + w / 2)} ${r2(y + 0.8)}`, fill: 'none', stroke: col, strokeWidth: 1.8, strokeLinecap: 'round' });
    }
  });
}

/* ----------------------------------------------------------------- mouth */
function mouthEl(s: GlyphSpec, e: Expr, x: number, y: number, w: number): El[] {
  const p = s.palette;
  const talk = clamp(e.mouth);
  const cav = p.cavity;
  const tongueCol = p.tongue || (p.scheme === 'brand' ? p.accent : mix(p.accent, '#FF8AD8', 0.25));
  const stroke = { fill: 'none', stroke: p.feature, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const talkOverlay = (k = 1) => (talk > 0.12 ? [h('ellipse', { cx: r2(x), cy: r2(y + 1 + talk * 1.6), rx: r2(w * 0.26 + talk * 1.2), ry: r2(0.8 + talk * 3), fill: cav, stroke: p.feature, strokeWidth: 1.2, opacity: r2(clamp(talk * 2) * k) })] : []);
  const curve = e.curve;
  switch (s.parts.mouth) {
    case 'smile': return [h('path', { d: mouthPath(x, y, w * (1 + e.happy * 0.2), talk * 0.75, Math.max(0.55, curve), 1.8), fill: p.feature })];
    case 'line': return [h('rect', { x: r2(x - w / 2), y: r2(y - 0.9 - talk * 2.2 + e.happy * -0.4), width: r2(w), height: r2(1.9 + talk * 4.4), rx: r2(0.95 + talk * 1.8), fill: p.feature, transform: e.happy > 0.01 ? `rotate(${r2(-e.happy * 6)} ${r2(x)} ${r2(y)})` : undefined })];
    case 'open': {
      const d = 2.4 + talk * 4.5 + e.happy * 1.2;
      return [
        h('path', { d: `M${r2(x - w / 2)} ${r2(y)}H${r2(x + w / 2)}Q${r2(x + w / 2)} ${r2(y + d)} ${r2(x)} ${r2(y + d)}Q${r2(x - w / 2)} ${r2(y + d)} ${r2(x - w / 2)} ${r2(y)}Z`, fill: cav, stroke: p.feature, strokeWidth: 1.4, strokeLinejoin: 'round' }),
        h('ellipse', { cx: r2(x), cy: r2(y + d * 0.72), rx: r2(w * 0.24), ry: r2(d * 0.22), fill: tongueCol }),
      ];
    }
    case 'cat': {
      const q = w * 0.5;
      return [h('path', { d: `M${r2(x - q)} ${r2(y - 0.6)}Q${r2(x - q / 2)} ${r2(y + 2.6)} ${r2(x)} ${r2(y)}Q${r2(x + q / 2)} ${r2(y + 2.6)} ${r2(x + q)} ${r2(y - 0.6)}`, ...stroke }), ...talkOverlay(0.9)];
    }
    case 'grin': {
      const gw = w * 1.35;
      const gh = 3.4 + talk * 3;
      const gx = x - gw / 2;
      return [
        h('rect', { x: r2(gx), y: r2(y - gh / 2 + 0.5), width: r2(gw), height: r2(gh), rx: r2(gh / 2.2), fill: '#FFFFFF', stroke: cav, strokeWidth: 0.9 }),
        h('line', { x1: r2(gx + 1), y1: r2(y + 0.5), x2: r2(gx + gw - 1), y2: r2(y + 0.5), stroke: cav, strokeWidth: 0.8 }),
        ...[0.25, 0.5, 0.75].map((k) => h('line', { x1: r2(gx + gw * k), y1: r2(y - gh / 2 + 0.6), x2: r2(gx + gw * k), y2: r2(y + gh / 2 + 0.4), stroke: cav, strokeWidth: 0.7 })),
      ];
    }
    case 'o': return [h('ellipse', { cx: r2(x), cy: r2(y + 0.8), rx: r2(w * 0.2 + talk * 1.4), ry: r2(w * 0.22 + talk * 2.2), fill: cav, stroke: p.feature, strokeWidth: 1.5 })];
    case 'smirk': return [h('path', { d: `M${r2(x - w / 2)} ${r2(y + 0.6)}Q${r2(x + w * 0.05)} ${r2(y + 2.4 + e.happy)} ${r2(x + w / 2)} ${r2(y - 2.2 - e.happy)}`, ...stroke }), ...talkOverlay()];
    case 'dot': return [h('ellipse', { cx: r2(x), cy: r2(y + 0.5), rx: r2(1.7 + talk * 1.4 + e.happy * 0.8), ry: r2(1.7 + talk * 2.6), fill: p.feature })];
    case 'fang': return [
      h('path', { d: mouthPath(x, y, w * 1.05, 0.25 + talk * 0.6, Math.max(0.6, curve), 2), fill: cav, stroke: p.feature, strokeWidth: 1.2 }),
      h('polygon', { points: polyPoints([[x + w * 0.12, y - 0.4], [x + w * 0.32, y - 0.4], [x + w * 0.22, y + 2.4]]), fill: '#FFFFFF' }),
    ];
    case 'wave': {
      const amp = 1 + talk * 1.6 + e.happy * 0.6;
      const n = 4;
      const pts: [number, number][] = Array.from({ length: n + 1 }, (_, i) => [x - w / 2 + (w * i) / n, y + (i % 2 ? amp : -amp * 0.4)]);
      return [h('polyline', { points: polyPoints(pts), ...stroke })];
    }
    case 'tongue': return [
      h('path', { d: mouthPath(x, y, w, 0.3 + talk * 0.5, Math.max(0.6, curve), 2), fill: cav, stroke: p.feature, strokeWidth: 1.2 }),
      h('path', { d: `M${r2(x - w * 0.06)} ${r2(y + 1.2)}h${r2(w * 0.34)}v${r2(2 + talk * 1.5)}a${r2(w * 0.17)} ${r2(w * 0.17)} 0 0 1 ${r2(-w * 0.34)} 0Z`, fill: tongueCol }),
    ];
    case 'none':
    default: return talkOverlay();
  }
}

/* --------------------------------------------------------------- accents */
function accentBack(s: GlyphSpec, e: Expr, fx: number, top: number): El[] {
  const p = s.palette;
  const { u } = s;
  const a = s.parts.accent;
  const t = e.t * s.motion.speed;
  const wig = e.happy * Math.sin(t * 9) * 12 + e.speak * Math.sin(t * 6) * e.mouth * 4;
  const out: El[] = [];
  if (a === 'antenna' || a === 'twin-antenna') {
    const tips = a === 'antenna' ? [0] : [-0.5, 0.5];
    for (const k of tips) {
      const bx = fx + k * u;
      const sway = Math.sin(t * 2.2 + k * 3) * 6 * s.motion.amp + wig + (a === 'twin-antenna' ? k * 30 : 0);
      const len = u * 0.55;
      const tf = `rotate(${r2(sway)} ${r2(bx)} ${r2(top + 2)})`;
      const pulse = 1 + e.think * 0.35 * (0.5 + 0.5 * Math.sin(t * 7));
      out.push(h('g', { transform: tf },
        h('rect', { x: r2(bx - 1.2), y: r2(top - len), width: 2.4, height: r2(len + 3), rx: 1.2, fill: p.accent }),
        h('circle', { cx: r2(bx), cy: r2(top - len - 1.6), r: r2(3 * pulse), fill: p.accent }),
        h('circle', { cx: r2(bx), cy: r2(top - len - 1.6), r: r2(1.1 * pulse), fill: p.tip }),
      ));
    }
  }
  if (a === 'ears' || a === 'pointy-ears') {
    for (const sd of [-1, 1]) {
      const ex = fx + sd * u * 0.7;
      const tf = `rotate(${r2(sd * (8 + wig * 0.6))} ${r2(ex)} ${r2(top + u * 0.15)})`;
      if (a === 'ears') {
        const sz = u * 0.62;
        out.push(h('rect', { x: r2(ex - sz / 2), y: r2(top - sz * 0.5), width: r2(sz), height: r2(sz), rx: r2(sz * 0.32), fill: p.bodyLo, transform: tf }));
        out.push(h('circle', { cx: r2(ex), cy: r2(top - sz * 0.08), r: r2(sz * 0.18), fill: p.accent, transform: tf }));
      } else {
        const bw = u * 0.62;
        const ht = u * 0.62;
        out.push(h('path', { d: `M${r2(ex - bw / 2)} ${r2(top + 2)}L${r2(ex + sd * bw * 0.12)} ${r2(top - ht)}L${r2(ex + bw / 2)} ${r2(top + 2)}Z`, fill: p.bodyLo, stroke: p.bodyLo, strokeWidth: 2.4, strokeLinejoin: 'round', transform: tf }));
        out.push(h('path', { d: `M${r2(ex - bw * 0.22)} ${r2(top + 1)}L${r2(ex + sd * bw * 0.08)} ${r2(top - ht * 0.55)}L${r2(ex + bw * 0.22)} ${r2(top + 1)}Z`, fill: p.accent, strokeLinejoin: 'round', transform: tf }));
      }
    }
  }
  if (a === 'side-tiles') {
    const cy = s.oy + s.u;
    const half = Math.max(...s.rects.map((r) => (r.rot ? 1.25 : Math.max(Math.abs(r.x - 1), Math.abs(r.x + r.w - 1))))) * u;
    for (const sd of [-1, 1]) {
      const sz = u * 0.58;
      const x = fx + sd * (half + sz * 0.12) - sz / 2;
      out.push(h('rect', { x: r2(x), y: r2(cy - sz * 0.75 + Math.sin(t * 2 + sd) * e.happy * 2), width: r2(sz), height: r2(sz * 1.5), rx: r2(sz * 0.4), fill: p.accent }));
    }
  }
  if (a === 'echo') out.push(h('g', { opacity: p.scheme === 'midnight' ? 0.55 : 0.42 }, bodyShapes(s, p.accent, {}, u * 0.28 * s.motion.lookSide, -u * 0.24)));
  return out;
}

function accentFront(s: GlyphSpec, e: Expr): El[] {
  if (s.parts.accent !== 'mark-chip') return [];
  const p = s.palette;
  const { u } = s;
  const sz = u * 0.66;
  const t = e.t * s.motion.speed;
  const cx = s.ox + 2 * u - sz * 0.15;
  const cy = s.oy + 2 * u - sz * 0.2;
  const rot = 10 + e.happy * 14 * Math.sin(t * 8);
  const pulse = 1 + e.speak * e.mouth * 0.25;
  return [h('g', { transform: `rotate(${r2(rot)} ${r2(cx)} ${r2(cy)})` },
    h('rect', { x: r2(cx - sz / 2), y: r2(cy - sz / 2), width: r2(sz), height: r2(sz), rx: r2(sz * 0.3), fill: p.accent }),
    h('circle', { cx: r2(cx), cy: r2(cy), r: r2(sz * 0.18 * pulse), fill: p.tip }),
  )];
}

/* ----------------------------------------------------------------- orbit */
function orbit(s: GlyphSpec, e: Expr, bottomY: number): { back: El[]; front: El[] } {
  const p = s.palette;
  const style = s.parts.orbit;
  const back: El[] = [];
  const front: El[] = [];
  if (style === 'none') return { back, front };
  const S = s.sats;
  const t = e.t * s.motion.speed;
  const spin = t * (0.35 + e.think * 1.9 + e.happy * 0.6);
  // ring sits around the lower body so front dots pass below the mouth
  const cy = bottomY - s.u * 0.3;
  const dotFill = (front: boolean) => (front ? p.accentSoft : p.accent);
  const edge = { stroke: p.scheme === 'mono' ? p.accent : p.bodyLo, strokeWidth: 0.9 };
  if (style === 'ring') {
    back.push(h('path', { d: `M${r2(50 - S.rx)} ${r2(cy)}A${r2(S.rx)} ${r2(S.ry)} 0 0 1 ${r2(50 + S.rx)} ${r2(cy)}`, fill: 'none', stroke: p.accent, strokeWidth: 0.9, strokeDasharray: '1.5 2', opacity: 0.55 }));
    front.push(h('path', { d: `M${r2(50 + S.rx)} ${r2(cy)}A${r2(S.rx)} ${r2(S.ry)} 0 0 1 ${r2(50 - S.rx)} ${r2(cy)}`, fill: 'none', stroke: p.accentSoft, strokeWidth: 1, strokeDasharray: '1.5 2', opacity: 0.9 }));
  }
  const n = style === 'comet' ? 1 : S.n;
  for (let i = 0; i < n; i++) {
    const a = S.ang0 + (i * Math.PI * 2) / n + spin;
    const depth = Math.sin(a);
    const x = 50 + Math.cos(a) * S.rx;
    const y = cy + depth * S.ry;
    const list = depth > 0 ? front : back;
    const op = depth > 0 ? 1 : 0.45;
    const deco = depth > 0 ? edge : {};
    const rr = S.r * (0.8 + 0.25 * depth);
    if (style === 'tiles') list.push(h('rect', { x: r2(x - rr), y: r2(y - rr), width: r2(rr * 2), height: r2(rr * 2), rx: r2(rr * 0.4), fill: dotFill(depth > 0), opacity: op, ...deco, transform: `rotate(${r2(a * 57)} ${r2(x)} ${r2(y)})` }));
    else if (style === 'pulse') list.push(h('circle', { cx: r2(x), cy: r2(y), r: r2(rr * (0.75 + 0.45 * (0.5 + 0.5 * Math.sin(t * 4 + i * 1.3)))), fill: dotFill(depth > 0), opacity: op, ...deco }));
    else if (style === 'comet') {
      // head + a trail whose length = Engram growth
      for (let k = S.n; k >= 0; k--) {
        const ak = a - k * 0.28;
        const dk = Math.sin(ak);
        const L = dk > 0 ? front : back;
        L.push(h('circle', { cx: r2(50 + Math.cos(ak) * S.rx), cy: r2(cy + dk * S.ry), r: r2(S.r * (k === 0 ? 1.05 : 0.75 - k * 0.1)), fill: dotFill(dk > 0), ...(dk > 0 && k === 0 ? edge : {}), opacity: r2((dk > 0 ? 1 : 0.4) * (k === 0 ? 1 : 0.7 - k * 0.1)) }));
      }
    } else list.push(h('circle', { cx: r2(x), cy: r2(y), r: r2(rr), fill: dotFill(depth > 0), opacity: op, ...deco }));
  }
  return { back, front };
}

/* ------------------------------------------------------------------ draw */
function draw(s: GlyphSpec, e: Expr, o: DrawOpts): El[] {
  const p = s.palette;
  const { u } = s;
  const P = s.parts;
  const rim = needsRim(p, o.theme);
  const grad = `${o.uid}-g`;
  const fx0 = s.ox + u; // face centre
  const fy0 = s.oy + u;
  const tops = s.rects.map((r) => (r.rot ? s.oy + u - 1.25 * u : s.oy + r.y * u));
  const top = Math.min(...tops);
  const bottom = Math.max(...s.rects.map((r) => (r.rot ? s.oy + u + 1.25 * u : s.oy + (r.y + r.h) * u)));
  const faceTop = s.oy + (P.body === 'diamond' ? -0.1 * u : P.body === 'wide' ? 0.1 * u : 0);
  const out: El[] = [
    h('defs', {}, h('linearGradient', { id: grad, x1: 0, y1: r2(top), x2: 0, y2: r2(bottom), gradientUnits: 'userSpaceOnUse' }, h('stop', { offset: 0, stopColor: p.bodyHi }), h('stop', { offset: 0.5, stopColor: p.body }), h('stop', { offset: 1, stopColor: p.bodyLo }))),
  ];
  const orb = orbit(s, e, Math.min(bottom, s.oy + 2 * u));
  out.push(...orb.back);
  out.push(...accentBack(s, e, fx0, faceTop));
  if (rim) out.push(...bodyShapes(s, p.rim, { stroke: p.rim, strokeWidth: 2.6, strokeLinejoin: 'round' }));
  out.push(...bodyShapes(s, `url(#${grad})`));
  if (p.scheme !== 'mono' && P.body !== 'diamond') out.push(h('rect', { x: r2(s.ox + u * 0.28), y: r2(s.oy + (P.body === 'wide' ? 0.22 : 0.12) * u), width: r2(u * 0.6), height: r2(u * 0.11), rx: r2(u * 0.055), fill: p.white, opacity: 0.22 }));

  // face
  const k = u / 20;
  const er = (P.eyes === 'mono' ? 6 : 5.6) * k * P.eyeSize;
  const gap = (8.2 + P.eyeGap * 4.2) * k * (P.eyes === 'odd' ? 1.05 : 1);
  const fx = fx0 + e.lookX * 3 * k;
  const fy = fy0 - u * 0.2 + e.lookY * 2.4 * k;
  out.push(...eyesEl(s, e, fx, fy, er, gap));
  const browGap = P.eyes === 'mono' ? er * 0.9 : gap;
  out.push(...browsEl(s, e, fx, fy - (P.eyes === 'mono' ? er * 1.75 : P.eyes === 'wide' ? er * 1.22 : er) - 3.2 * k, browGap, P.eyes === 'mono' ? er * 1.1 : er));
  // mouths are designed at unit scale (u = 20) and scaled as one group
  const mx = fx0 + e.lookX * 2.2 * k;
  const my = fy0 + u * 0.46 + e.lookY * 1.1;
  const ms = k * 1.22;
  out.push(h('g', { transform: `translate(${r2(mx)} ${r2(my)}) scale(${r2(ms)}) translate(${r2(-mx)} ${r2(-my)})` }, mouthEl(s, e, mx, my, P.mouth === 'grin' ? 8.2 : 9)));
  out.push(...accentFront(s, e));
  out.push(...orb.front);

  // thinking: three fragment tiles assembling beside the head
  if (e.think > 0.01) {
    const side = s.motion.lookSide;
    const edge = fx0 + side * (u * 1.15 + 2);
    for (let i = 0; i < 3; i++) {
      const kk = clamp(Math.sin(e.t * 4 - i * 0.9) * 0.5 + 0.5);
      out.push(h('rect', { x: r2(edge + side * i * 5.4 - 2.3), y: r2(top - 2 - i * 4.2 - kk * 1.5), width: 4.6, height: 4.6, rx: 1.4, fill: p.accent, opacity: r2(e.think * (0.3 + 0.7 * kk)) }));
    }
  }
  if (e.happy > 0.01) {
    const left = fx0 - u * 1.25;
    const right = fx0 + u * 1.25;
    const bits: [number, number, number, number][] = [[left - 5, top + 6, 3.8, 15], [right + 5, top + 3, 3.2, -20], [right - 2, top - 6, 2.6, 30], [left + 4, top - 5, 2.2, -10]];
    bits.forEach(([x, y, r, rot], i) => {
      const kk = 0.55 + 0.45 * Math.sin(e.t * 6 + i * 1.7);
      out.push(h('rect', { x: r2(x - r * kk), y: r2(y - r * kk), width: r2(2 * r * kk), height: r2(2 * r * kk), rx: r2(r * kk * 0.35), fill: i % 2 ? p.accent : p.accentSoft, opacity: r2(e.happy), transform: `rotate(${rot + e.t * 40} ${r2(x)} ${r2(y)})` }));
    });
  }
  return out;
}

export const glyph: Direction<GlyphSpec> = {
  id: 'glyph',
  name: 'Glyph',
  tagline: 'A letterform-creature fused from Lexari-mark squircles; the logo dot is its eye.',
  grammar: ['body: 12 squircle compositions × roundness', 'eyes: 12 styles × size × spacing · brows: 7', 'mouth: 12 styles · accent: 8 (antenna, ears, chip, echo…)', 'orbit: 6 styles; count = Engram growth (1 → 5)'],
  makeSpec,
  draw,
  pivot: [50, 84],
};

export type { GlyphParts };
