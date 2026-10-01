/**
 * Tiny renderer-agnostic SVG tree. Directions return `El` trees which are
 * serialised to strings (web / server / sheets) or mapped 1:1 onto
 * react-native-svg components (see src/react/AgentAvatar.tsx).
 * Only primitives supported by react-native-svg are used (no filters/masks).
 */
export type AttrValue = string | number | undefined;
export type Attrs = Record<string, AttrValue>;
export interface El {
  tag: SvgTag;
  attrs: Attrs;
  children: (El | string)[];
}
export type SvgTag =
  | 'svg' | 'g' | 'path' | 'circle' | 'ellipse' | 'rect' | 'line' | 'polygon' | 'polyline'
  | 'defs' | 'linearGradient' | 'radialGradient' | 'stop' | 'text' | 'clipPath';

export function h(tag: SvgTag, attrs: Attrs = {}, ...children: (El | string | null | undefined | false | (El | null | undefined | false)[])[]): El {
  const flat: (El | string)[] = [];
  for (const c of children) {
    if (Array.isArray(c)) c.forEach((x) => x && flat.push(x));
    else if (c) flat.push(c);
  }
  return { tag, attrs, children: flat };
}

const KEBAB = new Set([
  'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'strokeOpacity', 'fillOpacity', 'stopColor', 'stopOpacity',
  'fontSize', 'fontWeight', 'fontFamily', 'textAnchor', 'letterSpacing', 'strokeDasharray', 'fillRule', 'clipPath', 'clipRule',
]);
const kebab = (k: string) => (KEBAB.has(k) ? k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()) : k);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function toSvg(el: El | string): string {
  if (typeof el === 'string') return esc(el);
  const a = Object.entries(el.attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${kebab(k)}="${esc(String(v))}"`)
    .join(' ');
  const open = `<${el.tag}${a ? ' ' + a : ''}`;
  return el.children.length ? `${open}>${el.children.map(toSvg).join('')}</${el.tag}>` : `${open}/>`;
}

/** round for compact output */
export const r2 = (n: number) => Math.round(n * 100) / 100;
export type Pt = [number, number];

export function polyPoints(pts: Pt[]): string {
  return pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ');
}

export function polyPath(pts: Pt[], close = true): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('') + (close ? 'Z' : '');
}

/** Closed Catmull-Rom spline through points → cubic Bézier path */
export function smoothClosed(pts: Pt[], tension = 1): string {
  const n = pts.length;
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return d + 'Z';
}

/** Rounded rect path with per-corner radii [tl, tr, br, bl] */
export function roundRectPath(x: number, y: number, w: number, hh: number, rr: [number, number, number, number]): string {
  const [tl, tr, br, bl] = rr.map((v) => Math.max(0, Math.min(v, w / 2, hh / 2)));
  return (
    `M${r2(x + tl)} ${r2(y)}H${r2(x + w - tr)}` +
    (tr ? `A${r2(tr)} ${r2(tr)} 0 0 1 ${r2(x + w)} ${r2(y + tr)}` : '') +
    `V${r2(y + hh - br)}` +
    (br ? `A${r2(br)} ${r2(br)} 0 0 1 ${r2(x + w - br)} ${r2(y + hh)}` : '') +
    `H${r2(x + bl)}` +
    (bl ? `A${r2(bl)} ${r2(bl)} 0 0 1 ${r2(x)} ${r2(y + hh - bl)}` : '') +
    `V${r2(y + tl)}` +
    (tl ? `A${r2(tl)} ${r2(tl)} 0 0 1 ${r2(x + tl)} ${r2(y)}` : '') +
    'Z'
  );
}

/** Filled mouth: a lens whose top edge bends with `curve` and opens with `open`. */
export function mouthPath(cx: number, cy: number, w: number, open: number, curve: number, minH = 1.6): string {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const lift = curve * w * 0.22; // corners up when smiling
  const top = cy - lift;
  const bottom = cy + lift * 0.6 + minH + open * w * 0.55;
  return `M${r2(x0)} ${r2(top)}Q${r2(cx)} ${r2(cy + lift * 0.7)} ${r2(x1)} ${r2(top)}Q${r2(cx)} ${r2(bottom + lift)} ${r2(x0)} ${r2(top)}Z`;
}

/** Happy-eye arc (upside-down U) as an open path for stroking */
export function arcEye(cx: number, cy: number, rx: number, ry: number): string {
  return `M${r2(cx - rx)} ${r2(cy + ry * 0.35)}Q${r2(cx)} ${r2(cy - ry * 1.25)} ${r2(cx + rx)} ${r2(cy + ry * 0.35)}`;
}

/** 4-point sparkle star */
export function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  return `M${r2(cx)} ${r2(cy - r)}Q${r2(cx + k)} ${r2(cy - k)} ${r2(cx + r)} ${r2(cy)}Q${r2(cx + k)} ${r2(cy + k)} ${r2(cx)} ${r2(cy + r)}Q${r2(cx - k)} ${r2(cy + k)} ${r2(cx - r)} ${r2(cy)}Q${r2(cx - k)} ${r2(cy - k)} ${r2(cx)} ${r2(cy - r)}Z`;
}
