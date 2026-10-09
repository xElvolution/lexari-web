"use client";

import type { TxReceipt as Tx } from "@/lib/store";
import Icon from "../Icon";

const short = (a?: string) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");
const sol = (n: number) => `${+n.toFixed(6)} SOL`;
const TITLE: Record<Tx["kind"], string> = { send: "Sent", fund: "Funded task", return: "Leftover returned", hire: "Hire paid", plan: "Plan paid", card: "Card paid", mint: "ID card minted", incoming: "Received", pay: "Agent paid", topup: "Balance topped up" };
const NOT: Record<Tx["kind"], string> = { send: "Send", fund: "Funding", return: "Return", hire: "Hire payment", plan: "Plan payment", card: "Card payment", mint: "Mint", incoming: "Incoming", pay: "Agent payment", topup: "Top up" };

/** A compact receipt row in the chat: what moved, to whom, the live status and the explorer link. */
export default function TxReceipt({ tx }: { tx: Tx }) {
  const st = tx.status;
  const tone = st === "confirmed" ? "bg-[#e7f8ee] text-[#137a3d]" : st === "failed" ? "bg-[#e5484d]/10 text-[#c7353a]" : st === "cancelled" ? "bg-tint text-ink/55" : "bg-[#fff6d6] text-[#8a6500]";
  const title = st === "cancelled" ? `${NOT[tx.kind]} cancelled` : st === "failed" ? `${NOT[tx.kind]} failed` : st === "pending" ? `${NOT[tx.kind]} pending` : TITLE[tx.kind];
  const who = tx.kind === "incoming" ? `from ${tx.label || short(tx.from)}` : tx.kind === "mint" ? "" : tx.to ? `to ${tx.label || short(tx.to)}` : "";
  const body = (
    <>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${st === "confirmed" ? "bg-[#137a3d] text-white" : st === "failed" ? "bg-[#e5484d] text-white" : st === "cancelled" ? "bg-ink/20 text-ink/70" : "bg-[#ffd84d] text-[#0a0a0a]"}`}>
        {st === "pending" ? <i className="h-3 w-3 animate-spin rounded-full border-2 border-[#0a0a0a] border-t-transparent" /> : <Icon name={st === "confirmed" ? (tx.kind === "incoming" ? "arrow" : "check") : "x"} size={12} stroke={3} className={tx.kind === "incoming" && st === "confirmed" ? "rotate-90" : ""} />}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block break-words text-[12.5px] font-bold">{title}{tx.amount ? ` · ${tx.amount}` : tx.sol ? ` · ${sol(tx.sol)}` : ""}{who ? ` ${who}` : ""}</span>
        <span className="block break-words text-[11px] font-semibold leading-snug opacity-75">
          {st === "pending" ? `Waiting for ${tx.net || "Solana devnet"}…` : st === "confirmed" ? `Confirmed on ${tx.net || "devnet"}${tx.balance !== undefined && tx.balance >= 0 ? ` · balance ${sol(tx.balance)}` : ""}` : st === "failed" ? tx.error || "Didn't go through" : "Nothing was sent"}
          {tx.sig ? ` · ${short(tx.sig)}` : ""}
        </span>
      </span>
      {tx.sig && <Icon name="arrow" size={13} className="shrink-0 opacity-70" />}
    </>
  );
  const cls = `flex w-[min(340px,100%)] items-center gap-2.5 rounded-2xl px-3 py-2 ring-1 ring-black/5 ${tone}`;
  return (
    <div data-tx-receipt={tx.status} data-tx-kind={tx.kind} className="my-2 flex justify-center">
      {tx.sig ? <a href={tx.url || `https://explorer.solana.com/tx/${tx.sig}?cluster=devnet`} target="_blank" rel="noreferrer" title="View on the explorer" className={`${cls} hover:brightness-[0.98]`}>{body}</a> : <div className={cls}>{body}</div>}
    </div>
  );
}
