"use client";

import { useEffect, useRef, useState } from "react";
import Face from "./Face";
import { PALETTE, type ColorKey } from "./avatar";

type Side = "left" | "right";
type Peek = { id: number; seed: number; color: ColorKey; side: Side; top: number; size: number; depth: number };

// peekers skip the purples so they never melt into the purple sections
const PEEK_COLORS: ColorKey[] = ["orange", "blue", "green", "yellow", "red", "teal", "pink", "sky"];
const TEXTY = "h1,h2,h3,h4,p,li,dd,dt,a,button,label,input,summary,figcaption,blockquote";

/** True when the element itself holds visible text (spans, pills, labels inside graphics). */
function hasOwnText(el: Element) {
  for (const node of Array.from(el.childNodes)) if (node.nodeType === 3 && node.textContent && node.textContent.trim()) return true;
  return false;
}

/** How much readable text sits under a rectangle. The peek layer is pointer-events none, so elementFromPoint looks through it. */
function textUnder(x0: number, x1: number, y0: number, y1: number) {
  let hits = 0;
  for (let y = y0; y <= y1; y += 14) for (let x = x0; x <= x1; x += 12) {
    const el = document.elementFromPoint(x, y);
    if (el && (el.closest(TEXTY) || hasOwnText(el))) hits++;
  }
  return hits;
}

/** Find the side and height with the least text in the strip the peeker will cover. */
function findSpot(size: number, depth: number) {
  const W = window.innerWidth, H = window.innerHeight;
  const reach = size * depth + 8;
  let best: { side: Side; top: number; score: number } | null = null;
  for (let top = 96; top <= H - size - 24; top += 28) {
    for (const side of ["left", "right"] as Side[]) {
      const x0 = side === "left" ? 2 : W - reach, x1 = side === "left" ? reach : W - 2;
      const score = textUnder(x0, x1, top + 6, top + size - 6) + Math.random() * 0.5;
      if (!best || score < best.score) best = { side, top, score };
    }
  }
  return best;
}

/**
 * Background mischief: one agent at a time grabs a screen edge, pulls its whole head into view,
 * looks one way and then the other, and ducks back out. Picks a spot with no text under it.
 */
export default function Peekers() {
  const [peek, setPeek] = useState<Peek | null>(null);
  const head = useRef<HTMLDivElement>(null);
  const hands = useRef<HTMLDivElement>(null);
  const n = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    let timer = 0, tries = 0;
    const schedule = (ms: number) => { timer = window.setTimeout(attempt, ms); };
    const attempt = () => {
      if (document.visibilityState !== "visible") return schedule(4000);
      const size = mobile ? 88 : 132;
      let depth = mobile ? 0.8 : 0.86;
      let spot = findSpot(size, depth);
      if (spot && spot.score >= 1 && mobile) { depth = 0.62; spot = findSpot(size, depth); } // shallower lean when space is tight
      if (!spot || (spot.score >= 1 && tries < 4)) { tries++; return schedule(1800); } // wait for a clearer spot
      tries = 0;
      n.current += 1;
      setPeek({ id: n.current, seed: Math.floor(Math.random() * 1000), color: PEEK_COLORS[Math.floor(Math.random() * PEEK_COLORS.length)], side: spot.side, top: spot.top, size, depth });
      schedule(mobile ? 9000 + Math.random() * 7000 : 5200 + Math.random() * 4500);
    };
    schedule(2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!peek || !head.current || !hands.current) return;
    const s = peek.side === "left" ? 1 : -1;
    const hidden = `translateX(${-s * 115}%)`;
    const shown = (-(1 - peek.depth) * 100) * s;
    const at = (deg: number, extra = 0) => `translateX(${shown + extra * s}%) rotate(${deg * s}deg)`;
    const opts = { duration: 4200, easing: "ease-in-out", fill: "forwards" as const };
    const h = head.current.animate(
      [
        { transform: `${hidden} rotate(0deg)`, offset: 0 },
        { transform: at(-4), offset: 0.08 },
        { transform: at(10, 4), offset: 0.15, easing: "cubic-bezier(.3,1.6,.5,1)" },
        { transform: at(6), offset: 0.22 },
        { transform: at(14, 2), offset: 0.36 },
        { transform: at(14, 2), offset: 0.46 },
        { transform: at(-6), offset: 0.58 },
        { transform: at(-6), offset: 0.7 },
        { transform: at(6), offset: 0.8 },
        { transform: `${hidden} rotate(0deg)`, offset: 1, easing: "ease-in" },
      ],
      opts
    );
    const k = hands.current.animate(
      [
        { transform: `translateX(${-s * 100}%)`, offset: 0 },
        { transform: "translateX(0%)", offset: 0.06 },
        { transform: "translateX(0%)", offset: 0.86 },
        { transform: `translateX(${-s * 100}%)`, offset: 1 },
      ],
      opts
    );
    h.onfinish = () => setPeek(null);
    return () => { h.cancel(); k.cancel(); };
  }, [peek]);

  if (!peek) return null;
  const c = PALETTE[peek.color];
  const left = peek.side === "left";
  const hand = (y: number) => (
    <svg key={y} width={peek.size * 0.24} height={peek.size * 0.2} viewBox="0 0 24 20" style={{ position: "absolute", top: y, [left ? "left" : "right"]: 0, transform: left ? undefined : "scaleX(-1)" }}>
      <path d="M0 3 H14 a6 6 0 0 1 0 14 H0 Z" fill={c.fill} stroke={c.shade} strokeWidth="2" />
      <path d="M11 7.5 H17 M11 12.5 H17" stroke={c.shade} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[20] overflow-hidden">
      <div className="absolute" style={{ top: peek.top, [left ? "left" : "right"]: 0, width: peek.size, height: peek.size }}>
        {/* head */}
        <div ref={head} className="absolute inset-0 drop-shadow-[0_10px_18px_rgba(0,0,0,.35)]" style={{ transformOrigin: left ? "0% 85%" : "100% 85%", transform: `translateX(${left ? -115 : 115}%)` }}>
          <Face key={peek.id} seed={peek.seed} variant={{ color: peek.color }} size={peek.size} look className="block" />
        </div>
        {/* hands gripping the edge of the screen */}
        <div ref={hands} className="absolute inset-0" style={{ transform: `translateX(${left ? -100 : 100}%)` }}>
          {hand(peek.size * 0.18)}
          {hand(peek.size * 0.7)}
        </div>
      </div>
    </div>
  );
}
