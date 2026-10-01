"use client";

import { useEffect, useRef, useState } from "react";
import type { AvatarState } from "@/lib/glyph";
import type { FaceDNA } from "@/lib/glyph/face";
import GlyphFace from "./GlyphFace";

/**
 * A gently animated Glyph face for marketing surfaces: idle most of the time,
 * with an occasional happy hop or a little talk. Only animates while on screen.
 */
export default function LiveGlyph({ dna, size = 96, className = "", beat = 0, still = false }: { dna: FaceDNA; size?: number; className?: string; beat?: number; still?: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  const [state, setState] = useState<AvatarState>("idle");
  useEffect(() => {
    const el = box.current; if (!el || still) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, [still]);
  useEffect(() => {
    if (!seen) return;
    let alive = true; let t: ReturnType<typeof setTimeout>;
    const loop = (n: number) => {
      t = setTimeout(() => {
        if (!alive) return;
        const next: AvatarState = (n + beat) % 3 === 0 ? "speaking" : "happy";
        setState(next);
        t = setTimeout(() => { if (alive) { setState("idle"); loop(n + 1); } }, next === "happy" ? 1500 : 2000);
      }, 4200 + ((beat * 1777 + n * 911) % 4200));
    };
    loop(0);
    return () => { alive = false; clearTimeout(t); };
  }, [seen, beat]);
  return <span ref={box} className={`inline-grid place-items-center ${className}`}><GlyphFace dna={dna} size={size} state={state} animated={seen} fps={size < 60 ? 20 : 30} className="h-full w-full" /></span>;
}
