"use client";

import { createElement, memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createAvatar, exprFor, globalTransform, mixExpr } from "@/lib/glyph";
import type { AvatarDNA, AvatarState, El, Expr } from "@/lib/glyph";

function render(el: El | string, key: number): ReactNode {
  if (typeof el === "string") return el;
  return createElement(el.tag, { key, ...el.attrs }, ...(el.children.length ? el.children.map(render) : []));
}

type Props = { dna: AvatarDNA; state?: AvatarState; size?: number; animated?: boolean; className?: string; fps?: number };

const CROSSFADE = 0.26;

/**
 * A Glyph agent face as inline SVG. `animated` runs blink, look, talk and the
 * state extras at ~30 fps (only one or two on screen at a time); otherwise it
 * draws a still poster frame, cheap enough for lists and option grids.
 */
function GlyphFaceInner({ dna, state = "idle", size = 64, animated = false, className = "", fps = 30 }: Props) {
  const key = JSON.stringify(dna);
  const avatar = useMemo(() => createAvatar(dna), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const uid = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [t, setT] = useState(0);
  const [live, setLive] = useState(false);
  const start = useRef(0);
  const prev = useRef<{ state: AvatarState; at: number; from: Expr | null }>({ state, at: 0, from: null });
  const last = useRef<Expr | null>(null);

  useEffect(() => {
    if (!animated || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setLive(false); return; }
    setLive(true);
    start.current = performance.now();
    let raf = 0, lastFrame = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastFrame < 1000 / fps || document.hidden) return;
      lastFrame = now;
      setT((now - start.current) / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animated, fps]);

  if (prev.current.state !== state) prev.current = { state, at: t, from: last.current };
  let e = live ? exprFor(state, t, avatar.spec.motion) : avatar.poster(state);
  const k = (t - prev.current.at) / CROSSFADE;
  if (live && prev.current.from && k < 1) e = mixExpr(prev.current.from, e, Math.max(0, k));
  last.current = e;

  const inner = avatar.direction.draw(avatar.spec, e, { uid, theme: "dark", compact: size <= 40 });
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden overflow="visible">
      <g transform={globalTransform(avatar.direction, e)}>{inner.map(render)}</g>
    </svg>
  );
}

export const GlyphFace = memo(GlyphFaceInner);
export default GlyphFace;
