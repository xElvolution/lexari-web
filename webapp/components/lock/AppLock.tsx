"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { signOut, useApp } from "@/lib/store";
import PinPad from "./PinPad";

const KEY = "lexari-unlocked";
const IDLE_MS = 5 * 60_000;
export const markUnlocked = () => { try { sessionStorage.setItem(KEY, String(Date.now())); } catch {} };
const unlockedAt = () => { try { return Number(sessionStorage.getItem(KEY) || 0); } catch { return 0; } };

/** PIN check against the server. Throws with a plain message. */
export async function verifyPin(pin: string) { await api("/api/lock", { method: "POST", body: { pin } }); }

/**
 * Full-screen lock when the account has an app PIN: on open, and again after 5 minutes away.
 * The PIN is checked by the server (hashed, rate limited). This guards the app on this device; it is not encryption.
 */
export default function AppLock() {
  const s = useApp();
  const [locked, setLocked] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const on = !!s?.lockOn;
  useEffect(() => {
    if (!on) { setLocked(false); return; }
    if (!unlockedAt()) setLocked(true);
    let hidden = 0;
    const vis = () => {
      if (document.hidden) hidden = Date.now();
      else if (hidden && Date.now() - hidden > IDLE_MS) setLocked(true);
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [on]);
  if (!on || !locked) return null;
  const done = async (pin: string) => {
    setBusy(true); setErr("");
    try { await verifyPin(pin); markUnlocked(); setLocked(false); }
    catch (e) { setErr((e as Error).message || "That PIN isn't right."); }
    finally { setBusy(false); }
  };
  return (
    <div data-app-lock className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[#07050e] px-6 text-white">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-grape/30 blur-[110px]" />
      <span className="relative mb-8 grid h-14 w-14 place-items-center rounded-[18px] bg-white"><span className="h-4 w-4 rounded-full bg-[#0a0a0a]" /></span>
      <div className="relative"><PinPad dark title="Enter your PIN" sub="Lexari is locked on this device." error={err} busy={busy} onDone={done} /></div>
      <button onClick={() => { void signOut().then(() => location.assign("/signin")); }} className="relative mt-8 text-[13.5px] font-semibold text-white/60 hover:text-white">Forgot it? Sign out</button>
    </div>
  );
}
