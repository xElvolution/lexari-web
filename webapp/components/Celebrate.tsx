"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { txUrl } from "@/lib/nft";
import Icon from "./Icon";

type Party = { title: string; body?: string; tx?: string; art?: ReactNode; confetti?: boolean | "big"; cta?: { label: string; href?: string; onClick?: () => void } };
let cur: Party | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
/** A celebration pop-up: mint, hire, card issued, plan upgraded. Confetti only when asked for (the ID card NFT mint; a big burst for a plan upgrade). */
export function celebrate(p: Party) { cur = p; emit(); }
export function closeCelebrate() { cur = null; emit(); }

function Confetti({ big = false }: { big?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = c.getContext("2d")!; const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (c.width = innerWidth * dpr), H = (c.height = innerHeight * dpr);
    const cols = ["#5b2bff", "#8f6bff", "#ffd84d", "#1fbf6a", "#ff6b9a", "#ffffff", "#36c5ff"];
    const bit = (i: number, x: number, y: number, vx: number, vy: number) => ({ x, y, vx, vy, r: (4 + Math.random() * 6) * dpr, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: cols[i % cols.length], round: Math.random() < 0.3 });
    const bits = Array.from({ length: 160 }, (_, i) => bit(i, W / 2 + (Math.random() - 0.5) * W * 0.2, H * 0.42, (Math.random() - 0.5) * 22 * dpr, (-Math.random() * 20 - 8) * dpr));
    // big: two cannons from the bottom corners on top of the centre burst
    if (big) for (let i = 0; i < 240; i++) { const left = i % 2 === 0; bits.push(bit(i, left ? 0 : W, H * 0.95, (left ? 1 : -1) * (6 + Math.random() * 16) * dpr * Math.max(1, W / dpr / 600), (-Math.random() * 18 - 20) * dpr)); }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      g.clearRect(0, 0, W, H);
      for (const b of bits) { b.vy += 0.55 * dpr; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.a += b.va; g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.fillStyle = b.c; if (b.round) { g.beginPath(); g.arc(0, 0, b.r / 2, 0, 7); g.fill(); } else g.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2); g.restore(); }
      if (t - t0 < (big ? 5200 : 4200)) raf = requestAnimationFrame(step); else g.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[99] h-full w-full" />;
}

export default function Celebrate() {
  const p = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => cur, () => null);
  useEffect(() => { if (!p) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") closeCelebrate(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [p]);
  if (!p) return null;
  return (
    <div className="fixed inset-0 z-[98] grid place-items-center bg-black/65 p-5 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) closeCelebrate(); }}>
      {p.confetti && <Confetti big={p.confetti === "big"} />}
      <div role="dialog" aria-modal="true" aria-label={p.title} data-celebrate className="pop relative w-full max-w-[400px] overflow-hidden rounded-[28px] bg-card p-6 text-center ring-1 ring-line">
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-grape/40 blur-[60px]" />
        {p.art ? <div className="relative mx-auto flex justify-center">{p.art}</div> : <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-grape text-white"><Icon name="spark" size={28} /></span>}
        <h2 className="display relative mt-5 text-[30px] leading-[1.05] text-ink">{p.title}</h2>
        {p.body && <p className="relative mt-2 text-[14.5px] text-ink/70">{p.body}</p>}
        {p.tx && <a href={txUrl(p.tx)} target="_blank" rel="noreferrer" data-celebrate-tx className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 font-mono text-[12px] text-ink/75 hover:text-brand-ink">{p.tx.slice(0, 6)}…{p.tx.slice(-6)}<Icon name="arrow" size={12} /></a>}
        <div className="relative mt-5 flex gap-2">
          {p.cta && (p.cta.href ? <a href={p.cta.href} onClick={closeCelebrate} className="btn btn-line btn-sm flex-1 text-ink">{p.cta.label}</a> : <button onClick={() => { p.cta!.onClick?.(); closeCelebrate(); }} className="btn btn-line btn-sm flex-1 text-ink">{p.cta.label}</button>)}
          <button onClick={closeCelebrate} className="btn btn-brand btn-sm flex-1">Nice</button>
        </div>
      </div>
    </div>
  );
}
