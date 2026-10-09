"use client";

import { useState } from "react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { api } from "@/lib/api";
import { connection, payer, PAY_BUFFER } from "@/lib/pay";
import { confirmSig } from "@/lib/rpc";
import { txUrl } from "@/lib/nft";
import { ackTx, get, logTx, refreshReceipts, set, useApp, type Msg } from "@/lib/store";
import { nameOf } from "../agents";
import Icon from "../Icon";
import { friendly } from "@/lib/api";
import { shortOf, topUpFor } from "@/lib/balance";
import { refreshBilling } from "@/lib/billing";
import { returnToBalance } from "../wallet/agentWallet";
import { confirmItsYou } from "@/lib/api";
import { PhraseBadge, usePhrase } from "../security/PhraseBadge";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/** A Confirm card in chat: a hired agent asking to be funded from your balance, or a transfer your agent prepared. */
export default function SendCard({ convo, m }: { convo: string; m: Msg & { send: NonNullable<Msg["send"]> } }) {
  if (m.send.kind === "fund") return <FundCard convo={convo} m={m} />;
  return <TransferCard convo={convo} m={m} />;
}

/**
 * A hired agent asks for money for a task, in dollars. Confirm debits your balance and the agent's wallet gets test
 * USDC on devnet. Short balance: Top up opens with the shortfall, then the funding goes through.
 */
