"use client";

import { useEffect, useRef } from "react";
import { copy } from "@/content/copy";
import Face from "./Face";

const B = copy.hero.badge;

/** Barcode generated from the agent's name, so every name prints a unique badge. */
function Barcode({ text }: { text: string }) {
  const bars: number[] = [];
  for (const ch of (text || "lexari").padEnd(10, "x")) { const c = ch.charCodeAt(0); bars.push(1 + (c % 3), 1 + ((c >> 2) % 2)); }
  let x = 0;
  return (
    <svg viewBox={`0 0 ${bars.reduce((a, b) => a + b + 1, 0)} 20`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      {bars.map((w, i) => { const r = <rect key={i} x={x} y="0" width={i % 2 ? 0.6 : w} height="20" fill="#170a38" />; x += w + 1; return r; })}
    </svg>
  );
}

/**
 * The hero badge hangs from a lanyard. It sways with the pointer, can be dragged,
 * and springs back. Physics is a damped pendulum written straight to the DOM.
 */
export default function Badge({ name, setName }: { name: string; setName: (v: string) => void }) {
  const rig = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let a = 7, v = 0, drag = false, target = 0, lastX = 0, tilt = 0, raf = 0, t0 = performance.now();
    const pivot = () => { const r = rig.current!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top }; };
    const move = (e: PointerEvent) => {
      const dx = e.clientX - lastX; lastX = e.clientX;
      tilt = (e.clientX / window.innerWidth - 0.5) * 18;
      if (drag) { const p = pivot(); target = Math.max(-40, Math.min(40, (-Math.atan2(e.clientX - p.x, e.clientY - p.y) * 180) / Math.PI)); }
      else if (!reduce) v += dx * 0.012; // a breeze from the cursor
    };
    const down = (e: PointerEvent) => { if ((e.target as HTMLElement).closest("input")) return; drag = true; card.current!.setPointerCapture(e.pointerId); card.current!.style.cursor = "grabbing"; };
    const up = () => { drag = false; if (card.current) card.current.style.cursor = "grab"; };
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - t0) / 1000); t0 = now;
      if (drag) { v = (target - a) * 12; a += v * dt; }
      else { v += (-a * 38 - v * 2.6) * dt; a += v * dt; }
      if (rig.current) rig.current.style.transform = `rotate(${a}deg)`;
      if (card.current) card.current.style.transform = `perspective(900px) rotateY(${tilt + v * 0.04}deg)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", move);
    card.current!.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    raf = requestAnimationFrame(loop);
    const c = card.current!;
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); c.removeEventListener("pointerdown", down); };
  }, []);

  return (
    <div ref={rig} className="relative mx-auto flex w-fit flex-col items-center will-change-transform" style={{ transformOrigin: "50% 0%" }}>
      {/* lanyard */}
      <div className="strap h-[36px] w-[30px] rounded-b-sm shadow-[4px_0_0_rgba(0,0,0,.12)] sm:h-[170px] lg:h-[190px]">
        <div className="flex h-full flex-col items-center justify-around overflow-hidden py-2">
          {[0, 1, 2].map((i) => <span key={i} className="label rotate-90 whitespace-nowrap text-[8px] font-bold text-plum/70">lexari</span>)}
        </div>
      </div>
      {/* clip */}
      <div className="relative -mt-1 h-7 w-12 rounded-md bg-gradient-to-b from-[#e9e4ff] to-[#9c91c9] shadow-[inset_0_-2px_0_rgba(0,0,0,.2)]"><span className="absolute left-1/2 top-1/2 h-2.5 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-plum/40" /></div>

      <div ref={card} className="relative -mt-2 w-[250px] cursor-grab touch-none select-none rounded-[26px] bg-frost p-3 shadow-[0_30px_60px_-20px_rgba(23,10,56,.7),0_2px_0_#fff_inset] sm:w-[310px]" style={{ transformStyle: "preserve-3d" }}>
        <div className="mx-auto mb-2 h-2.5 w-16 rounded-full bg-plum/15" />
        <div className="rounded-[18px] bg-candy px-4 py-2.5 text-center">
          <div className="display text-[26px] leading-none text-plum">HELLO</div>
          <div className="label mt-1 text-[9.5px] text-plum/75">my name is</div>
        </div>
        <div className="carpet relative mt-3 grid h-[118px] place-items-center overflow-hidden rounded-[18px] bg-grape-soft sm:h-[170px]">
          <Face size={112} hue={318} />
          <span className="label absolute left-3 top-3 text-[9px] text-white/80">{B.company}</span>
          <span className="label absolute right-3 top-3 rounded-full bg-plum px-2 py-1 text-[9px] text-candy">● online</span>
        </div>
        <div className="px-1.5 pt-3">
          <div className="display truncate text-[40px] leading-[0.95] text-plum sm:text-[50px]">{name || "Your agent"}</div>
          <div className="label mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[9.5px] text-plum/65"><span>{B.role}</span><span>·</span><span>{B.seat}</span><span>·</span><span>{B.since}</span></div>
          <label className="mt-3 block rounded-xl border-2 border-dashed border-grape/40 bg-white px-3 py-2 focus-within:border-grape">
            <span className="label block text-[8.5px] text-grape">{B.inputLabel}</span>
            <input value={name} maxLength={12} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} ._-]/gu, ""))} className="w-full bg-transparent text-[16px] font-bold text-plum outline-none" aria-label={B.inputLabel} />
          </label>
          <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
            {B.chips.map((c) => <span key={c} className="rounded-full bg-plum px-2.5 py-1 text-[11px] font-semibold text-frost">{c}</span>)}
          </div>
          <div className="mt-3"><Barcode text={name} /></div>
        </div>
      </div>
    </div>
  );
}
