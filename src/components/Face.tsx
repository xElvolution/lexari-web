"use client";

import { useEffect, useRef, useState } from "react";
import { HOME, PALETTE, variantFor, type FaceState, type Shape, type Variant } from "./avatar";

type Props = { seed?: number; variant?: Partial<Variant>; size?: number; track?: boolean; look?: boolean; className?: string; state?: FaceState; animated?: boolean };

/** seconds since mount at ~30 fps while `on` (paused when the tab is hidden or motion is reduced) */
function useClock(on: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, last = 0; const t0 = performance.now();
    const loop = (now: number) => { raf = requestAnimationFrame(loop); if (now - last < 33 || document.hidden) return; last = now; setT((now - t0) / 1000); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return t;
}
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));

// where eyes, mouth and the top of the head sit for each head shape
const LAYOUT: Record<Shape, { eye: number; mouth: number; top: number; half: number }> = {
  round: { eye: 50, mouth: 68, top: 16, half: 38 },
  square: { eye: 50, mouth: 68, top: 18, half: 38 },
  tall: { eye: 46, mouth: 64, top: 10, half: 30 },
  blob: { eye: 50, mouth: 68, top: 16, half: 37 },
  hex: { eye: 50, mouth: 68, top: 14, half: 34 },
  tri: { eye: 62, mouth: 77, top: 12, half: 40 },
  robot: { eye: 52, mouth: 70, top: 20, half: 36 },
  egg: { eye: 52, mouth: 70, top: 14, half: 34 },
  wide: { eye: 54, mouth: 72, top: 28, half: 42 },
};

