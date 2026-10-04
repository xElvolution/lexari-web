"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { set, toast, useApp } from "@/lib/store";
import Icon from "../Icon";
import PinPad from "./PinPad";
import { markUnlocked } from "./AppLock";

type Step = null | { mode: "set" | "change" | "off"; stage: "current" | "new" | "repeat"; current?: string; first?: string };

/** Turn the app lock on, change the PIN or turn it off. */
export default function LockSettings() {
  const s = useApp()!;
  const [step, setStep] = useState<Step>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const setOn = (on: boolean) => set((x) => ({ ...x, lockOn: on }));
  const close = () => { setStep(null); setErr(""); };
  const done = async (pin: string) => {
    if (!step) return;
    setErr("");
    if (step.stage === "current") {
      if (step.mode === "off") {
        setBusy(true);
        try { await api("/api/lock", { method: "DELETE", body: { pin } }); setOn(false); close(); toast({ text: "App lock is off" }); }
        catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
        return;
      }
      setStep({ ...step, stage: "new", current: pin }); return;
    }
    if (step.stage === "new") { setStep({ ...step, stage: "repeat", first: pin }); return; }
    if (pin !== step.first) { setErr("Those didn't match. Start again."); setStep({ ...step, stage: "new", first: undefined }); return; }
    setBusy(true);
    try {
      await api("/api/lock", { method: "PUT", body: { pin, ...(step.current ? { current: step.current } : {}) } });
      setOn(true); markUnlocked(); close(); toast({ text: step.mode === "set" ? "App lock is on" : "PIN changed" });
    } catch (e) { setErr((e as Error).message); setStep({ mode: step.mode, stage: step.mode === "change" ? "current" : "new" }); }
    finally { setBusy(false); }
  };
  const title = !step ? "" : step.stage === "current" ? "Enter your current PIN" : step.stage === "new" ? "Choose a 4-digit PIN" : "Enter it again";
  return (
    <div data-lock-settings>
      <div className="flex items-center gap-3 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name="lock" size={17} /></span>
        <div className="min-w-0 flex-1"><div className="text-[15px] font-semibold text-ink">App lock {s.lockOn ? "· on" : "· off"}</div><div className="text-[13px] text-ink/60">{s.lockOn ? "Lexari asks for your PIN when you open it and after 5 minutes away. It's also needed to view card details." : "Ask for a PIN when Lexari opens on this phone."}</div></div>
      </div>
      <div className="flex flex-wrap gap-2 pb-3">
        {!s.lockOn ? <button data-lock-set onClick={() => setStep({ mode: "set", stage: "new" })} className="btn btn-brand btn-sm !h-10">Set a PIN</button> : <>
          <button onClick={() => setStep({ mode: "change", stage: "current" })} className="btn btn-line btn-sm !h-10 text-ink">Change PIN</button>
          <button data-lock-off onClick={() => setStep({ mode: "off", stage: "current" })} className="btn btn-line btn-sm !h-10 text-ink">Turn off</button>
        </>}
      </div>
      {step && (
        <div className="fixed inset-0 z-[97] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}>
          <div role="dialog" aria-modal="true" aria-label={title} className="pop pb-safe-dlg w-full max-w-[400px] rounded-t-[26px] bg-card p-6 ring-1 ring-line sm:rounded-[26px]">
            <div className="flex justify-end"><button onClick={close} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={18} /></button></div>
            <PinPad key={`${step.mode}-${step.stage}`} title={title} sub={step.stage === "new" ? "You'll use it to open Lexari and to view card details." : undefined} error={err} busy={busy} onDone={(p) => void done(p)} />
          </div>
        </div>
      )}
    </div>
  );
}
