"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { Coin } from "./coin";

/**
 * Mystery box pop-up. Plumbing: idle → opening (waiting on the claim) → revealed / error.
 * The opening animation is a placeholder (bounce + shake + burst) until the reference style is in.
 */
export type BoxPhase = "idle" | "opening" | "revealed" | "error";
export default function BoxModal({ open: show, onOpen, onClose, preview = false }: {
  open: boolean; onOpen: () => Promise<{ ok: boolean; coins: number; error?: string }>; onClose: () => void; preview?: boolean;
}) {
  const [phase, setPhase] = useState<BoxPhase>("idle");
  const [coins, setCoins] = useState(0);
  const [err, setErr] = useState("");
  useEffect(() => { if (show) { setPhase("idle"); setErr(""); } }, [show]);
  useEffect(() => { if (!show) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape" && phase !== "opening") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [show, phase, onClose]);
  if (!show) return null;
  const go = async () => {
    setPhase("opening"); setErr("");
    const started = Date.now();
    const r = await onOpen();
    await new Promise((x) => setTimeout(x, Math.max(0, 1400 - (Date.now() - started)))); // let the shake play
    if (!r.ok) { setErr(r.error || "The box did not open."); setPhase("error"); return; }
    setCoins(r.coins); setPhase("revealed");
  };
  return (
    <div data-box-modal className="fixed inset-0 z-[96] grid place-items-center bg-black/75 p-5 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && phase !== "opening") onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Mystery box" className="pop relative w-full max-w-[380px] overflow-hidden rounded-[30px] bg-[#0a0a0a] p-6 text-center text-white ring-1 ring-white/10">
        <div className="pointer-events-none absolute left-1/2 top-24 h-56 w-56 -translate-x-1/2 rounded-full bg-grape/50 blur-[70px]" />
        <button onClick={onClose} disabled={phase === "opening"} aria-label="Close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-white/70 hover:bg-white/10 disabled:opacity-30"><Icon name="x" size={18} /></button>
        <p className="label relative text-[9.5px] text-white/60">Mystery box{preview ? " · preview" : ""}</p>
        <div data-box-stage data-phase={phase} className="relative mx-auto mt-6 grid h-[180px] w-[180px] place-items-center">
          {phase === "revealed" ? (
            <div className="pop grid place-items-center"><Coin size={96} /><span data-box-reward className="display mt-3 text-[44px] leading-none">+{coins}</span></div>
          ) : (
            <span aria-hidden className={`text-[120px] leading-none ${phase === "opening" ? "box-shake" : "box-bounce"}`}>🎁</span>
          )}
        </div>
        <h2 className="display relative mt-4 text-[28px] leading-none">{phase === "revealed" ? (coins >= 120 ? "Jackpot!" : "Nice!") : phase === "opening" ? "Opening…" : "What's inside?"}</h2>
        <p className="relative mt-2 text-[13.5px] text-white/65">{phase === "revealed" ? (preview ? "That's how it looks. Your next real box opens after the daily reset." : "Coins added to your balance.") : "15 to 250 coins, once a day."}</p>
        {err && <p role="alert" className="relative mt-2 text-[13px] text-[#ff7a7f]">{err}</p>}
        <div className="relative mt-5">
          {phase === "revealed" ? <button onClick={onClose} className="btn btn-white btn-sm w-full">Collect</button>
            : <button data-box-open onClick={() => void go()} disabled={phase === "opening"} className="btn btn-white btn-sm w-full disabled:opacity-60">{phase === "opening" ? "Opening…" : phase === "error" ? "Try again" : "Open the box"}</button>}
        </div>
      </div>
    </div>
  );
}
