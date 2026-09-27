"use client";

import { useEffect, useRef, useState } from "react";
import Face from "./Face";

type Peek = { id: number; seed: number; edge: "left" | "right" | "bottom"; pos: number; size: number };

/**
 * Background mischief: one agent at a time peeks in from a screen edge, glances left and
 * right, then ducks away. Fixed layer, pointer-events off, skipped for reduced motion.
 */
export default function Peekers() {
  const [peek, setPeek] = useState<Peek | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const n = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    let timer = 0;
    const next = () => {
      const wait = mobile ? 11000 + Math.random() * 9000 : 5000 + Math.random() * 6000;
      timer = window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          const edges: Peek["edge"][] = ["left", "right"]; // side gutters only, so faces never sit on top of copy
          n.current += 1;
          setPeek({ id: n.current, seed: Math.floor(Math.random() * 500), edge: edges[Math.floor(Math.random() * edges.length)], pos: 16 + Math.random() * 66, size: mobile ? 44 : 72 });
        }
        next();
      }, wait);
    };
    timer = window.setTimeout(next, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!peek || !el.current) return;
    const out = { left: "translateX(-110%) rotate(90deg)", right: "translateX(110%) rotate(-90deg)", bottom: "translateY(110%)" }[peek.edge];
    const inn = { left: "translateX(-50%) rotate(90deg)", right: "translateX(50%) rotate(-90deg)", bottom: "translateY(40%)" }[peek.edge];
    const tiltA = { left: "translateX(-50%) rotate(76deg)", right: "translateX(50%) rotate(-76deg)", bottom: "translateY(40%) rotate(-10deg)" }[peek.edge];
    const tiltB = { left: "translateX(-50%) rotate(104deg)", right: "translateX(50%) rotate(-104deg)", bottom: "translateY(40%) rotate(10deg)" }[peek.edge];
    const a = el.current.animate(
      [
        { transform: out, offset: 0 },
        { transform: inn, offset: 0.16, easing: "cubic-bezier(.3,1.5,.5,1)" },
        { transform: tiltA, offset: 0.36 },
        { transform: tiltA, offset: 0.46 },
        { transform: tiltB, offset: 0.62 },
        { transform: tiltB, offset: 0.72 },
        { transform: inn, offset: 0.82 },
        { transform: out, offset: 1, easing: "ease-in" },
      ],
      { duration: 3400, easing: "ease-in-out", fill: "forwards" }
    );
    a.onfinish = () => setPeek(null);
    return () => a.cancel();
  }, [peek]);

  if (!peek) return null;
  const place =
    peek.edge === "left" ? { left: 0, top: `${peek.pos}%` } :
    peek.edge === "right" ? { right: 0, top: `${peek.pos}%` } :
    { bottom: 0, left: `${peek.pos}%` };
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      <div key={peek.id} ref={el} className="absolute opacity-90 drop-shadow-[0_6px_14px_rgba(0,0,0,.25)]" style={{ ...place, width: peek.size, height: peek.size, transform: "translateX(-200%)" }}>
        <Face seed={peek.seed} size={peek.size} look className="block" />
      </div>
    </div>
  );
}
