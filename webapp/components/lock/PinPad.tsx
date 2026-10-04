"use client";

import { useEffect, useState } from "react";
import Icon from "../Icon";

/** A phone-style PIN pad (4–6 digits). Calls onDone with the digits; the parent shows errors. */
export default function PinPad({ title, sub, length = 4, error, busy, onDone, dark = false }: {
  title: string; sub?: string; length?: number; error?: string; busy?: boolean; onDone: (pin: string) => void; dark?: boolean;
}) {
  const [pin, setPin] = useState("");
  useEffect(() => { if (error) setPin(""); }, [error]);
  const add = (d: string) => { if (busy) return; const n = (pin + d).slice(0, length); setPin(n); if (n.length === length) onDone(n); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (/^[0-9]$/.test(e.key)) add(e.key); else if (e.key === "Backspace") setPin((p) => p.slice(0, -1)); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  const ink = dark ? "text-white" : "text-ink";
  const key = `grid h-16 w-16 place-items-center rounded-full text-[26px] font-semibold transition active:scale-95 ${dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-tint text-ink hover:bg-grape hover:text-white"}`;
  return (
    <div data-pinpad className="flex flex-col items-center">
      <h2 className={`display text-[26px] leading-none ${ink}`}>{title}</h2>
      {sub && <p className={`mt-2 text-center text-[14px] ${dark ? "text-white/70" : "text-ink/60"}`}>{sub}</p>}
      <div className={`mt-6 flex gap-3 ${error ? "shake" : ""}`} aria-label={`${pin.length} of ${length} digits`}>
        {Array.from({ length }).map((_, i) => <i key={i} className={`h-3.5 w-3.5 rounded-full transition ${i < pin.length ? "bg-grape scale-110" : dark ? "bg-white/25" : "bg-ink/15"}`} />)}
      </div>
      <p role="alert" className="mt-3 min-h-[20px] text-[13px] font-semibold text-[#ff5a5f]">{busy ? <span className={dark ? "text-white/70" : "text-ink/60"}>Checking…</span> : error}</p>
      <div className="mt-2 grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} type="button" data-key={d} onClick={() => add(d)} className={key}>{d}</button>)}
        <span />
        <button type="button" data-key="0" onClick={() => add("0")} className={key}>0</button>
        <button type="button" aria-label="Delete" onClick={() => setPin((p) => p.slice(0, -1))} className={`grid h-16 w-16 place-items-center rounded-full ${dark ? "text-white/80" : "text-ink/70"}`}><Icon name="left" size={22} /></button>
      </div>
    </div>
  );
}
