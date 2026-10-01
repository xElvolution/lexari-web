"use client";

import BgArt from "./BgArt";
import { lookVariant } from "./avatar";
import type { AgentLook } from "@/lib/store";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { copy } from "@/content/copy";
import Face from "./Face";
import Logo from "./Logo";

const B = copy.hero.badge;
const DARK_INK = { "--ink": "#0a0a0a", "--bg": "#ffffff" } as CSSProperties; // the card is always white

/** Barcode generated from the agent's name, so every name prints a unique badge. */
export function Barcode({ text }: { text: string }) {
  const bars: number[] = [];
  for (const ch of (text || "lexari").padEnd(10, "x")) { const c = ch.charCodeAt(0); bars.push(1 + (c % 3), 1 + ((c >> 2) % 2)); }
  let x = 0;
  return (
    <svg viewBox={`0 0 ${bars.reduce((a, b) => a + b + 1, 0)} 20`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      {bars.map((w, i) => { const r = <rect key={i} x={x} y="0" width={i % 2 ? 0.6 : w} height="20" fill="#0a0a0a" />; x += w + 1; return r; })}
    </svg>
  );
}

/** A QR style code seeded by the name. Decorative, like the rest of the card. */
export function Code({ text }: { text: string }) {
  const n = 21, cells: [number, number][] = [];
  let h = 2166136261;
  for (const ch of text || "lexari") h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const finder = (x: number, y: number) => { const inF = (fx: number, fy: number) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7; return inF(0, 0) || inF(n - 7, 0) || inF(0, n - 7); };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue;
    h = Math.imul(h ^ (x * 31 + y * 17), 16777619);
    if ((h >>> 28) & 1) cells.push([x, y]);
  }
  const F = ({ x, y }: { x: number; y: number }) => <><rect x={x} y={y} width="7" height="7" fill="#0a0a0a" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#5b2bff" /></>;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-full w-full" shapeRendering="crispEdges" aria-hidden>
      <rect width={n} height={n} fill="#fff" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0a0a0a" />)}
      <F x={0} y={0} /><F x={n - 7} y={0} /><F x={0} y={n - 7} />
    </svg>
  );
}

/**
 * The hero badge hangs from a lanyard. It sways with the pointer, can be dragged,
 * and springs back. A tap or a fast sideways flick turns it over to show the back.
 * Physics (pendulum plus flip spring) is written straight to the DOM every frame.
 */
