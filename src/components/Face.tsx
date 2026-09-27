"use client";

import { useEffect, useRef } from "react";

type Props = { hue?: number; shape?: "round" | "tall" | "square"; size?: number; track?: boolean; className?: string };

/** A tiny agent face whose eyes follow the pointer. The personality of the brand. */
export default function Face({ hue = 262, shape = "round", size = 96, track = true, className = "" }: Props) {
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
  const body = `hsl(${hue} 95% 68%)`, shade = `hsl(${hue} 80% 52%)`;
  const path = shape === "tall" ? <rect x="18" y="8" width="64" height="84" rx="30" fill={body} /> : shape === "square" ? <rect x="10" y="14" width="80" height="74" rx="20" fill={body} /> : <circle cx="50" cy="52" r="40" fill={body} />;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      {path}
      <ellipse cx="50" cy="86" rx="26" ry="5" fill={shade} opacity=".5" />
      <g ref={eyes} style={{ transition: "transform .12s ease-out" }}>
        <g className="blink">
          <ellipse cx="38" cy="48" rx="7" ry="9" fill="#170a38" />
          <ellipse cx="62" cy="48" rx="7" ry="9" fill="#170a38" />
          <circle cx="40" cy="45" r="2.2" fill="#fff" />
          <circle cx="64" cy="45" r="2.2" fill="#fff" />
        </g>
      </g>
      <path d="M42 66 Q50 72 58 66" stroke="#170a38" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
