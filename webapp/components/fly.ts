"use client";

import { gsap } from "gsap";

/** Clones an element and flies it into the visible seat meter, then gives the meter a bump. */
export function flyToSeats(from: HTMLElement | null) {
  if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = Array.from(document.querySelectorAll<HTMLElement>("[data-seat-target]")).find((el) => el.offsetParent !== null);
  if (!target) return;
  const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
  const clone = from.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, { position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: "0", zIndex: "90", pointerEvents: "none" });
  document.body.appendChild(clone);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const tl = gsap.timeline({ onComplete: () => clone.remove() });
  tl.to(clone, { duration: 0.9, ease: "power2.in", x: dx, scale: Math.max(0.15, 28 / a.width), rotate: 20 })
    .to(clone, { duration: 0.9, ease: "back.in(1.6)", y: dy }, 0)
    .to(clone, { opacity: 0, duration: 0.15 }, 0.8)
    .fromTo(target, { scale: 1 }, { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }, 0.85);
}

/** A little confetti burst of purple squares from an element. */
export function burst(from: HTMLElement | null, n = 14) {
  if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = from.getBoundingClientRect();
  const colors = ["#5b2bff", "#8f6bff", "#c9b8ff", "#ffffff", "#0a0a0a"];
  for (let i = 0; i < n; i++) {
    const d = document.createElement("i");
    Object.assign(d.style, { position: "fixed", left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, width: "8px", height: "8px", borderRadius: i % 3 ? "2px" : "99px", background: colors[i % colors.length], zIndex: "95", pointerEvents: "none", boxShadow: "0 0 0 1px rgba(0,0,0,.08)" });
    document.body.appendChild(d);
    const ang = (i / n) * Math.PI * 2, dist = 60 + Math.random() * 70;
    gsap.to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist - 30, rotate: Math.random() * 360, opacity: 0, duration: 0.9 + Math.random() * 0.4, ease: "power3.out", onComplete: () => d.remove() });
  }
}
