"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** One global pass: anything with .reveal rises in with a little overshoot when it enters. */
export default function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
        gsap.from(el, { y: 60, opacity: 0, rotate: 1.5, duration: 1.1, ease: "back.out(1.4)", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });
    });
    return () => ctx.revert();
  }, []);
  return null;
}
