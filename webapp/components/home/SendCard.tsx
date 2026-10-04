"use client";

import { useState } from "react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { api } from "@/lib/api";
import { connection, payer, PAY_BUFFER } from "@/lib/pay";
import { txUrl } from "@/lib/nft";
import { get, set, useApp, type Msg } from "@/lib/store";
import { nameOf } from "../agents";
import Icon from "../Icon";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/** A SOL transfer your agent prepared in chat. Nothing is sent until you tap Confirm and your wallet signs it. */
export default function SendCard({ convo, m }: { convo: string; m: Msg & { send: NonNullable<Msg["send"]> } }) {
  const sd = m.send;
  const [busy, setBusy] = useState<"" | "sign" | "confirm">("");
  const [err, setErr] = useState(sd.error || "");
  const update = (patch: Partial<NonNullable<Msg["send"]>>) => {
    set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === m.id && mm.send ? { ...mm, send: { ...mm.send, ...patch } } : mm)) } }));
    const { status, sig, error } = { ...sd, ...patch };
    if (status !== "pending") void api("/api/messages", { method: "PATCH", body: { convo, clientId: m.id, send: { status, ...(sig ? { sig } : {}), ...(error ? { error: error.slice(0, 200) } : {}) } } }).catch(() => {});
  };
  const confirm = async () => {
    setErr(""); setBusy("sign");
    try {
      const w = await payer();
      if (!w) throw new Error("Your wallet isn't ready on this device yet. Try again in a moment.");
      const c = connection();
      const lamports = Math.round(sd.sol * 1e9);
      const bal = await c.getBalance(w.publicKey, "confirmed");
      if (bal < lamports + PAY_BUFFER / 2) throw new Error(`Not enough SOL. You have ${(bal / 1e9).toFixed(4)} SOL.`);
      const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
      const tx = new Transaction({ feePayer: w.publicKey, blockhash, lastValidBlockHeight }).add(SystemProgram.transfer({ fromPubkey: w.publicKey, toPubkey: new PublicKey(sd.to), lamports }));
      const signed = await w.signTransaction(tx);
      setBusy("confirm");
      const sig = await c.sendRawTransaction(signed.serialize());
      const r = await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      if (r.value.err) throw new Error("The transfer failed on Solana.");
      update({ status: "sent", sig });
    } catch (e) {
      const msg = (e as Error).message || "The transfer didn't go through.";
      if (/reject|cancel|denied|closed/i.test(msg)) setErr("You didn't approve it. Nothing was sent.");
      else setErr(msg);
    } finally { setBusy(""); }
  };
  const done = sd.status !== "pending";
  void get;
  const st = useApp();
  const fund = sd.kind === "fund";
  const who = fund && st && sd.agent ? nameOf(st, sd.agent) : "";
  const [back, setBack] = useState<"" | "busy">("");
  const giveBack = async () => {
    setBack("busy"); setErr("");
    try {
      const r = await api<{ sig: string | null; sol: number }>("/api/hires/wallet", { body: { slug: sd.agent, action: "return", convo, clientId: m.id } });
      if (!r.sig) setErr("Nothing left to send back.");
      set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === m.id && mm.send ? { ...mm, send: { ...mm.send, returned: { sig: r.sig || "", sol: r.sol } } } : mm)) } }));
    } catch (e) { setErr((e as Error).message || "Couldn't send it back."); }
    finally { setBack(""); }
  };
  return (
    <div data-send-card className="mt-2 w-[min(300px,100%)] rounded-2xl bg-tint p-3.5 ring-1 ring-line">
      <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-grape text-white"><Icon name="wallet" size={15} /></span><span className="text-[14px] font-bold text-ink">{fund ? `Fund ${who}'s task` : "Send SOL"}</span><span className="label ml-auto rounded-full bg-[#ffd84d] px-2 py-0.5 text-[8px] text-[#0a0a0a]">Devnet</span></div>
      <dl className="mt-3 space-y-1.5 text-[13.5px]">
        <div className="flex justify-between gap-3"><dt className="text-ink/60">Amount</dt><dd className="tab-num font-mono font-bold text-ink">{sd.sol} SOL</dd></div>
        {fund && sd.reason && <div className="flex justify-between gap-3"><dt className="text-ink/60">For</dt><dd className="min-w-0 text-right text-ink">{sd.reason}</dd></div>}
        <div className="flex justify-between gap-3"><dt className="text-ink/60">To</dt><dd title={sd.to} className="font-mono text-ink">{fund ? <>{who}&apos;s wallet · {short(sd.to)}</> : short(sd.to)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink/60">From</dt><dd className="text-ink">Your wallet</dd></div>
      </dl>
      {sd.status === "sent" && sd.sig && <a data-send-sig href={txUrl(sd.sig)} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-xl bg-[#e7f8ee] px-3 py-2 text-[13px] font-bold text-[#137a3d]"><Icon name="check" size={14} />Sent · {short(sd.sig)}<Icon name="arrow" size={13} className="ml-auto" /></a>}
      {fund && sd.status === "sent" && (sd.returned ? <p data-fund-returned className="mt-2 text-[12.5px] font-semibold text-ink/65">{sd.returned.sig ? <a href={txUrl(sd.returned.sig)} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Leftover {sd.returned.sol.toFixed(4)} SOL sent back to you</a> : "Nothing was left to send back."}</p>
        : <button data-fund-return onClick={() => void giveBack()} disabled={!!back} className="btn btn-line btn-sm !h-9 mt-2 w-full text-ink disabled:opacity-60">{back ? "Sending back…" : "Task done · return leftover"}</button>)}
      {sd.status === "cancelled" && <p className="mt-3 text-[13px] font-semibold text-ink/55">Cancelled. Nothing was sent.</p>}
      {err && !done && <p role="alert" className="mt-2 text-[12.5px] text-[#e5484d]">{err}</p>}
      {!done && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => update({ status: "cancelled" })} disabled={!!busy} className="btn btn-line btn-sm !h-9 text-ink">Cancel</button>
          <button data-send-confirm onClick={() => void confirm()} disabled={!!busy} className="btn btn-brand btn-sm !h-9 flex-1 disabled:opacity-60">{busy === "sign" ? "Approve in wallet…" : busy === "confirm" ? "Sending…" : `Confirm ${sd.sol} SOL`}</button>
        </div>
      )}
    </div>
  );
}
