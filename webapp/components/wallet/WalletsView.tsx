"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Connection, PublicKey, type ConfirmedSignatureInfo } from "@solana/web3.js";
import { CHAIN_NAME, SOLANA_CLUSTER, SOLANA_RPC, tokenUrl, txUrl } from "@/lib/nft";
import { shortAddr } from "@/content/appData";
import { toast, useApp, type State } from "@/lib/store";
import { useWalletBridge } from "@/lib/walletBridge";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { myAgents, type MyAgent } from "../agents";
import { openAdd } from "../overlays";
import CardVisual from "./CardVisual";
import GetCardDialog from "./GetCardDialog";
import { WALLETS_SOON } from "./AgentMoney";

const copy = (addr: string, what: string) => { navigator.clipboard?.writeText(addr).catch(() => {}); toast({ text: `Copied ${what}` }); };
const ago = (t: number) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };

/** The Solana wallet you signed in with: its devnet balance and latest transactions, read from the chain. */
function PersonalWallet({ s }: { s: State }) {
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

  return (
    <>
      <section data-rise className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
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

function OtherWallet({ s, a }: { s: State; a: MyAgent }) {
  return (
    <li className="flex items-center gap-3 rounded-[20px] bg-card p-3 ring-1 ring-line">
      <AgentTile id={a.id} look={s.agent?.look} size={42} />
      <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-bold text-ink">{a.name}</div><div className="truncate text-[12.5px] text-ink/60">No wallet yet</div></div>
      <button onClick={() => toast({ text: WALLETS_SOON })} className="btn btn-ghost btn-sm !h-9 shrink-0 !px-3 !text-[13px]"><Icon name="plus" size={14} />Create address</button>
    </li>
  );
}

function CardRow({ s, a, onGet }: { s: State; a: MyAgent; onGet: () => void }) {
  return (
    <article data-rise className="grid items-center gap-4 rounded-[24px] bg-card p-4 ring-1 ring-line sm:p-5 md:grid-cols-[minmax(0,320px)_1fr]">
      <CardVisual id={a.id} name={a.name} className="opacity-90" />
      <div className="min-w-0">
        <div className="flex items-center gap-2"><h3 className="truncate text-[17px] font-bold text-ink">{a.name}</h3><span className="label rounded-full border border-dashed border-ink/30 px-2 py-0.5 text-[8px] text-ink/60">No card</span></div>
        <p className="mt-1 text-[14px] leading-snug text-ink/65">{a.id === "home" ? "Let your personal agent pay for what it needs, inside a limit you set." : `${a.name} needs its own card to buy tools or compute for you.`} Each agent's card is bought separately.</p>
        <button onClick={onGet} className="btn btn-brand btn-sm mt-3"><Icon name="plus" size={15} />Get a card</button>
      </div>
    </article>
  );
}

/** Money: each agent can have a wallet and a card. Your personal agent uses your wallet. */
export default function WalletsView() {
  const s = useApp()!;
  const params = useSearchParams();
  const [tab, setTab] = useState<"wallets" | "cards">(params.get("tab") === "cards" ? "cards" : "wallets");
  const [getFor, setGetFor] = useState<string | null>(null);
  const agents = myAgents(s);
  const go = (t: "wallets" | "cards") => { setTab(t); window.history.replaceState(null, "", t === "cards" ? "/app/wallets?tab=cards" : "/app/wallets"); };
  const how = s.auth?.method === "google" ? "Your personal agent uses the wallet made for you when you signed in." : "Your personal agent uses the wallet you signed in with.";
  return (
    <>
      <div data-rise className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="label text-brand-ink">Money</span>
          <h1 className="display mt-3 text-[44px] text-ink sm:text-[60px]">{tab === "wallets" ? "Wallets." : "Cards."}</h1>
          <p className="mt-2 max-w-[38rem] text-[16px] text-ink/70">{tab === "wallets" ? `${how} Other agents can get their own address.` : "A card lets an agent pay for tools and compute inside a limit you set. Each agent buys its own."}</p>
        </div>
        <div className="inline-flex shrink-0 self-start rounded-full bg-tint p-1 sm:self-end" role="tablist" aria-label="Wallets or cards">
          {([["wallets", "wallet", "Wallets"], ["cards", "file", "Cards"]] as const).map(([id, ic, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => go(id)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-bold transition ${tab === id ? "bg-card text-ink shadow-[0_2px_0_var(--color-grape)]" : "text-ink/65 hover:text-ink"}`}><Icon name={ic} size={15} />{l}</button>
          ))}
        </div>
      </div>
      {tab === "wallets" ? (
        <div className="mt-6 grid gap-6">
          <PersonalWallet s={s} />
          <section data-rise>
            <div className="flex items-baseline justify-between gap-3"><h2 className="text-[17px] font-bold text-ink">Other agents</h2><span className="text-[12.5px] text-ink/55">Start without a wallet</span></div>
            {agents.length > 1 ? <ul className="mt-3 grid gap-2">{agents.slice(1).map((a) => <OtherWallet key={a.id} s={s} a={a} />)}</ul>
              : <p className="mt-3 text-[14px] text-ink/60">Add an agent to give it a wallet. <button onClick={() => openAdd()} className="font-bold text-brand-ink">Add an agent</button></p>}
          </section>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">{agents.map((a) => <CardRow key={a.id} s={s} a={a} onGet={() => setGetFor(a.id)} />)}</div>
      )}
      {getFor && <GetCardDialog s={s} id={getFor} onClose={() => setGetFor(null)} />}
    </>
  );
}

export type { State };
