"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Icon from "@/components/Icon";
import { Coin } from "./coin";

/**
 * Mystery box pop-up: idle → opening (waiting on the claim) → revealed / error.
 * The box is drawn here (purple crate, gold ribbon and bow, a glowing seam). Idle it hops with squash-and-stretch;
 * while the claim runs it rattles harder and harder with light leaking from the lid; then the lid blows off,
 * a flash and spinning rays fire, coins spray out under gravity and the amount pops in.
 */
export type BoxPhase = "idle" | "opening" | "revealed" | "error";
const SPRAY = 16;

export default function BoxModal({ open: show, onOpen, onClose, preview = false }: {
  open: boolean; onOpen: () => Promise<{ ok: boolean; coins: number; error?: string }>; onClose: () => void; preview?: boolean;
}) {
  const [phase, setPhase] = useState<BoxPhase>("idle");
  const [coins, setCoins] = useState(0);
  const [err, setErr] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const idle = useRef<gsap.core.Timeline | null>(null);
  const shake = useRef<gsap.core.Timeline | null>(null);
  const reduce = () => typeof window !== "undefined" && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off");

  useEffect(() => { if (show) { setPhase("idle"); setErr(""); } }, [show]);
  useEffect(() => { if (!show) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape" && phase !== "opening") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [show, phase, onClose]);

  // Idle hop: squash on landing, stretch on the way up, shadow breathing with it.
  useEffect(() => {
    const el = stage.current;
    if (!show || !el || (phase !== "idle" && phase !== "error") || reduce()) return;
    const box = el.querySelector("[data-crate]"), shadow = el.querySelector("[data-shadow]"), lid = el.querySelector("[data-lid]");
    gsap.set([box, lid], { clearProps: "all" });
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.35 });
    tl.to(box, { scaleY: 0.86, scaleX: 1.1, duration: 0.16, ease: "power2.in", transformOrigin: "50% 100%" })
      .to(box, { y: -34, scaleY: 1.08, scaleX: 0.94, duration: 0.32, ease: "power2.out" })
      .to(lid, { y: -6, rotate: -4, duration: 0.24, ease: "power2.out" }, "<")
      .to(shadow, { scale: 0.6, opacity: 0.35, duration: 0.32, ease: "power2.out" }, "<")
      .to(box, { y: 0, scaleY: 1, scaleX: 1, duration: 0.3, ease: "power2.in" })
      .to(lid, { y: 0, rotate: 0, duration: 0.3, ease: "bounce.out" }, "<")
      .to(shadow, { scale: 1, opacity: 0.6, duration: 0.3, ease: "power2.in" }, "<")
      .to(box, { scaleY: 0.92, scaleX: 1.06, duration: 0.08, yoyo: true, repeat: 1 });
    idle.current = tl;
    return () => { tl.kill(); idle.current = null; };
  }, [show, phase]);

  if (!show) return null;

  const startShake = () => {
    const el = stage.current; if (!el || reduce()) return;
    const box = el.querySelector("[data-crate]"), lid = el.querySelector("[data-lid]"), seam = el.querySelector("[data-seam]"), glow = el.querySelector("[data-glow]");
    gsap.set(box, { y: 0, scaleX: 1, scaleY: 1 });
    const tl = gsap.timeline();
    tl.to(glow, { opacity: 0.95, scale: 1.35, duration: 1.4, ease: "power1.in" }, 0)
      .to(seam, { opacity: 1, duration: 0.8 }, 0);
    // rattles get faster and wider
    for (let i = 0; i < 26; i++) {
      const k = Math.min(1, i / 18), d = 0.09 - k * 0.04;
      tl.to(box, { rotate: (i % 2 ? 1 : -1) * (4 + k * 9), x: (i % 2 ? 1 : -1) * (2 + k * 5), y: -k * 6, duration: d, ease: "sine.inOut" })
        .to(lid, { y: -(2 + k * 8) * (i % 2), rotate: (i % 2 ? -1 : 1) * (3 + k * 6), duration: d, ease: "sine.inOut" }, "<");
    }
    tl.repeat(-1);
    shake.current = tl;
  };

  const blowOpen = () => new Promise<void>((done) => {
    shake.current?.kill(); shake.current = null;
    const el = stage.current; if (!el || reduce()) { done(); return; }
    const box = el.querySelector("[data-crate]"), lid = el.querySelector("[data-lid]"), flash = el.querySelector("[data-flash]"), rays = el.querySelector("[data-rays]"), glow = el.querySelector("[data-glow]");
    const bits = Array.from(el.querySelectorAll<HTMLElement>("[data-spray]"));
    const tl = gsap.timeline({ onComplete: done });
    tl.to(box, { rotate: 0, x: 0, y: 8, scaleY: 0.78, scaleX: 1.16, duration: 0.14, ease: "power3.in", transformOrigin: "50% 100%" })
      .to(lid, { rotate: 0, y: 10, duration: 0.14, ease: "power3.in" }, "<")
      .addLabel("pop")
      .to(lid, { y: -190, x: 70, rotate: 220, opacity: 0, duration: 0.75, ease: "power2.out" }, "pop")
      .to(box, { y: 0, scaleY: 1.05, scaleX: 0.96, duration: 0.18, ease: "back.out(3)" }, "pop")
      .fromTo(flash, { scale: 0.2, opacity: 1 }, { scale: 3.2, opacity: 0, duration: 0.55, ease: "power2.out" }, "pop")
      .fromTo(rays, { opacity: 0, scale: 0.4, rotate: 0 }, { opacity: 1, scale: 1, rotate: 90, duration: 0.9, ease: "power2.out" }, "pop")
      .to(glow, { opacity: 1, scale: 1.8, duration: 0.4 }, "pop");
    bits.forEach((b, i) => {
      const ang = -Math.PI / 2 + (i / (bits.length - 1) - 0.5) * 2.2, v = 150 + Math.random() * 90;
      tl.fromTo(b, { x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }, { x: Math.cos(ang) * v, duration: 1.0, ease: "power1.out", scale: 0.8 + Math.random() * 0.5, rotate: (Math.random() - 0.5) * 540 }, "pop")
        .to(b, { keyframes: [{ y: Math.sin(ang) * v, duration: 0.42, ease: "power2.out" }, { y: Math.sin(ang) * v + 260, duration: 0.6, ease: "power2.in" }] }, "pop")
        .to(b, { opacity: 0, duration: 0.25 }, "pop+=0.8");
    });
    tl.to(box, { scale: 0.4, opacity: 0, y: 30, duration: 0.35, ease: "back.in(2)" }, "pop+=0.55");
  });

  const go = async () => {
    idle.current?.kill(); idle.current = null;
    setPhase("opening"); setErr("");
    startShake();
    const started = Date.now();
    const r = await onOpen();
    await new Promise((x) => setTimeout(x, Math.max(0, 1300 - (Date.now() - started)))); // let the rattle build
    if (!r.ok) {
      shake.current?.kill(); shake.current = null;
      const el = stage.current; if (el) gsap.to(el.querySelectorAll("[data-crate],[data-lid]"), { rotate: 0, x: 0, y: 0, duration: 0.3 });
      setErr(r.error || "The box did not open."); setPhase("error"); return;
    }
    await blowOpen();
    setCoins(r.coins); setPhase("revealed");
  };

  const revealed = phase === "revealed";
  return (
    <div data-box-modal className="fixed inset-0 z-[96] grid place-items-center bg-black/75 p-5 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && phase !== "opening") onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Mystery box" className="pop relative w-full max-w-[380px] overflow-hidden rounded-[30px] bg-[#0b0814] p-6 text-center text-white ring-1 ring-white/10">
        <button onClick={onClose} disabled={phase === "opening"} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-white/70 hover:bg-white/10 disabled:opacity-30"><Icon name="x" size={18} /></button>
        <p className="label relative text-[9.5px] text-white/60">Mystery box{preview ? " · preview" : ""}</p>
        <div ref={stage} data-box-stage data-phase={phase} className="relative mx-auto mt-4 h-[230px] w-[260px]">
          <span data-rays aria-hidden className={`box-rays pointer-events-none absolute left-1/2 top-[44%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 ${revealed ? "opacity-100" : "opacity-0"}`} />
          <span data-glow aria-hidden className="pointer-events-none absolute left-1/2 top-[50%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7c4dff] opacity-50 blur-[46px]" />
          <span data-flash aria-hidden className="pointer-events-none absolute left-1/2 top-[46%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 blur-[6px]" />
          {revealed ? (
            <div className="pop absolute inset-0 grid place-items-center">
              <div className="grid place-items-center"><span className="coin-spin"><Coin size={96} /></span><span data-box-reward className="display mt-2 text-[46px] leading-none drop-shadow-[0_4px_18px_rgba(124,77,255,.8)]">+{coins}</span></div>
            </div>
          ) : (
            <>
              <span data-shadow aria-hidden className="absolute bottom-[18px] left-1/2 h-4 w-[130px] -translate-x-1/2 rounded-[50%] bg-black/70 opacity-60 blur-[3px]" />
              <div data-crate aria-hidden className="absolute bottom-[26px] left-1/2 h-[104px] w-[142px] -ml-[71px]">
                {/* body */}
                <div className="absolute inset-0 overflow-hidden rounded-[16px] bg-[linear-gradient(160deg,#8f6bff_0%,#5b2bff_45%,#3a14c9_100%)] shadow-[inset_0_-10px_0_rgba(0,0,0,.18),inset_0_2px_0_rgba(255,255,255,.25)]">
                  <span className="absolute inset-y-0 left-1/2 w-[26px] -translate-x-1/2 bg-[linear-gradient(90deg,#e0a800,#ffd84d_45%,#ffe9a0_55%,#e0a800)]" />
                  <span className="absolute left-3 top-3 h-8 w-3 rotate-12 rounded-full bg-white/25" />
                  <span className="display absolute left-[22px] top-[34px] text-[30px] leading-none text-white/85">?</span>
                  <span className="display absolute right-[22px] top-[34px] text-[30px] leading-none text-white/85">?</span>
                </div>
                {/* light leaking through the seam while it rattles */}
                <span data-seam className="absolute -top-[3px] left-2 right-2 h-[6px] rounded-full bg-[#fff6c9] opacity-0 shadow-[0_0_18px_6px_rgba(255,216,77,.9)]" />
              </div>
              <div data-lid aria-hidden className="absolute bottom-[124px] left-1/2 h-[36px] w-[160px] -ml-[80px]" style={{ transformOrigin: "50% 100%" }}>
                <div className="absolute inset-0 rounded-[12px] bg-[linear-gradient(170deg,#a58bff_0%,#6a3cff_60%,#4a1fe0_100%)] shadow-[inset_0_-6px_0_rgba(0,0,0,.2),inset_0_2px_0_rgba(255,255,255,.3)]" />
                <span className="absolute inset-y-0 left-1/2 w-[28px] -translate-x-1/2 bg-[linear-gradient(90deg,#e0a800,#ffd84d_45%,#ffe9a0_55%,#e0a800)]" />
                {/* bow */}
                <span className="absolute -top-[26px] left-1/2 h-[30px] w-[38px] -translate-x-[40px] rotate-[-28deg] rounded-[50%_50%_40%_50%] border-[7px] border-[#ffd84d] bg-[#ffcf33]/30" />
                <span className="absolute -top-[26px] left-1/2 h-[30px] w-[38px] translate-x-[2px] rotate-[28deg] rounded-[50%_50%_50%_40%] border-[7px] border-[#ffd84d] bg-[#ffcf33]/30" />
                <span className="absolute -top-[12px] left-1/2 h-[18px] w-[18px] -translate-x-1/2 rounded-[6px] bg-[#ffd84d] shadow-[inset_0_-3px_0_#d49a00]" />
              </div>
              <div aria-hidden className="pointer-events-none absolute bottom-[110px] left-1/2">
                {Array.from({ length: SPRAY }, (_, i) => <span key={i} data-spray className="absolute -ml-[11px] -mt-[11px] opacity-0">{i % 4 === 3 ? <span className="block h-3 w-3 rotate-45 rounded-[3px] bg-[#ffd84d]" /> : <Coin size={22} />}</span>)}
              </div>
            </>
          )}
        </div>
        <h2 className="display relative mt-2 text-[28px] leading-none">{revealed ? (coins >= 120 ? "Jackpot!" : "Nice!") : phase === "opening" ? "Opening…" : "What's inside?"}</h2>
        <p className="relative mt-2 text-[13.5px] text-white/65">{revealed ? (preview ? "That's how it looks. Your next real box opens after the daily reset." : "Coins added to your balance.") : phase === "opening" ? "Hold on, it's rattling…" : "15 to 250 coins, once a day."}</p>
        {err && <p role="alert" className="relative mt-2 text-[13px] text-[#ff7a7f]">{err}</p>}
        <div className="relative mt-5">
          {revealed ? <button onClick={onClose} className="btn btn-white btn-sm w-full">Collect</button>
            : <button data-box-open onClick={() => void go()} disabled={phase === "opening"} className="btn btn-white btn-sm w-full disabled:opacity-60">{phase === "opening" ? "Opening…" : phase === "error" ? "Try again" : "Open the box"}</button>}
        </div>
      </div>
    </div>
  );
}
