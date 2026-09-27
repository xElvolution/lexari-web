"use client";

import { useEffect, useRef } from "react";
import { HOME, featureColor, variantFor, type Variant } from "./avatar";

type Props = { seed?: number; variant?: Partial<Variant>; size?: number; track?: boolean; look?: boolean; className?: string };

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
  const fc = featureColor(v.body);
  const stroke = v.body === "#ffffff" ? "#0a0a0a" : v.body === "#0a0a0a" ? "rgba(255,255,255,.55)" : "none";
  const sw = stroke === "none" ? 0 : 3;
  const bodyProps = { fill: v.body, stroke, strokeWidth: sw };

  const body = {
    round: <circle cx="50" cy="54" r="38" {...bodyProps} />,
    tall: <rect x="20" y="12" width="60" height="80" rx="28" {...bodyProps} />,
    square: <rect x="12" y="18" width="76" height="70" rx="20" {...bodyProps} />,
    hex: <path d="M50 14 L84 33 L84 73 L50 92 L16 73 L16 33 Z" strokeLinejoin="round" {...bodyProps} />,
    blob: <path d="M50 16 C74 14 90 32 88 56 C86 80 70 92 48 90 C26 88 12 74 13 52 C14 30 28 17 50 16 Z" {...bodyProps} />,
  }[v.shape];

  const eyeY = 50;
  const eyeEl = {
    oval: <><ellipse cx="38" cy={eyeY} rx="6.5" ry="8.5" fill={fc} /><ellipse cx="62" cy={eyeY} rx="6.5" ry="8.5" fill={fc} /><circle cx="40" cy={eyeY - 3} r="2" fill={v.body} /><circle cx="64" cy={eyeY - 3} r="2" fill={v.body} /></>,
    dot: <><circle cx="38" cy={eyeY} r="4.5" fill={fc} /><circle cx="62" cy={eyeY} r="4.5" fill={fc} /></>,
    happy: <><path d={`M31 ${eyeY + 3} Q38 ${eyeY - 6} 45 ${eyeY + 3}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /><path d={`M55 ${eyeY + 3} Q62 ${eyeY - 6} 69 ${eyeY + 3}`} stroke={fc} strokeWidth="4" fill="none" strokeLinecap="round" /></>,
    wink: <><ellipse cx="38" cy={eyeY} rx="6" ry="8" fill={fc} /><path d={`M55 ${eyeY} L69 ${eyeY}`} stroke={fc} strokeWidth="4" strokeLinecap="round" /></>,
    visor: <rect x="27" y={eyeY - 7} width="46" height="14" rx="7" fill={fc} />,
    big: <><circle cx="37" cy={eyeY} r="10" fill={fc} /><circle cx="63" cy={eyeY} r="10" fill={fc} /><circle cx="37" cy={eyeY} r="4.5" fill={v.body} /><circle cx="63" cy={eyeY} r="4.5" fill={v.body} /></>,
  }[v.eyes];

  const mouthEl = {
    smile: <path d="M42 68 Q50 75 58 68" stroke={fc} strokeWidth="3.4" fill="none" strokeLinecap="round" />,
    flat: <path d="M43 70 L57 70" stroke={fc} strokeWidth="3.4" strokeLinecap="round" />,
    o: <ellipse cx="50" cy="70" rx="4" ry="5" fill={fc} />,
    grin: <path d="M40 66 Q50 80 60 66 Z" fill={fc} />,
    none: null,
  }[v.mouth];

  const extraEl = {
    none: null,
    antenna: <><path d="M50 16 L50 5" stroke={v.body === "#ffffff" ? "#0a0a0a" : v.body} strokeWidth="3" /><circle cx="50" cy="5" r="4" fill={v.body === "#5b2bff" ? "#c9b8ff" : "#5b2bff"} /></>,
    ears: <><circle cx="16" cy="54" r="7" {...bodyProps} /><circle cx="84" cy="54" r="7" {...bodyProps} /></>,
    bolt: <path d="M47 22 L55 22 L51 30 L57 30 L46 42 L49 33 L44 33 Z" fill={fc} opacity=".85" />,
  }[v.extra];

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden overflow="visible">
      {v.extra === "ears" && extraEl}
      {body}
      {v.extra !== "ears" && extraEl}
      <g ref={eyes} style={{ transition: "transform .12s ease-out" }} className={look ? "look" : ""}>
        <g className="blink">{eyeEl}</g>
      </g>
      {mouthEl}
    </svg>
  );
}
