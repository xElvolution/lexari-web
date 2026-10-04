"use client";

import { useCallback, useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import { PAY_BUFFER, balanceOf, isEmbedded, payer, sendToTreasury, usePaySheet } from "@/lib/pay";
import { toast } from "@/lib/store";
import Icon from "./Icon";

const sol = (l: number) => `${+(l / 1e9).toFixed(4)} SOL`;
const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;
type Faucet = { on: boolean; left: number };

/**
 * The one payment sheet: price, your devnet balance, a one-tap devnet SOL top-up when it's short, then Pay.
 * Errors stay in the sheet (no navigation, no wallet pop-ups that leave the app).
 */
export default function PaySheet() {
  const open = usePaySheet();
  if (!open) return null;
  return <Sheet key={open.req.title + open.req.lamports} />;
}

function Sheet() {
  const open = usePaySheet()!;
  const { req, done } = open;
  const need = req.lamports + PAY_BUFFER;
  const [addr, setAddr] = useState<string>("");
  const [bal, setBal] = useState<number | null>(null);
  const [faucet, setFaucet] = useState<Faucet | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "funding" | "paying" | "verifying" | "done" | "nowallet">("loading");
  const [err, setErr] = useState("");
  const [fundTx, setFundTx] = useState("");
  const [tx, setTx] = useState("");

  const refresh = useCallback(async () => {
    const w = await payer();
    if (!w) { setPhase("nowallet"); return null; }
    const a = w.publicKey.toBase58(); setAddr(a);
    const [b, f] = await Promise.all([balanceOf(a).catch(() => null), api<Faucet>("/api/faucet").catch(() => null)]);
    setBal(b); setFaucet(f);
    return b;
  }, []);
  useEffect(() => { void refresh().then((b) => { setPhase((p) => (p === "loading" ? (b === undefined ? "nowallet" : "ready") : p)); }); }, [refresh]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && (phase === "ready" || phase === "nowallet")) done({ ok: false, error: "", cancelled: true }); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [phase, done]);

  const short_ = bal !== null && bal < need;
  const busy = phase === "funding" || phase === "paying" || phase === "verifying";

  const fund = async () => {
    setErr(""); setPhase("funding");
    try {
      const r = await api<{ tx: string; lamports: number; balance: number | null }>("/api/faucet", { method: "POST", body: { need: Math.max(0, need - (bal ?? 0)) } });
      setFundTx(r.tx);
      // wait until the RPC shows it
      for (let i = 0; i < 10; i++) { const b = await refresh(); if (b !== null && b >= need) break; await new Promise((x) => setTimeout(x, 1200)); }
      toast({ text: `${sol(r.lamports)} devnet SOL added to your wallet`, face: "home" });
    } catch (e) { setErr(friendly(e, "Couldn't get devnet SOL.")); }
    setPhase("ready");
  };

  const pay = async () => {
    setErr("");
    const w = await payer();
    if (!w) { setPhase("nowallet"); return; }
    const b = await balanceOf(w.publicKey.toBase58()).catch(() => null);
    if (b !== null) setBal(b);
    if (b !== null && b < need) { setErr(`You need ${sol(need)} devnet SOL. You have ${sol(b)}.`); return; }
    setPhase("paying");
    let sig = "";
    try { sig = await sendToTreasury(w, req.lamports); setTx(sig); }
    catch (e) { setErr(friendly(e, "The wallet did not pay.")); setPhase("ready"); return; }
    setPhase("verifying");
    try { const result = await req.record(sig); setPhase("done"); setTimeout(() => done({ ok: true, tx: sig, result }), 900); }
    catch (e) { setErr(`${friendly(e, "We could not verify the payment.")} Your payment ${short(sig)} went through; tap Try again to check it.`); setPhase("ready"); }
  };
  const retryVerify = async () => {
    setErr(""); setPhase("verifying");
    try { const result = await req.record(tx); setPhase("done"); setTimeout(() => done({ ok: true, tx, result }), 900); }
    catch (e) { setErr(friendly(e, "We could not verify the payment.")); setPhase("ready"); }
  };
  const close = () => { if (!busy) done({ ok: false, error: "", cancelled: true }); };
  const copy = () => { void navigator.clipboard?.writeText(addr).then(() => toast({ text: "Address copied" }), () => {}); };

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="pay-title" data-pay-sheet className="pop pb-safe-dlg w-full max-w-[420px] rounded-t-[26px] bg-card p-5 ring-1 ring-line sm:rounded-[26px] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-grape text-white"><Icon name="wallet" size={20} /></span>
          <div className="min-w-0 flex-1"><h2 id="pay-title" className="display text-[24px] leading-none text-ink">{req.title}</h2><p className="mt-1 text-[13px] text-ink/60">{req.what}</p></div>
          <button onClick={close} disabled={busy} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-tint disabled:opacity-40"><Icon name="x" size={19} /></button>
        </div>

        <dl className="mt-4 divide-y divide-[var(--line)] rounded-2xl bg-tint px-4 text-[14px]">
          <div className="flex items-center justify-between py-2.5"><dt className="text-ink/65">Price</dt><dd className="font-bold text-ink">{sol(req.lamports)} · devnet</dd></div>
          <div className="flex items-center justify-between py-2.5"><dt className="text-ink/65">Your balance</dt><dd data-balance className={`font-bold ${short_ ? "text-[#e5484d]" : "text-ink"}`}>{bal === null ? (phase === "loading" ? "Checking…" : "Unavailable") : sol(bal)}</dd></div>
          {addr && <div className="flex items-center justify-between gap-2 py-2.5"><dt className="text-ink/65">{isEmbedded() ? "Lexari wallet" : "Wallet"}</dt><dd><button onClick={copy} className="flex items-center gap-1.5 font-mono text-[12.5px] text-brand-ink">{short(addr)}<Icon name="copy" size={12} /></button></dd></div>}
        </dl>

        {phase === "nowallet" && (
          <p role="alert" className="mt-3 rounded-2xl bg-[#e5484d]/10 p-3 text-[13.5px] leading-snug text-ink">
            {isEmbedded() ? "Your Lexari wallet is still loading. Wait a moment and try again, or sign out and back in." : "Connect the wallet you signed in with (open Lexari in Phantom, Solflare or Backpack), then try again."}
          </p>
        )}

        {short_ && phase !== "done" && (
          <div data-need-funds className="mt-3 rounded-2xl bg-grape/10 p-3.5 ring-1 ring-grape/30">
            <p className="text-[14px] font-bold text-ink">You need {sol(need)} devnet SOL</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink/65">Devnet SOL is free test money. It covers the price plus a tiny network fee.</p>
            {faucet?.on && faucet.left > 5_000_000 ? (
              <button onClick={fund} disabled={busy} className="btn btn-brand btn-sm mt-3 w-full disabled:opacity-60">{phase === "funding" ? "Sending devnet SOL…" : "Get devnet SOL"}</button>
            ) : (
              <p className="mt-2 text-[12.5px] text-ink/70">{faucet && !faucet.left ? "You've used your free devnet SOL. " : ""}Get some at <a className="font-bold text-brand-ink underline" href="https://faucet.solana.com" target="_blank" rel="noreferrer">faucet.solana.com</a> for the address above, then come back.</p>
            )}
            {fundTx && <a href={`https://explorer.solana.com/tx/${fundTx}?cluster=devnet`} target="_blank" rel="noreferrer" className="mt-2 block truncate font-mono text-[11.5px] text-brand-ink">Top-up {short(fundTx)}</a>}
          </div>
        )}

        {err && <p role="alert" data-pay-error className="mt-3 text-[13.5px] leading-snug text-[#e5484d]">{err}</p>}

        {phase === "done" ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-grape px-4 py-3 text-[14.5px] font-bold text-white"><Icon name="check" size={18} />Paid{tx ? ` · ${short(tx)}` : ""}</div>
        ) : tx && err ? (
          <button onClick={retryVerify} className="btn btn-brand btn-sm mt-4 w-full">Try again</button>
        ) : (
          <button data-pay onClick={pay} disabled={busy || phase === "loading" || phase === "nowallet" || short_} className="btn btn-brand btn-sm mt-4 w-full disabled:opacity-50 disabled:shadow-none">
            {phase === "paying" ? "Paying…" : phase === "verifying" ? "Checking on Solana…" : `Pay ${sol(req.lamports)}`}
          </button>
        )}
        <p className="mt-2 text-center text-[11.5px] text-ink/45">Devnet only. No real money moves.</p>
      </div>
    </div>
  );
}