/** An agent face generated as SVG. Eyes can follow the pointer (track) or glance around (look). */
export default function Face({ seed, variant, size = 96, track = false, look = false, className = "", state = "idle", animated = false }: Props) {
  const eyes = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!track) return;
    const onMove = (e: PointerEvent) => {
      const el = eyes.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1, m = Math.min(5, d / 40);
      el.style.transform = `translate(${(dx / d) * m}px, ${(dy / d) * m}px)`;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [track]);

  const tRaw = useClock(animated);
  const live = animated && tRaw > 0;
  const t = live ? tRaw : 0.6; // still faces use a pleasant frame
  const v: Variant = { ...(seed === undefined ? HOME : variantFor(seed)), ...variant };
  const c = PALETTE[v.color];
  const fc = c.fc, L = LAYOUT[v.shape], ey0 = L.eye, my = L.mouth;
  const bp = v.plain ? { fill: c.fill } : { fill: c.fill, stroke: c.shade, strokeWidth: 3, strokeLinejoin: "round" as const };
  const accent = PALETTE[v.color === "yellow" ? "blue" : v.color === "blue" ? "yellow" : v.color === "red" ? "sky" : "red"].fill;

  /* ---- expression for this state and moment (all numbers, so states blend smoothly) ---- */
  const happy = state === "happy", think = state === "thinking", talk = state === "speaking";
  const ph = (seed ?? 7) * 0.37;
  const every = 3.2 + ((seed ?? 3) % 5) * 0.35, lb = (t + ph) % every;
  const blinkK = live && !happy && lb < 0.16 ? Math.max(0.08, 1 - Math.sin((lb / 0.16) * Math.PI)) : 1;
  const lx = think ? 0.75 : talk ? Math.sin(t * 0.9) * 0.25 : live ? Math.sin(t * 0.43 + ph) * 0.45 : 0;
  const ly = think ? -0.85 : live ? Math.sin(t * 0.31 + ph * 2) * 0.3 : 0;
  const syl = talk ? clamp(0.5 + 0.5 * Math.sin(t * 12.5) * (0.6 + 0.4 * Math.sin(t * 3.3 + 1))) : 0; // talking: mouth opens and closes
  const bounce = happy ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
  const bob = !live ? 0 : happy ? -Math.abs(Math.sin(t * 4.6)) * 5 : talk ? Math.sin(t * 2) * 0.8 - syl * 0.8 : Math.sin(t * 1.6 + ph) * 1.2;
  const tilt = !live ? 0 : think ? 5 + Math.sin(t * 0.8) * 1.2 : happy ? Math.sin(t * 2.3) * 5 : Math.sin(t * 0.7 + ph) * 1.4;
  const ey = ey0;

  const body = {
    round: <circle cx="50" cy="54" r="38" {...bp} />,
    square: <rect x="12" y="18" width="76" height="70" rx="20" {...bp} />,
    tall: <rect x="20" y="10" width="60" height="82" rx="28" {...bp} />,
    blob: <path d="M50 16 C74 14 90 32 88 56 C86 80 70 92 48 90 C26 88 12 74 13 52 C14 30 28 17 50 16 Z" {...bp} />,
    hex: <path d="M50 14 L84 33 L84 73 L50 92 L16 73 L16 33 Z" {...bp} />,
    tri: <path d="M50 12 C57 12 90 70 90 81 C90 91 80 92 50 92 C20 92 10 91 10 81 C10 70 43 12 50 12 Z" {...bp} />,
    robot: <><rect x="6" y="44" width="10" height="20" rx="3" {...bp} /><rect x="84" y="44" width="10" height="20" rx="3" {...bp} /><rect x="14" y="20" width="72" height="68" rx="10" {...bp} /></>,
    egg: <ellipse cx="50" cy="54" rx="34" ry="40" {...bp} />,
    wide: <rect x="8" y="28" width="84" height="60" rx="26" {...bp} />,
  }[v.shape];

  const highlight = v.plain ? null : <ellipse cx="36" cy={L.top + 14} rx="10" ry="5" fill="#fff" opacity=".35" transform={`rotate(-20 36 ${L.top + 14})`} />;

  /* ---- eyes ---- */
  const arcs = (r = 7) => <><path d={`M${38 - r} ${ey + 3} Q38 ${ey - r - 1} ${38 + r} ${ey + 3}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /><path d={`M${62 - r} ${ey + 3} Q62 ${ey - r - 1} ${62 + r} ${ey + 3}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /></>;
  const star = (x: number) => <path d={`M${x} ${ey - 8} Q${x + 1.6} ${ey - 1.6} ${x + 8} ${ey} Q${x + 1.6} ${ey + 1.6} ${x} ${ey + 8} Q${x - 1.6} ${ey + 1.6} ${x - 8} ${ey} Q${x - 1.6} ${ey - 1.6} ${x} ${ey - 8} Z`} fill={fc} />;
  const eyeEl = {
    oval: <><ellipse cx="38" cy={ey} rx="6.5" ry="8.5" fill={fc} /><ellipse cx="62" cy={ey} rx="6.5" ry="8.5" fill={fc} /><circle cx="40" cy={ey - 3} r="2" fill={c.fill} /><circle cx="64" cy={ey - 3} r="2" fill={c.fill} /></>,
    dot: <><circle cx="38" cy={ey} r="4.5" fill={fc} /><circle cx="62" cy={ey} r="4.5" fill={fc} /></>,
    happy: <><path d={`M31 ${ey + 3} Q38 ${ey - 6} 45 ${ey + 3}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /><path d={`M55 ${ey + 3} Q62 ${ey - 6} 69 ${ey + 3}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /></>,
    wink: <><ellipse cx="38" cy={ey} rx="6" ry="8" fill={fc} /><path d={`M55 ${ey} L69 ${ey}`} stroke={fc} strokeWidth="4" strokeLinecap="round" /></>,
    visor: <rect x="27" y={ey - 7} width="46" height="14" rx="7" fill={fc} />,
    big: <><circle cx="37" cy={ey} r="10" fill="#fff" stroke={fc === "#ffffff" ? "none" : "#0a0a0a"} strokeWidth="2" /><circle cx="63" cy={ey} r="10" fill="#fff" stroke={fc === "#ffffff" ? "none" : "#0a0a0a"} strokeWidth="2" /><circle cx={38 + lx * 2.5} cy={ey + 1 + ly * 2.5} r="5" fill="#0a0a0a" /><circle cx={64 + lx * 2.5} cy={ey + 1 + ly * 2.5} r="5" fill="#0a0a0a" /></>,
    sleepy: <><path d={`M31 ${ey} Q38 ${ey + 7} 45 ${ey}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /><path d={`M55 ${ey} Q62 ${ey + 7} 69 ${ey}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /></>,
    glasses: <><circle cx="37" cy={ey} r="9" fill="none" stroke={fc} strokeWidth="3.2" /><circle cx="63" cy={ey} r="9" fill="none" stroke={fc} strokeWidth="3.2" /><path d={`M46 ${ey} L54 ${ey}`} stroke={fc} strokeWidth="3.2" /><circle cx={37 + lx * 2.5} cy={ey + ly * 2.5} r="3.2" fill={fc} /><circle cx={63 + lx * 2.5} cy={ey + ly * 2.5} r="3.2" fill={fc} /></>,
    star: <>{star(38)}{star(62)}</>,
    pixel: <><rect x="32" y={ey - 6} width="12" height="12" rx="2" fill={fc} /><rect x="56" y={ey - 6} width="12" height="12" rx="2" fill={fc} /><rect x={36 + lx * 2} y={ey - 3 + ly * 2} width="5" height="5" fill={c.fill} /><rect x={60 + lx * 2} y={ey - 3 + ly * 2} width="5" height="5" fill={c.fill} /></>,
    cyclops: <><circle cx="50" cy={ey} r="12" fill="#fff" stroke={fc === "#ffffff" ? "none" : "#0a0a0a"} strokeWidth="2" /><circle cx={50 + lx * 3.5} cy={ey + 1 + ly * 3.5} r="6" fill="#0a0a0a" /><circle cx={52 + lx * 3.5} cy={ey - 2 + ly * 3.5} r="1.8" fill="#fff" /></>,
  }[v.eyes];
  // happy: eyes become smiling arcs (visor / glasses keep their frame and bounce instead)
  const happyEyes = v.eyes === "cyclops" ? <path d={`M38 ${ey + 4} Q50 ${ey - 10} 62 ${ey + 4}`} stroke={fc} strokeWidth="4.5" fill="none" strokeLinecap="round" /> : v.eyes === "visor" || v.eyes === "glasses" ? eyeEl : arcs(7);
  const eyesShown = happy ? happyEyes : eyeEl;
  const thinkLift = think ? -2 : 0;

  /* ---- brows ---- */
  const bl = happy ? -2.5 - bounce : think ? -1 : 0, by = ey - (v.eyes === "big" || v.eyes === "glasses" || v.eyes === "cyclops" ? 15 : 13);
  const brow = (x: number, sd: number) => {
    const y = by + bl + (think && sd > 0 ? -2.5 : 0);
    switch (v.brows) {
      case "flat": return <rect key={sd} x={x - 6} y={y - 1.4} width="12" height="2.8" rx="1.4" fill={fc} />;
      case "raised": return <rect key={sd} x={x - 6} y={y - 2.4} width="12" height="2.8" rx="1.4" fill={fc} transform={`rotate(${-sd * 14} ${x} ${y})`} />;
      case "angry": return <rect key={sd} x={x - 6} y={y - 0.4} width="12" height="3" rx="1.5" fill={fc} transform={`rotate(${sd * 16} ${x} ${y})`} />;
      case "soft": return <path key={sd} d={`M${x - 6} ${y + 1.2} Q${x} ${y - 3} ${x + 6} ${y + 1.2}`} stroke={fc} strokeWidth="2.8" fill="none" strokeLinecap="round" />;
      default: return null;
    }
  };
  const browsEl = !v.brows || v.brows === "none" ? null : v.brows === "uni" ? <rect x="31" y={by + bl - 1.5} width="38" height="3" rx="1.5" fill={fc} /> : <>{brow(38, -1)}{brow(62, 1)}</>;

  /* ---- mouth: still / talking / happy, per style ---- */
  const tongueCol = "#f45b7a";
  const dSmile = (w: number, d: number, extraEl?: React.ReactNode) => <><path d={`M${50 - w} ${my - 2} Q50 ${my + 1} ${50 + w} ${my - 2} Q${50 + w - 1} ${my + d} 50 ${my + d} Q${50 - w + 1} ${my + d} ${50 - w} ${my - 2} Z`} fill={fc} />{extraEl}</>;
  const stillMouth = {
    smile: <path d={`M42 ${my} Q50 ${my + 7} 58 ${my}`} stroke={fc} strokeWidth="3.4" fill="none" strokeLinecap="round" />,
    flat: <path d={`M43 ${my + 2} L57 ${my + 2}`} stroke={fc} strokeWidth="3.4" strokeLinecap="round" />,
    o: <ellipse cx="50" cy={my + 2} rx="4" ry="5" fill={fc} />,
    grin: <path d={`M40 ${my - 2} Q50 ${my + 12} 60 ${my - 2} Z`} fill={fc} />,
    none: null,
    tongue: <><path d={`M41 ${my - 1} Q50 ${my + 10} 59 ${my - 1} Z`} fill={fc} /><path d={`M46 ${my + 3} Q50 ${my + 11} 54 ${my + 3} Z`} fill={tongueCol} /></>,
    cat: <path d={`M41 ${my} Q45.5 ${my + 6} 50 ${my} Q54.5 ${my + 6} 59 ${my}`} stroke={fc} strokeWidth="3.2" fill="none" strokeLinecap="round" />,
    teeth: <><rect x="40" y={my - 3} width="20" height="10" rx="4" fill={fc} /><rect x="43" y={my - 3} width="14" height="4" rx="1" fill="#fff" /></>,
    wave: <path d={`M40 ${my + 1} L44 ${my + 4} L48 ${my} L52 ${my + 4} L56 ${my} L60 ${my + 3}`} stroke={fc} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    fang: <><path d={`M41 ${my - 1} Q50 ${my + 9} 59 ${my - 1} Z`} fill={fc} /><path d={`M52 ${my} L56 ${my} L54 ${my + 5} Z`} fill="#fff" /></>,
    smirk: <path d={`M42 ${my + 2} Q52 ${my + 6} 59 ${my - 3}`} stroke={fc} strokeWidth="3.4" fill="none" strokeLinecap="round" />,
  }[v.mouth];
  const b2 = bounce * 2;
  const happyMouth = {
    smile: <path d={`M38 ${my - 1} Q50 ${my + 12 + b2} 62 ${my - 1}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" />,
    flat: <path d={`M39 ${my} Q50 ${my + 10 + b2} 61 ${my}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" />,
    none: <path d={`M41 ${my} Q50 ${my + 9 + b2} 59 ${my}`} stroke={fc} strokeWidth="3.6" fill="none" strokeLinecap="round" />,
    dot: null,
    o: dSmile(10, 12 + b2, <ellipse cx="50" cy={my + 8 + b2 * 0.6} rx="4.5" ry={2.4 + bounce} fill={tongueCol} />),
    grin: dSmile(12, 13 + b2, <rect x="41" y={my - 2.2} width="18" height="3.6" rx="1.4" fill="#fff" />),
    teeth: dSmile(12, 13 + b2, <rect x="41" y={my - 2.2} width="18" height="3.6" rx="1.4" fill="#fff" />),
    tongue: dSmile(11, 12 + b2, <path d={`M45 ${my + 5} Q50 ${my + 15 + b2 * 1.4} 55 ${my + 5} Z`} fill={tongueCol} />),
    fang: dSmile(11, 12 + b2, <path d={`M53 ${my - 1.4} L57 ${my - 1.6} L55 ${my + 4.5} Z`} fill="#fff" />),
    cat: <path d={`M38 ${my - 2 - bounce} Q44 ${my + 8 + b2} 50 ${my} Q56 ${my + 8 + b2} 62 ${my - 2 - bounce}`} stroke={fc} strokeWidth="3.6" fill="none" strokeLinecap="round" />,
    smirk: <path d={`M40 ${my + 1} Q52 ${my + 9 + b2} 61 ${my - 5 - bounce}`} stroke={fc} strokeWidth="3.8" fill="none" strokeLinecap="round" />,
    wave: <path d={`M38 ${my} L42.8 ${my + 4 + b2} L47.6 ${my} L52.4 ${my + 4 + b2} L57.2 ${my} L62 ${my + 3 + bounce}`} stroke={fc} strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  } as Record<string, React.ReactNode>;
  happyMouth.dot = happyMouth.none;
  const o = syl; // 0 closed .. 1 open
  const talkOval = <><ellipse cx="50" cy={my + 2} rx={5.5 + o * 2} ry={1.6 + o * 5.4} fill={fc} />{o > 0.55 && <ellipse cx="50" cy={my + 4.5 + o * 1.5} rx="3" ry={1 + o} fill={tongueCol} />}</>;
  const talkMouth = {
    smile: <path d={`M42 ${my} Q50 ${my + 2} 58 ${my} Q57 ${my + 3 + o * 9} 50 ${my + 3 + o * 9} Q43 ${my + 3 + o * 9} 42 ${my} Z`} fill={fc} />,
    grin: <path d={`M40 ${my - 2} Q50 ${my} 60 ${my - 2} Q59 ${my + 4 + o * 10} 50 ${my + 4 + o * 10} Q41 ${my + 4 + o * 10} 40 ${my - 2} Z`} fill={fc} />,
    teeth: <><rect x="40" y={my - 3} width="20" height={6 + o * 7} rx="4" fill={fc} /><rect x="43" y={my - 3} width="14" height="3.5" rx="1" fill="#fff" /></>,
    tongue: <><path d={`M41 ${my - 1} Q50 ${my} 59 ${my - 1} Q58 ${my + 3 + o * 9} 50 ${my + 3 + o * 9} Q42 ${my + 3 + o * 9} 41 ${my - 1} Z`} fill={fc} /><ellipse cx="50" cy={my + 2 + o * 6} rx="4" ry={1.5 + o * 2} fill={tongueCol} /></>,
    fang: <><path d={`M41 ${my - 1} Q50 ${my} 59 ${my - 1} Q58 ${my + 3 + o * 8} 50 ${my + 3 + o * 8} Q42 ${my + 3 + o * 8} 41 ${my - 1} Z`} fill={fc} /><path d={`M52 ${my - 0.6} L56 ${my - 0.6} L54 ${my + 4} Z`} fill="#fff" /></>,
    flat: <rect x="43" y={my + 2 - 1.7 - o * 3} width="14" height={3.4 + o * 6} rx={1.7 + o * 2} fill={fc} />,
    cat: <><path d={`M41 ${my} Q45.5 ${my + 6} 50 ${my} Q54.5 ${my + 6} 59 ${my}`} stroke={fc} strokeWidth="3.2" fill="none" strokeLinecap="round" /><ellipse cx="50" cy={my + 4} rx={2 + o * 2} ry={0.6 + o * 3} fill={fc} /></>,
    smirk: <><path d={`M42 ${my + 2} Q52 ${my + 6} 59 ${my - 3}`} stroke={fc} strokeWidth="3.4" fill="none" strokeLinecap="round" /><ellipse cx="52" cy={my + 3.5} rx={1.5 + o * 2} ry={0.5 + o * 3} fill={fc} /></>,
    wave: <path d={`M40 ${my + 1} L44 ${my + 1 + 3 + o * 4} L48 ${my - o * 2} L52 ${my + 4 + o * 4} L56 ${my - o * 2} L60 ${my + 3}`} stroke={fc} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  } as Record<string, React.ReactNode>;
  const mouthEl = happy ? happyMouth[v.mouth] : talk ? talkMouth[v.mouth] ?? talkOval : think ? (v.mouth === "none" ? null : <path d={`M45 ${my + 3} L55 ${my + 1.5}`} stroke={fc} strokeWidth="3.2" strokeLinecap="round" />) : stillMouth;

  const blush = (v.blush || happy) && !v.plain ? <><ellipse cx="27" cy={ey + 11} rx="6" ry="3.6" fill="#ff5a7a" opacity={happy ? 0.45 : 0.35} /><ellipse cx="73" cy={ey + 11} rx="6" ry="3.6" fill="#ff5a7a" opacity={happy ? 0.45 : 0.35} /></> : null;

  const T = L.top;
  const behind = {
    ears: <><circle cx={50 - L.half - 2} cy={T + 34} r="8" {...bp} /><circle cx={50 + L.half + 2} cy={T + 34} r="8" {...bp} /></>,
    catEars: <><path d={`M${28} ${T + 12} L${24} ${T - 10} L${44} ${T + 4} Z`} {...bp} /><path d={`M${72} ${T + 12} L${76} ${T - 10} L${56} ${T + 4} Z`} {...bp} /></>,
    horns: <><path d={`M34 ${T + 6} Q28 ${T - 8} 36 ${T - 12} Q38 ${T - 2} 42 ${T + 4} Z`} fill="#fff7e6" stroke={c.shade} strokeWidth="2.5" /><path d={`M66 ${T + 6} Q72 ${T - 8} 64 ${T - 12} Q62 ${T - 2} 58 ${T + 4} Z`} fill="#fff7e6" stroke={c.shade} strokeWidth="2.5" /></>,
  } as Partial<Record<string, React.ReactNode>>;
  const front = {
    antenna: <><path d={`M50 ${T} L50 ${T - 12}`} stroke={c.shade} strokeWidth="3" /><circle cx="50" cy={T - 14} r="4.5" fill={accent} stroke={c.shade} strokeWidth="2" /></>,
    tuft: <path d={`M44 ${T + 2} Q42 ${T - 10} 36 ${T - 12} M50 ${T + 1} Q51 ${T - 12} 48 ${T - 16} M56 ${T + 2} Q60 ${T - 9} 66 ${T - 10}`} stroke={c.shade} strokeWidth="3.6" fill="none" strokeLinecap="round" />,
    beanie: <><path d={`M22 ${T + 16} Q24 ${T - 12} 50 ${T - 12} Q76 ${T - 12} 78 ${T + 16} Z`} fill={accent} stroke="#0a0a0a" strokeOpacity=".25" strokeWidth="2" /><rect x="20" y={T + 12} width="60" height="8" rx="4" fill="#fff" opacity=".9" /><circle cx="50" cy={T - 13} r="5" fill="#fff" /></>,
    cap: <><path d={`M24 ${T + 12} Q26 ${T - 10} 50 ${T - 10} Q74 ${T - 10} 76 ${T + 12} Z`} fill={accent} /><path d={`M52 ${T + 11} Q76 ${T + 6} 92 ${T + 14} L76 ${T + 16} Z`} fill={accent} /><circle cx="50" cy={T - 10} r="2.5" fill="#0a0a0a" opacity=".5" /></>,
    headphones: <><path d={`M${50 - L.half - 1} ${T + 34} Q${50 - L.half} ${T - 12} 50 ${T - 12} Q${50 + L.half} ${T - 12} ${50 + L.half + 1} ${T + 34}`} stroke="#0a0a0a" strokeWidth="4" fill="none" /><rect x={50 - L.half - 7} y={T + 24} width="12" height="22" rx="5" fill={accent} stroke="#0a0a0a" strokeWidth="2" /><rect x={50 + L.half - 5} y={T + 24} width="12" height="22" rx="5" fill={accent} stroke="#0a0a0a" strokeWidth="2" /></>,
    party: <><path d={`M50 ${T - 22} L60 ${T + 4} L40 ${T + 4} Z`} fill={accent} stroke="#0a0a0a" strokeOpacity=".3" strokeWidth="1.5" /><circle cx="50" cy={T - 23} r="3.5" fill="#fff" /></>,
  } as Partial<Record<string, React.ReactNode>>;


  /* ---- orbiting memory dots ---- */
  const orb = v.orbit && v.orbit !== "none" ? v.orbit : null;
  const back: React.ReactNode[] = [], fore: React.ReactNode[] = [];
  if (orb) {
    const cx = 50, cy = L.mouth - 2, rx = L.half + 15, ry = 9, n = orb === "comet" ? 1 : clamp(v.dots ?? 3, 1, 6);
    const spin = t * (think ? 2.4 : happy ? 1.6 : 0.8) + ph;
    const dotCol = accent, soft = "#ffffff";
    if (orb === "ring") { back.push(<path key="rb" d={`M${cx - rx} ${cy} A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`} fill="none" stroke={dotCol} strokeWidth="1.4" strokeDasharray="2 3" opacity=".6" />); fore.push(<path key="rf" d={`M${cx + rx} ${cy} A${rx} ${ry} 0 0 1 ${cx - rx} ${cy}`} fill="none" stroke={dotCol} strokeWidth="1.6" strokeDasharray="2 3" opacity=".9" />); }
    for (let i = 0; i < n; i++) {
      const a = spin + (i * Math.PI * 2) / n;
      const trail = orb === "comet" ? 4 : 0;
      for (let k = trail; k >= 0; k--) {
        const ak = a - k * 0.3, d = Math.sin(ak), x = cx + Math.cos(ak) * rx, y = cy + d * ry;
        const list = d > 0 ? fore : back, r = (orb === "comet" ? (k ? 3 - k * 0.5 : 3.6) : 3.4) * (0.85 + 0.2 * d);
        const op = (d > 0 ? 1 : 0.5) * (k ? 0.75 - k * 0.14 : 1);
        if (orb === "sparkle") list.push(<path key={`${i}-${k}`} d={`M${x} ${y - r * 1.4} Q${x + r * 0.3} ${y - r * 0.3} ${x + r * 1.4} ${y} Q${x + r * 0.3} ${y + r * 0.3} ${x} ${y + r * 1.4} Q${x - r * 0.3} ${y + r * 0.3} ${x - r * 1.4} ${y} Q${x - r * 0.3} ${y - r * 0.3} ${x} ${y - r * 1.4} Z`} fill={d > 0 ? soft : dotCol} opacity={op} />);
        else list.push(<circle key={`${i}-${k}`} cx={x} cy={y} r={r} fill={d > 0 ? dotCol : dotCol} stroke={d > 0 ? "#0a0a0a" : "none"} strokeOpacity=".25" strokeWidth="1" opacity={op} />);
      }
    }
  }
  const thought = think ? [0, 1, 2].map((i) => { const k = clamp(Math.sin(t * 4 - i * 0.9) * 0.5 + 0.5); return <circle key={i} cx={78 + i * 6} cy={L.top - 2 - i * 6 - k * 1.5} r={2 + i * 0.9} fill={accent} opacity={0.35 + 0.65 * k} />; }) : null;
  const wig = v.extra === "antenna" || v.extra === "ears" || v.extra === "catEars" ? (happy ? Math.sin(t * 10) * 9 : live ? Math.sin(t * 2.2 + ph) * 3 : 0) : 0;
  const pivotY = L.top + 4;

  return (
    <svg viewBox={v.plain && !orb ? "0 0 100 100" : "-8 -12 116 116"} width={size} height={size} className={className} aria-hidden overflow="visible">
      <g transform={`translate(0 ${bob}) rotate(${tilt} 50 90)`}>
        {back}
        <g transform={wig && v.extra !== "antenna" ? `rotate(${wig * 0.4} 50 ${pivotY})` : undefined}>{behind[v.extra]}</g>
        {body}
        {highlight}
        {blush}
        <g ref={eyes} style={{ transition: "transform .12s ease-out" }} className={look ? "look" : ""}>
          <g transform={`translate(${lx * 2.2} ${ly * 2 + thinkLift * 0.3 + (happy && (v.eyes === "visor" || v.eyes === "glasses") ? -bounce : 0)})`}>
            <g className={live ? "" : "blink"} transform={blinkK < 1 ? `translate(0 ${ey}) scale(1 ${blinkK}) translate(0 ${-ey})` : undefined}>{eyesShown}</g>
          </g>
          {browsEl}
        </g>
        {mouthEl}
        <g transform={v.extra === "antenna" && wig ? `rotate(${wig} 50 ${L.top})` : undefined}>{front[v.extra]}</g>
        {fore}
        {thought}
      </g>
    </svg>
  );
}
