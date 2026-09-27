"use client";

import { useEffect, useRef } from "react";
import { HOME, PALETTE, variantFor, type Shape, type Variant } from "./avatar";

type Props = { seed?: number; variant?: Partial<Variant>; size?: number; track?: boolean; look?: boolean; className?: string };

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
export default function Face({ seed, variant, size = 96, track = false, look = false, className = "" }: Props) {
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

  const v: Variant = { ...(seed === undefined ? HOME : variantFor(seed)), ...variant };
  const c = PALETTE[v.color];
  const fc = c.fc, L = LAYOUT[v.shape], ey = L.eye, my = L.mouth;
  const bp = v.plain ? { fill: c.fill } : { fill: c.fill, stroke: c.shade, strokeWidth: 3, strokeLinejoin: "round" as const };
  const accent = PALETTE[v.color === "yellow" ? "blue" : v.color === "blue" ? "yellow" : v.color === "red" ? "sky" : "red"].fill;

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

  const eyeEl = {
    oval: <><ellipse cx="38" cy={ey} rx="6.5" ry="8.5" fill={fc} /><ellipse cx="62" cy={ey} rx="6.5" ry="8.5" fill={fc} /><circle cx="40" cy={ey - 3} r="2" fill={c.fill} /><circle cx="64" cy={ey - 3} r="2" fill={c.fill} /></>,
    dot: <><circle cx="38" cy={ey} r="4.5" fill={fc} /><circle cx="62" cy={ey} r="4.5" fill={fc} /></>,
    happy: <><path d={`M31 ${ey + 3} Q38 ${ey - 6} 45 ${ey + 3}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /><path d={`M55 ${ey + 3} Q62 ${ey - 6} 69 ${ey + 3}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /></>,
    wink: <><ellipse cx="38" cy={ey} rx="6" ry="8" fill={fc} /><path d={`M55 ${ey} L69 ${ey}`} stroke={fc} strokeWidth="4" strokeLinecap="round" /></>,
    visor: <rect x="27" y={ey - 7} width="46" height="14" rx="7" fill={fc} />,
    big: <><circle cx="37" cy={ey} r="10" fill="#fff" stroke={fc === "#ffffff" ? "none" : "#0a0a0a"} strokeWidth="2" /><circle cx="63" cy={ey} r="10" fill="#fff" stroke={fc === "#ffffff" ? "none" : "#0a0a0a"} strokeWidth="2" /><circle cx="38" cy={ey + 1} r="5" fill="#0a0a0a" /><circle cx="64" cy={ey + 1} r="5" fill="#0a0a0a" /></>,
    sleepy: <><path d={`M31 ${ey} Q38 ${ey + 7} 45 ${ey}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /><path d={`M55 ${ey} Q62 ${ey + 7} 69 ${ey}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /></>,
    glasses: <><circle cx="37" cy={ey} r="9" fill="none" stroke={fc} strokeWidth="3.2" /><circle cx="63" cy={ey} r="9" fill="none" stroke={fc} strokeWidth="3.2" /><path d={`M46 ${ey} L54 ${ey}`} stroke={fc} strokeWidth="3.2" /><circle cx="37" cy={ey} r="3.2" fill={fc} /><circle cx="63" cy={ey} r="3.2" fill={fc} /></>,
  }[v.eyes];

  const mouthEl = {
    smile: <path d={`M42 ${my} Q50 ${my + 7} 58 ${my}`} stroke={fc} strokeWidth="3.4" fill="none" strokeLinecap="round" />,
    flat: <path d={`M43 ${my + 2} L57 ${my + 2}`} stroke={fc} strokeWidth="3.4" strokeLinecap="round" />,
    o: <ellipse cx="50" cy={my + 2} rx="4" ry="5" fill={fc} />,
    grin: <path d={`M40 ${my - 2} Q50 ${my + 12} 60 ${my - 2} Z`} fill={fc} />,
    none: null,
    tongue: <><path d={`M41 ${my - 1} Q50 ${my + 10} 59 ${my - 1} Z`} fill={fc} /><path d={`M46 ${my + 3} Q50 ${my + 11} 54 ${my + 3} Z`} fill="#f45b7a" /></>,
    cat: <path d={`M41 ${my} Q45.5 ${my + 6} 50 ${my} Q54.5 ${my + 6} 59 ${my}`} stroke={fc} strokeWidth="3.2" fill="none" strokeLinecap="round" />,
    teeth: <><rect x="40" y={my - 3} width="20" height="10" rx="4" fill={fc} /><rect x="43" y={my - 3} width="14" height="4" rx="1" fill="#fff" /></>,
  }[v.mouth];

  const blush = v.blush && !v.plain ? <><ellipse cx="27" cy={ey + 11} rx="6" ry="3.6" fill="#ff5a7a" opacity=".35" /><ellipse cx="73" cy={ey + 11} rx="6" ry="3.6" fill="#ff5a7a" opacity=".35" /></> : null;

  const t = L.top;
  const behind = {
    ears: <><circle cx={50 - L.half - 2} cy={t + 34} r="8" {...bp} /><circle cx={50 + L.half + 2} cy={t + 34} r="8" {...bp} /></>,
    catEars: <><path d={`M${28} ${t + 12} L${24} ${t - 10} L${44} ${t + 4} Z`} {...bp} /><path d={`M${72} ${t + 12} L${76} ${t - 10} L${56} ${t + 4} Z`} {...bp} /></>,
    horns: <><path d={`M34 ${t + 6} Q28 ${t - 8} 36 ${t - 12} Q38 ${t - 2} 42 ${t + 4} Z`} fill="#fff7e6" stroke={c.shade} strokeWidth="2.5" /><path d={`M66 ${t + 6} Q72 ${t - 8} 64 ${t - 12} Q62 ${t - 2} 58 ${t + 4} Z`} fill="#fff7e6" stroke={c.shade} strokeWidth="2.5" /></>,
  } as Partial<Record<string, React.ReactNode>>;
  const front = {
    antenna: <><path d={`M50 ${t} L50 ${t - 12}`} stroke={c.shade} strokeWidth="3" /><circle cx="50" cy={t - 14} r="4.5" fill={accent} stroke={c.shade} strokeWidth="2" /></>,
    tuft: <path d={`M44 ${t + 2} Q42 ${t - 10} 36 ${t - 12} M50 ${t + 1} Q51 ${t - 12} 48 ${t - 16} M56 ${t + 2} Q60 ${t - 9} 66 ${t - 10}`} stroke={c.shade} strokeWidth="3.6" fill="none" strokeLinecap="round" />,
    beanie: <><path d={`M22 ${t + 16} Q24 ${t - 12} 50 ${t - 12} Q76 ${t - 12} 78 ${t + 16} Z`} fill={accent} stroke="#0a0a0a" strokeOpacity=".25" strokeWidth="2" /><rect x="20" y={t + 12} width="60" height="8" rx="4" fill="#fff" opacity=".9" /><circle cx="50" cy={t - 13} r="5" fill="#fff" /></>,
    cap: <><path d={`M24 ${t + 12} Q26 ${t - 10} 50 ${t - 10} Q74 ${t - 10} 76 ${t + 12} Z`} fill={accent} /><path d={`M52 ${t + 11} Q76 ${t + 6} 92 ${t + 14} L76 ${t + 16} Z`} fill={accent} /><circle cx="50" cy={t - 10} r="2.5" fill="#0a0a0a" opacity=".5" /></>,
    headphones: <><path d={`M${50 - L.half - 1} ${t + 34} Q${50 - L.half} ${t - 12} 50 ${t - 12} Q${50 + L.half} ${t - 12} ${50 + L.half + 1} ${t + 34}`} stroke="#0a0a0a" strokeWidth="4" fill="none" /><rect x={50 - L.half - 7} y={t + 24} width="12" height="22" rx="5" fill={accent} stroke="#0a0a0a" strokeWidth="2" /><rect x={50 + L.half - 5} y={t + 24} width="12" height="22" rx="5" fill={accent} stroke="#0a0a0a" strokeWidth="2" /></>,
    party: <><path d={`M50 ${t - 22} L60 ${t + 4} L40 ${t + 4} Z`} fill={accent} stroke="#0a0a0a" strokeOpacity=".3" strokeWidth="1.5" /><circle cx="50" cy={t - 23} r="3.5" fill="#fff" /></>,
  } as Partial<Record<string, React.ReactNode>>;

  return (
    <svg viewBox={v.plain ? "0 0 100 100" : "-8 -12 116 116"} width={size} height={size} className={className} aria-hidden overflow="visible">
      {behind[v.extra]}
      {body}
      {highlight}
      {blush}
      <g ref={eyes} style={{ transition: "transform .12s ease-out" }} className={look ? "look" : ""}>
        <g className="blink">{eyeEl}</g>
      </g>
      {mouthEl}
      {front[v.extra]}
    </svg>
  );
}