function FundCard({ convo, m }: { convo: string; m: Msg & { send: NonNullable<Msg["send"]> } }) {
  const sd = m.send;
  const st = useApp();
  const who = st && sd.agent ? nameOf(st, sd.agent) : "your agent";
  const usd = sd.usd ?? 0;
  const [busy, setBusy] = useState(false);
  const [back, setBack] = useState(false);
  const [err, setErr] = useState(sd.error || "");
  const key = `chat-${m.id}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  const update = (patch: Partial<NonNullable<Msg["send"]>>) => {
    set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === m.id && mm.send ? { ...mm, send: { ...mm.send, ...patch } } : mm)) } }));
    const { status, sig, error } = { ...sd, ...patch };
    if (status !== "pending") void api("/api/messages", { method: "PATCH", body: { convo, clientId: m.id, send: { status, ...(sig ? { sig } : {}), ...(error ? { error: error.slice(0, 200) } : {}) } } }).catch(() => {});
  };
  const confirm = async (): Promise<void> => {
    setErr(""); setBusy(true);
    try {
      const r = await api<{ funding: { status: string; sig: string | null } }>("/api/wallet/fund", { body: { agent: sd.agent, usd, key } });
      if (r.funding.status !== "sent") throw new Error("That transfer didn't go through. Your balance was refunded.");
      update({ status: "sent", ...(r.funding.sig ? { sig: r.funding.sig } : {}) });
      void refreshBilling();
    } catch (e) {
      const s = shortOf(e);
      if (s) { setBusy(false); topUpFor(s, `Funding ${who}`, () => void confirm()); return; }
      setErr(friendly(e, "That didn't go through. Nothing was charged."));
    } finally { setBusy(false); }
  };
  const giveBack = async () => {
    setBack(true);
    const r = await returnToBalance(sd.agent || "", who);
    if (r) set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === m.id && mm.send ? { ...mm, send: { ...mm.send, returned: { sig: r.sig || "", sol: 0, usd: r.micros / 1e6 } } } : mm)) } }));
    setBack(false);
  };
  const legacy = !sd.usd; // an older request in SOL: shown for the record only
  const done = sd.status !== "pending";
  return (
    <div data-send-card data-fund-card className="mt-2 w-[min(300px,100%)] rounded-2xl bg-tint p-3.5 ring-1 ring-line">
      <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-grape text-white"><Icon name="wallet" size={15} /></span><span className="text-[14px] font-bold text-ink">Fund {who}</span><span className="label ml-auto rounded-full bg-[#ffd84d] px-2 py-0.5 text-[8px] text-[#0a0a0a]">Test funds</span></div>
      <dl className="mt-3 space-y-1.5 text-[13.5px]">
        <div className="flex justify-between gap-3"><dt className="text-ink/60">Amount</dt><dd className="tab-num font-bold text-ink">{legacy ? `${sd.sol} SOL` : `$${usd.toFixed(2)}`}</dd></div>
        {sd.reason && <div className="flex justify-between gap-3"><dt className="text-ink/60">For</dt><dd className="min-w-0 text-right text-ink">{sd.reason}</dd></div>}
        <div className="flex justify-between gap-3"><dt className="text-ink/60">From</dt><dd className="text-ink">{legacy ? "Your wallet" : "Your Lexari balance"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink/60">To</dt><dd title={sd.to} className="text-ink">{who}&apos;s wallet</dd></div>
      </dl>
      {!legacy && !done && <p className="mt-2 text-[12px] leading-snug text-ink/55">Arrives as test USDC on Solana devnet. Anything unused can go back to your balance.</p>}
      {sd.status === "sent" && sd.sig && <a data-send-sig href={txUrl(sd.sig)} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-xl bg-[#e7f8ee] px-3 py-2 text-[13px] font-bold text-[#137a3d]"><Icon name="check" size={14} />Funded · receipt {short(sd.sig)}<Icon name="arrow" size={13} className="ml-auto" /></a>}
      {!legacy && sd.status === "sent" && (sd.returned ? <p data-fund-returned className="mt-2 text-[12.5px] font-semibold text-ink/65">{sd.returned.usd ? `$${sd.returned.usd.toFixed(2)} went back to your balance` : "Nothing was left to send back."}</p>
        : <button data-fund-return onClick={() => void giveBack()} disabled={back} className="btn btn-line btn-sm !h-9 mt-2 w-full text-ink disabled:opacity-60">{back ? "Sending back…" : "Task done · leftover to balance"}</button>)}
      {sd.status === "cancelled" && <p className="mt-3 text-[13px] font-semibold text-ink/55">Cancelled. Nothing was sent.</p>}
      {legacy && !done && <p className="mt-3 text-[12.5px] text-ink/55">This older request has expired. Ask {who} again.</p>}
      {err && !done && <p role="alert" className="mt-2 text-[12.5px] text-[#e5484d]">{err}</p>}
      {!legacy && !done && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => update({ status: "cancelled" })} disabled={busy} className="btn btn-line btn-sm !h-9 text-ink">Cancel</button>
          <button data-send-confirm onClick={() => void confirm()} disabled={busy} className="btn btn-brand btn-sm !h-9 flex-1 disabled:opacity-60">{busy ? "Sending…" : `Confirm $${usd.toFixed(2)}`}</button>
        </div>
      )}
    </div>
  );
}

/** A SOL transfer your agent prepared from your sign-in wallet. Nothing is sent until you tap Confirm and sign it. */
function TransferCard({ convo, m }: { convo: string; m: Msg & { send: NonNullable<Msg["send"]> } }) {
  const sd = m.send;
  const [busy, setBusy] = useState<"" | "sign" | "confirm">("");
  const [err, setErr] = useState(sd.error || "");
  const update = (patch: Partial<NonNullable<Msg["send"]>>) => {
    set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === m.id && mm.send ? { ...mm, send: { ...mm.send, ...patch } } : mm)) } }));
    const { status, sig, error } = { ...sd, ...patch };
    if (status !== "pending") void api("/api/messages", { method: "PATCH", body: { convo, clientId: m.id, send: { status, ...(sig ? { sig } : {}), ...(error ? { error: error.slice(0, 200) } : {}) } } }).catch(() => {});
  };
  // Every outcome becomes a receipt in the chat (checked on chain by the server), then the agent follows up on it.
  const kind = sd.kind === "fund" ? "fund" as const : "send" as const;
  const receipt = async (status: "pending" | "confirmed" | "failed" | "cancelled", sig?: string, error?: string, ack = true) => {
    const label = sd.kind === "fund" && sd.agent ? `${nameOf(get(), sd.agent)}'s task wallet` : undefined;
    const r = await logTx(convo, { id: m.id, kind, status, sol: sd.sol, to: sd.to, ...(sig ? { sig } : {}), ...(error ? { error } : {}), ...(sd.agent ? { agent: sd.agent } : {}), ...(label ? { label } : {}) });
    if (ack && r) void ackTx(convo, `tx-${m.id}`, m.from);
  };
  const confirm = async () => {
    setErr("");
    // A first-time address or a large amount: confirm it's you (PIN or wallet) before your wallet signs.
    if (sd.stepup && !(await confirmItsYou(sd.firstTime ? "send to a new address" : "send a large amount"))) { setErr("You didn't confirm. Nothing was sent."); return; }
    setBusy("sign");
    let sent = "";
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
      sent = sig;
      void receipt("pending", sig, undefined, false);
      await confirmSig(c, sig, lastValidBlockHeight).catch((e: Error) => { throw /failed on Solana/.test(e.message) ? new Error("The transfer failed on Solana.") : e; });
      update({ status: "sent", sig });
      await receipt("confirmed", sig);
    } catch (e) {
      const msg = (e as Error).message || "The transfer didn't go through.";
      if (/reject|cancel|denied|closed/i.test(msg) && !sent) { setErr("You didn't approve it. Nothing was sent."); void receipt("cancelled", undefined, "You didn't approve it in your wallet."); }
      else if (sent && /expired|timeout|not confirmed/i.test(msg)) { update({ status: "sent", sig: sent }); void receipt("pending", sent).then(() => refreshReceipts(convo)); }
      else { setErr(msg); if (sent) update({ status: "failed", sig: sent }); void receipt("failed", sent || undefined, msg.slice(0, 200)); }
    } finally { setBusy(""); }
  };
  const done = sd.status !== "pending";
  const phrase = usePhrase();
  void get;
  const st = useApp();
  const fund = sd.kind === "fund";
  const who = fund && st && sd.agent ? nameOf(st, sd.agent) : "";
  const [back, setBack] = useState<"" | "busy">("");
  const giveBack = async () => {
    setBack("busy"); setErr("");
    try {
      const r = await api<{ sig: string | null; sol: number; receipt?: string | null }>("/api/hires/wallet", { body: { slug: sd.agent, action: "return", convo, clientId: m.id } });
      if (!r.sig) setErr("Nothing left to send back.");
      if (r.receipt) { await refreshReceipts(convo); void ackTx(convo, r.receipt, m.from); }
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
        {!fund && sd.valueUsd ? <div className="flex justify-between gap-3"><dt className="text-ink/60">Value</dt><dd className="tab-num text-ink">≈ ${sd.valueUsd.toFixed(2)}</dd></div> : null}
      </dl>
      {!fund && sd.firstTime && sd.status === "pending" && <p data-first-time className="mt-3 flex gap-2 rounded-xl bg-[#fff4d6] px-3 py-2 text-[12.5px] font-semibold leading-snug text-[#7a4b00]"><Icon name="info" size={14} className="mt-0.5 shrink-0" />You&apos;ve never sent to this address. Check every character. Agents can be tricked by web pages and emails.</p>}
      {!done && <div className="mt-3"><PhraseBadge phrase={phrase} compact /></div>}
      {sd.status === "sent" && sd.sig && <a data-send-sig href={txUrl(sd.sig)} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-xl bg-[#e7f8ee] px-3 py-2 text-[13px] font-bold text-[#137a3d]"><Icon name="check" size={14} />Sent · {short(sd.sig)}<Icon name="arrow" size={13} className="ml-auto" /></a>}
      {fund && sd.status === "sent" && (sd.returned ? <p data-fund-returned className="mt-2 text-[12.5px] font-semibold text-ink/65">{sd.returned.sig ? <a href={txUrl(sd.returned.sig)} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Leftover {sd.returned.sol.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} SOL sent back to you (network fee 0.000005 SOL)</a> : "Nothing was left to send back."}</p>
        : <button data-fund-return onClick={() => void giveBack()} disabled={!!back} className="btn btn-line btn-sm !h-9 mt-2 w-full text-ink disabled:opacity-60">{back ? "Sending back…" : "Task done · return leftover"}</button>)}
      {sd.status === "cancelled" && <p className="mt-3 text-[13px] font-semibold text-ink/55">Cancelled. Nothing was sent.</p>}
      {err && !done && <p role="alert" className="mt-2 text-[12.5px] text-[#e5484d]">{err}</p>}
      {!done && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => { update({ status: "cancelled" }); void receipt("cancelled"); }} disabled={!!busy} className="btn btn-line btn-sm !h-9 text-ink">Cancel</button>
          <button data-send-confirm onClick={() => void confirm()} disabled={!!busy} className="btn btn-brand btn-sm !h-9 flex-1 disabled:opacity-60">{busy === "sign" ? "Approve in wallet…" : busy === "confirm" ? "Sending…" : `Confirm ${sd.sol} SOL`}</button>
        </div>
      )}
    </div>
  );
}
