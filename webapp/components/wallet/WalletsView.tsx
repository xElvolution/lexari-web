"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey, type ConfirmedSignatureInfo } from "@solana/web3.js";
import { CHAIN_NAME, SOLANA_CLUSTER, SOLANA_RPC, tokenUrl, txUrl } from "@/lib/nft";
import { shortAddr } from "@/content/appData";
import { toast, useApp, type State } from "@/lib/store";
import { useWalletBridge } from "@/lib/walletBridge";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { myAgents } from "../agents";

const copy = (addr: string, what: string) => { navigator.clipboard?.writeText(addr).catch(() => {}); toast({ text: `Copied ${what}` }); };
const ago = (t: number) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };

/** The Solana wallet you signed in with: its devnet balance and latest transactions, read from the chain. */
export default function WalletsView() {
  const s = useApp()!;
  const bridge = useWalletBridge();
  const addr = s.auth?.address || "";
  const [sol, setSol] = useState<string>("…");
  const [txs, setTxs] = useState<ConfirmedSignatureInfo[] | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!addr) return;
    const conn = new Connection(SOLANA_RPC, "confirmed");
    const pk = new PublicKey(addr);
    conn.getBalance(pk).then((b) => setSol((b / 1e9).toFixed(4))).catch(() => setSol("—"));
    conn.getSignaturesForAddress(pk, { limit: 8 }).then(setTxs).catch(() => setTxs([]));
  }, [addr, n]);
  const home = myAgents(s)[0];
  const connected = !!bridge && bridge.publicKey.toBase58() === addr;
  const how = s.auth?.method === "google" ? "Made for you when you signed in with Google or email." : "The wallet you signed in with.";

  return (
    <>
      <div data-rise>
        <span className="label text-brand-ink">Money</span>
        <h1 className="display mt-3 text-[44px] text-ink sm:text-[60px]">Wallet.</h1>
        <p className="mt-2 max-w-[38rem] text-[16px] text-ink/70">Your agents act with this Solana wallet: ID cards, memories, Hub coins and hires. {how}</p>
      </div>
      <section data-rise className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="grain relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#6a3dff,#5b2bff_45%,#2a0f9a)] p-6 text-white shadow-[0_24px_50px_-28px_rgba(91,43,255,.9)] sm:p-7">
          <div className="flex items-center gap-3">
            <AgentTile id="home" look={s.agent?.look} size={48} className="!bg-white/15" />
            <div className="min-w-0 flex-1"><div className="text-[17px] font-bold">{home?.name || "Your agent"}</div><div className="text-[13px] text-white/75">{connected ? `${bridge!.name} · connected` : "Not connected on this device"}</div></div>
            <span className="label rounded-full bg-white/15 px-2.5 py-1 text-[8.5px]">{CHAIN_NAME}</span>
          </div>
          <div className="mt-7"><div className="label text-[9px] text-white/70">SOL balance</div><div className="display tab-num mt-2 text-[56px] leading-none">{sol}</div></div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {addr && <button onClick={() => copy(addr, "wallet address")} title={addr} className="flex min-w-0 items-center gap-2 rounded-full bg-white/15 py-2 pl-3.5 pr-4 font-mono text-[12.5px] transition hover:bg-white/25"><Icon name="wallet" size={15} /><span className="truncate">{shortAddr(addr)}</span><Icon name="copy" size={14} /></button>}
            {addr && <a href={tokenUrl(addr)} target="_blank" rel="noreferrer" className="rounded-full bg-white/15 px-4 py-2 text-[12.5px] font-semibold transition hover:bg-white/25">Explorer</a>}
            {SOLANA_CLUSTER === "devnet" && <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-[#3514b0]">Get devnet SOL</a>}
            <button onClick={() => setN((x) => x + 1)} className="rounded-full bg-white/15 px-4 py-2 text-[12.5px] font-semibold transition hover:bg-white/25">Refresh</button>
          </div>
          {!connected && <p className="mt-4 text-[13px] text-white/80">{s.auth?.method === "google" ? "Your wallet loads after Google or email sign-in finishes." : "Open your wallet app or extension to sign from this device."}</p>}
        </div>
        <div className="rounded-[28px] bg-card p-5 ring-1 ring-line sm:p-6">
          <h3 className="text-[16px] font-bold text-ink">Recent transactions</h3>
          {txs === null ? <p className="mt-3 text-[14px] text-ink/60">Loading…</p> : !txs.length ? <p className="mt-3 text-[14px] text-ink/60">Nothing yet. A check-in on the Hub is a good first one.</p> : (
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {txs.map((t) => (
                <li key={t.signature}>
                  <a href={txUrl(t.signature)} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.err ? "bg-[#e5484d]/15 text-[#e5484d]" : "bg-tint text-ink/70"}`}><Icon name={t.err ? "x" : "check"} size={15} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-mono text-[13px] text-ink">{shortAddr(t.signature)}</span><span className="block text-[12px] text-ink/50">{t.blockTime ? ago(t.blockTime * 1000) : "pending"}{t.err ? " · failed" : ""}</span></span>
                    <Icon name="arrow" size={14} className="text-ink/40" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

export type { State };
