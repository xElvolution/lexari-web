"use client";

import { useEffect, useState } from "react";
import { api, friendly, setStepUpHandler } from "@/lib/api";
import { payer } from "@/lib/pay";
import Icon from "../Icon";
import PinPad from "../lock/PinPad";
import { Sheet, Spinner } from "../billing/parts";
import { PhraseBadge } from "./PhraseBadge";

type Info = { method: "pin" | "wallet"; phrase: string; session: string; until: number };
type Ask = { what: string; done: (ok: boolean) => void };
const b64 = (u: Uint8Array) => { let s = ""; u.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); };

/**
 * "Confirm it's you": shown before high-risk actions (big or first-time sends, new API keys, raising budgets and limits,
 * changing where mail goes). Your anti-phishing phrase is on it, so a fake page can't pass for it. PIN when you have
 * one, otherwise a wallet signature. Good for 5 minutes on this device.
 */
export default function StepUpSheet() {
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => {
    let queue: Promise<boolean> = Promise.resolve(true);
    setStepUpHandler((what) => (queue = queue.then(() => new Promise<boolean>((done) => setAsk({ what, done })))));
    return () => setStepUpHandler(null);
  }, []);
  if (!ask) return null;
  const finish = (ok: boolean) => { ask.done(ok); setAsk(null); };
  return <Body key={ask.what} what={ask.what} onDone={finish} />;
}

function Body({ what, onDone }: { what: string; onDone: (ok: boolean) => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<Info>("/api/security/stepup").then(setInfo, (e) => setErr(friendly(e, "Couldn't load this. Try again."))); }, []);
  const send = async (body: Record<string, string>) => {
    setBusy(true); setErr("");
    try { await api("/api/security/stepup", { method: "POST", body }); onDone(true); }
    catch (e) { setErr(friendly(e, "That didn't work. Try again.")); }
    finally { setBusy(false); }
  };
  const viaWallet = async () => {
    if (!info) return;
    setBusy(true); setErr("");
    try {
      const w = await payer(); if (!w) throw new Error("Your wallet isn't ready on this device yet.");
      const message = `Lexari: confirm it's you\nSession: ${info.session}\nTime: ${Date.now()}`;
      const sig = await w.signMessage(new TextEncoder().encode(message));
      setBusy(false);
      await send({ message, signature: b64(sig) });
    } catch (e) { setBusy(false); const m = (e as Error).message || ""; setErr(/reject|cancel|denied/i.test(m) ? "You didn't confirm." : m || "Couldn't confirm."); }
  };
  const label = what.replace(/\.$/, "");
  return (
    <Sheet label="step-up" title="Confirm it's you" sub={`To ${label}.`} icon={<Icon name="lock" size={20} />} onClose={() => !busy && onDone(false)} closable={!busy}
      footer={info?.method === "wallet" ? (
        <div className="flex gap-2">
          <button onClick={() => onDone(false)} disabled={busy} className="btn btn-line btn-sm flex-1 text-ink">Cancel</button>
          <button data-stepup-wallet onClick={() => void viaWallet()} disabled={busy} className="btn btn-brand btn-sm flex-1 disabled:opacity-60">{busy ? <><Spinner className="mr-2" />Confirming…</> : "Confirm with wallet"}</button>
        </div>
      ) : undefined}>
      <div data-stepup className="space-y-3">
        <PhraseBadge phrase={info?.phrase} loading={!info && !err} />
        {!info && !err && <div className="flex justify-center py-6"><Spinner /></div>}
        {info?.method === "pin" && <div className="py-2"><PinPad title="Enter your PIN" sub="Only you know it. Lexari never asks for it in chat." error={err} busy={busy} onDone={(pin) => void send({ pin })} /></div>}
        {info?.method === "wallet" && (
          <div className="rounded-2xl bg-tint p-4 text-[13.5px] leading-snug text-ink/75">
            Your wallet signs a short message. Nothing is sent and it costs nothing. <span className="font-semibold text-ink">Tip:</span> set an app PIN in Settings so this asks for your PIN instead.
          </div>
        )}
        {err && info?.method !== "pin" && <p role="alert" className="text-[13px] font-semibold text-[#e5484d]">{err}</p>}
        <p className="text-[12px] text-ink/50">This stays confirmed for 5 minutes on this device.</p>
      </div>
    </Sheet>
  );
}