export default function Badge({ name, setName, look }: { name: string; setName: (v: string) => void; look?: AgentLook }) {
  const rig = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const flipTarget = useRef(0);
  const [flipped, setFlipped] = useState(false);
  const [issued, setIssued] = useState("Day one");

  useEffect(() => { setIssued(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })); }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let a = 7, v = 0, drag = false, target = 0, lastX = 0, tilt = 0, raf = 0, t0 = performance.now();
    let f = 0, fv = 0; // flip angle and its velocity
    let press: { x: number; y: number; t: number; id: number } | null = null;
    let trail: { x: number; t: number }[] = [];
    const flip = (dir = 1) => {
      flipTarget.current = flipTarget.current === 0 ? 180 : 0;
      setFlipped(flipTarget.current === 180);
      v += 26 * dir; // the lanyard swings a little as the card turns
    };
    const pivot = () => { const r = rig.current!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top }; };
    const move = (e: PointerEvent) => {
      const dx = e.clientX - lastX; lastX = e.clientX;
      tilt = (e.clientX / window.innerWidth - 0.5) * 18;
      if (press) {
        trail.push({ x: e.clientX, t: performance.now() }); trail = trail.slice(-6);
        if (!drag && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) { drag = true; card.current!.style.cursor = "grabbing"; }
      }
      if (drag) { const p = pivot(); target = Math.max(-40, Math.min(40, (-Math.atan2(e.clientX - p.x, e.clientY - p.y) * 180) / Math.PI)); }
      else if (!reduce) v += dx * 0.012; // a breeze from the cursor
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("input")) return;
      press = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      trail = [{ x: e.clientX, t: press.t }];
      card.current!.setPointerCapture(e.pointerId);
    };
    const up = (e: PointerEvent) => {
      if (!press) return;
      const dt = performance.now() - press.t, dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      const first = trail[0], last = trail[trail.length - 1];
      const speed = last && first && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0; // px per ms
      if (!drag && dist < 12 && dt < 800) flip(1); // a tap (also slow taps and small jitters)
      else if (Math.abs(speed) > 1.3 && dt < 380 && Math.abs(e.clientX - press.x) > 40) flip(Math.sign(speed)); // a sideways flick
      press = null; drag = false;
      if (card.current) card.current.style.cursor = "grab";
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input")) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(1); }
    };
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - t0) / 1000); t0 = now;
      if (drag) { v = (target - a) * 12; a += v * dt; }
      else { v += (-a * 38 - v * 2.6) * dt; a += v * dt; }
      if (reduce) { f = flipTarget.current; }
      else { fv += ((flipTarget.current - f) * 70 - fv * 11) * dt; f += fv * dt; }
      if (rig.current) rig.current.style.transform = `rotate(${a}deg)`;
      if (card.current) card.current.style.transform = `perspective(1000px) rotateY(${f + tilt + v * 0.04}deg)`;
      raf = requestAnimationFrame(loop);
    };
    const c = card.current!;
    window.addEventListener("pointermove", move);
    c.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    c.addEventListener("keydown", key);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); c.removeEventListener("pointerdown", down); c.removeEventListener("keydown", key); };
  }, []);

  const face = "rounded-[26px] bg-white p-3 text-[#0a0a0a] shadow-[0_30px_60px_-20px_rgba(20,0,80,.55),0_2px_0_#fff_inset] ring-1 ring-black/10 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";
  const shown = name || "Your agent";

  return (
    <div ref={rig} className="relative mx-auto flex w-fit flex-col items-center will-change-transform" style={{ transformOrigin: "50% 0%" }}>
      {/* lanyard */}
      <div className="strap h-[36px] w-[30px] rounded-b-sm shadow-[4px_0_0_rgba(0,0,0,.12)] sm:h-[170px] lg:h-[190px]">
        <div className="flex h-full flex-col items-center justify-around overflow-hidden py-2">
          {[0, 1, 2].map((i) => <span key={i} className="label rotate-90 whitespace-nowrap text-[8px] font-bold text-white/85">lexari</span>)}
        </div>
      </div>
      {/* clip */}
      <div className="relative z-10 -mt-1 h-7 w-12 rounded-md bg-gradient-to-b from-[#f2f2f2] to-[#a3a3a3] shadow-[inset_0_-2px_0_rgba(0,0,0,.2)]"><span className="absolute left-1/2 top-1/2 h-2.5 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40" /></div>

      <div
        ref={card}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={flipped ? "Badge back. Press to flip to the front." : "Agent badge. Press to flip and see the back."}
        className="relative -mt-2 w-[250px] cursor-grab touch-none select-none outline-none focus-visible:ring-4 focus-visible:ring-grape/60 rounded-[26px] sm:w-[310px]"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRONT */}
        <div className={`relative ${face}`} aria-hidden={flipped}>
          <div className="mx-auto mb-2 h-2.5 w-16 rounded-full bg-black/10" />
          <div className="rounded-[18px] bg-grape px-4 py-2.5 text-center">
            <div className="display text-[26px] leading-none text-white">HELLO</div>
            <div className="label mt-1 text-[9.5px] text-white/80">my name is</div>
          </div>
          <div className="carpet-w relative mt-3 grid h-[118px] place-items-center overflow-hidden rounded-[18px] bg-[#0a0a0a] sm:h-[170px]">
            {look && typeof look === "object" ? <span className="contents"><BgArt id={look.bg} className="opacity-100" /><span className="relative"><Face variant={lookVariant(look)} size={112} track animated /></span></span> : look === null || look === undefined ? <Face size={112} track /> : <Face seed={look} size={112} track />}
            <span className="label absolute left-3 top-3 text-[9px] text-white/70">{B.company}</span>
            <span className="label absolute right-3 top-3 rounded-full bg-grape px-2 py-1 text-[9px] text-white">● online</span>
          </div>
          <div className="px-1.5 pt-3">
            <div className="display truncate text-[40px] leading-[0.95] sm:text-[50px]">{shown}</div>
            <div className="label mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[9.5px] text-black/60"><span>{B.role}</span><span>·</span><span>{B.seat}</span><span>·</span><span>{B.since}</span></div>
            <label className="mt-3 block rounded-xl border-2 border-dashed border-grape/40 bg-white px-3 py-2 focus-within:border-grape">
              <span className="label block text-[8.5px] text-grape">{B.inputLabel}</span>
              <input value={name} maxLength={12} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} ._-]/gu, ""))} className="w-full bg-transparent text-[16px] font-bold text-[#0a0a0a] outline-none" aria-label={B.inputLabel} tabIndex={flipped ? -1 : 0} />
            </label>
            <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
              {B.chips.map((c) => <span key={c} className="rounded-full bg-[#0a0a0a] px-2.5 py-1 text-[11px] font-semibold text-white">{c}</span>)}
            </div>
            <div className="mt-3"><Barcode text={name} /></div>
          </div>
        </div>

        {/* BACK */}
        <div className={`absolute inset-0 flex flex-col overflow-hidden !p-0 ${face}`} style={{ transform: "rotateY(180deg)" }} aria-hidden={!flipped}>
          <div className="mx-auto mt-3 h-2.5 w-16 rounded-full bg-black/10" />
          {/* magnetic strip */}
          <div className="mt-3 h-11 bg-[#0a0a0a] sm:h-12" />
          <div className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-5">
            <div className="flex items-center justify-between">
              <span style={DARK_INK} className="origin-left scale-[.8]"><Logo /></span>
              <span className="label rounded-full bg-grape px-2 py-1 text-[8.5px] text-white">{B.back.kind}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px] sm:mt-4 sm:gap-y-3 sm:text-[13px]">
              <div className="col-span-2"><dt className="label text-[8.5px] text-black/50">{B.back.holder}</dt><dd className="display truncate text-[26px] leading-none sm:text-[30px]">{shown}</dd></div>
              {B.back.fields.map(([k, val]) => <div key={k}><dt className="label text-[8.5px] text-black/50">{k}</dt><dd className="font-semibold leading-tight">{val}</dd></div>)}
              <div><dt className="label text-[8.5px] text-black/50">{B.back.issuedLabel}</dt><dd className="font-semibold leading-tight">{issued}</dd></div>
            </dl>
            <div className="mt-4 hidden flex-wrap gap-1.5 sm:flex">
              {B.chips.map((c) => <span key={c} className="rounded-full border-[1.5px] border-grape/50 px-2.5 py-1 text-[11px] font-semibold text-grape">{c}</span>)}
            </div>
            <div className="mt-auto flex items-end gap-3 pt-3">
              <div className="h-[64px] w-[64px] shrink-0 rounded-md p-1 ring-1 ring-black/10 sm:h-[76px] sm:w-[76px]"><Code text={shown} /></div>
              <div className="min-w-0 flex-1">
                <div className="border-b-2 border-black/70 pb-0.5 font-display text-[18px] italic leading-none text-grape sm:text-[20px]">{shown}</div>
                <div className="label mt-1 text-[8px] text-black/50">{B.back.sign}</div>
              </div>
            </div>
            <p className="mt-3 text-[9.5px] leading-snug text-black/55 sm:text-[10px]">{B.back.fine}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
