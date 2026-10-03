"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

const COIN_SVG = (size: number, uid: string) => `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${uid}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9a3ff"/><stop offset=".55" stop-color="#7c4dff"/><stop offset="1" stop-color="#4a1fe0"/></linearGradient><linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a3cff"/><stop offset="1" stop-color="#3514b0"/></linearGradient></defs><circle cx="20" cy="21.5" r="17" fill="#2a0e8f"/><circle cx="20" cy="19.5" r="17" fill="url(#${uid}a)"/><circle cx="20" cy="19.5" r="12.6" fill="url(#${uid}b)" stroke="#d9ccff" stroke-opacity=".55" stroke-width="1.2"/><path d="M20 11.5 L22.1 17.4 L28 19.5 L22.1 21.6 L20 27.5 L17.9 21.6 L12 19.5 L17.9 17.4 Z" fill="#fff"/><ellipse cx="13.5" cy="11" rx="5" ry="2.4" fill="#fff" opacity=".35" transform="rotate(-30 13.5 11)"/></svg>`;
let n = 0;

/** A Lexari coin: purple, a white spark in the middle. */
export function Coin({ size = 20, className = "" }: { size?: number; className?: string }) {
  const [uid] = useState(() => `cn${++n}`);
  return <span className={`inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: COIN_SVG(size, uid) }} />;
}

/** Counts smoothly to `value`. Increases wait a beat so the flying coins land first. */
export function useCount(value: number, delayUp = 0.62) {
  const [shown, setShown] = useState(value);
  const cur = useRef(value);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
    if (reduce || cur.current === value) { cur.current = value; setShown(value); return; }
    const o = { v: cur.current };
    const t = gsap.to(o, { v: value, duration: Math.min(1.4, 0.45 + Math.abs(value - cur.current) / 400), delay: value > cur.current ? delayUp : 0, ease: "power2.out", onUpdate: () => { cur.current = o.v; setShown(Math.round(o.v)); } });
    return () => { t.kill(); };
  }, [value, delayUp]);
  return shown;
}

/** Shoots coins from an element along little arcs into the visible balance, then bumps it. */
export function flyCoins(from: Element | null, amount: number) {
  if (!from || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off") return;
  const target = Array.from(document.querySelectorAll<HTMLElement>("[data-coin-target]")).filter((el) => { const r = el.getBoundingClientRect(); return el.offsetParent !== null && r.bottom > 0 && r.top < window.innerHeight; }).pop();
  if (!target) return;
  const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
  const count = Math.max(5, Math.min(16, Math.round(amount / 8)));
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.innerHTML = COIN_SVG(22, `fly${Date.now()}${i}`);
    Object.assign(el.style, { position: "fixed", left: `${a.left + a.width / 2 - 11}px`, top: `${a.top + a.height / 2 - 11}px`, width: "22px", height: "22px", zIndex: "120", pointerEvents: "none", filter: "drop-shadow(0 4px 6px rgba(53,20,176,.45))" });
    document.body.appendChild(el);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const sx = (Math.random() - 0.5) * 120, sy = -40 - Math.random() * 70;
    const tl = gsap.timeline({ delay: i * 0.035, onComplete: () => el.remove() });
    tl.to(el, { x: sx, y: sy, rotate: (Math.random() - 0.5) * 220, scale: 1.15, duration: 0.32, ease: "power2.out" })
      .to(el, { x: dx, y: dy, rotate: 360, scale: 0.55, duration: 0.55, ease: "power3.in" })
      .to(el, { opacity: 0, duration: 0.08 });
  }
  gsap.fromTo(target, { scale: 1 }, { scale: 1.18, duration: 0.16, yoyo: true, repeat: 3, delay: 0.62, ease: "power2.out", clearProps: "transform" });
}

/** "+25" that floats up from a point inside a relative parent. */
export function Rise({ text, k }: { text: string; k: number }) {
  return <span key={k} className="hub-rise pointer-events-none absolute left-1/2 top-0 z-20 whitespace-nowrap rounded-full bg-grape px-2.5 py-1 text-[13px] font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(91,43,255,.9)]">{text}</span>;
}
