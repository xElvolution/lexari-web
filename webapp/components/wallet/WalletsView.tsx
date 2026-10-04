"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Connection, PublicKey, type ConfirmedSignatureInfo } from "@solana/web3.js";
import { CHAIN_NAME, SOLANA_CLUSTER, SOLANA_RPC, tokenUrl, txUrl } from "@/lib/nft";
import { shortAddr } from "@/content/appData";
import { isCreated, toast, useApp, type State } from "@/lib/store";
import { useWalletBridge } from "@/lib/walletBridge";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { myAgents, type MyAgent } from "../agents";
import { openAdd } from "../overlays";
import CardVisual from "./CardVisual";
import GetCardDialog from "./GetCardDialog";
import { cardFor, useCards } from "./useCards";
import type { Card } from "@/lib/pay";
import { MASK, setHideBalance, useHideBalance } from "@/lib/privacy";
import CardSheet from "./CardSheet";

const copy = (addr: string, what: string) => { navigator.clipboard?.writeText(addr).catch(() => {}); toast({ text: `Copied ${what}` }); };
const ago = (t: number) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };

function TxRow({ t }: { t: ConfirmedSignatureInfo }) {
  return (
    <li>
      <a href={txUrl(t.signature)} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.err ? "bg-[#e5484d]/15 text-[#e5484d]" : "bg-tint text-ink/70"}`}><Icon name={t.err ? "x" : "check"} size={15} /></span>
        <span className="min-w-0 flex-1"><span className="block truncate font-mono text-[13px] text-ink">{shortAddr(t.signature)}</span><span className="block text-[12px] text-ink/50">{t.blockTime ? ago(t.blockTime * 1000) : "pending"}{t.err ? " · failed" : ""}</span></span>
        <Icon name="arrow" size={14} className="text-ink/40" />
      </a>
    </li>
  );
}

/** Every recent transaction (up to 25 from the chain) in a sheet, with the explorer one tap away. */
function AllTxs({ txs, addr, onClose }: { txs: ConfirmedSignatureInfo[]; addr: string; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="All transactions" data-all-txs className="pop pb-safe-dlg flex max-h-[88dvh] w-full max-w-[460px] flex-col rounded-t-[26px] bg-card p-5 ring-1 ring-line sm:rounded-[26px]">
        <div className="flex items-center justify-between"><h2 className="display text-[24px] text-ink">Transactions</h2><button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button></div>
        <p className="mt-1 text-[13px] text-ink/55">Your latest {txs.length} on Solana devnet.</p>
        <ul className="no-bar mt-2 min-h-0 flex-1 divide-y divide-[var(--line)] overflow-y-auto overscroll-contain">{txs.map((t) => <TxRow key={t.signature} t={t} />)}</ul>
        <a href={tokenUrl(addr)} target="_blank" rel="noreferrer" className="mt-3 rounded-full bg-tint py-3 text-center text-[14px] font-bold text-brand-ink">Open in Solana Explorer</a>
      </div>
    </div>
  );
}

/** The Solana wallet you signed in with: its devnet balance and latest transactions, read from the chain. */
function PersonalWallet({ s }: { s: State }) {
  const bridge = useWalletBridge();
  const addr = s.auth?.address || "";
  const [sol, setSol] = useState<string>("…");
  const [txs, setTxs] = useState<ConfirmedSignatureInfo[] | null>(null);
  const [n, setN] = useState(0);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!addr) return;
    const conn = new Connection(SOLANA_RPC, "confirmed");
    const pk = new PublicKey(addr);
    conn.getBalance(pk).then((b) => setSol((b / 1e9).toFixed(4))).catch(() => setSol("—"));
    conn.getSignaturesForAddress(pk, { limit: 25 }).then(setTxs).catch(() => setTxs([]));
  }, [addr, n]);
  const home = myAgents(s)[0];
  const hide = useHideBalance();
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
          <div className="mt-7"><div className="flex items-center gap-2"><span className="label text-[9px] text-white/70">SOL balance</span><button data-hide-balance onClick={() => setHideBalance(!hide)} aria-label={hide ? "Show balance" : "Hide balance"} aria-pressed={hide} className="grid h-7 w-7 place-items-center rounded-full bg-white/15 hover:bg-white/25"><Icon name={hide ? "eyeoff" : "eye"} size={14} /></button></div><div data-balance className="display tab-num mt-2 text-[56px] leading-none">{hide ? MASK : sol}</div></div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {addr && <button onClick={() => copy(addr, "wallet address")} title={addr} className="flex min-w-0 items-center gap-2 rounded-full bg-white/15 py-2 pl-3.5 pr-4 font-mono text-[12.5px] transition hover:bg-white/25"><Icon name="wallet" size={15} /><span className="truncate">{shortAddr(addr)}</span><Icon name="copy" size={14} /></button>}
            {addr && <a href={tokenUrl(addr)} target="_blank" rel="noreferrer" className="rounded-full bg-white/15 px-4 py-2 text-[12.5px] font-semibold transition hover:bg-white/25">Explorer</a>}
            {SOLANA_CLUSTER === "devnet" && <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-[#3514b0]">Get devnet SOL</a>}
            <button onClick={() => setN((x) => x + 1)} className="rounded-full bg-white/15 px-4 py-2 text-[12.5px] font-semibold transition hover:bg-white/25">Refresh</button>
          </div>
          {!connected && <p className="mt-4 text-[13px] text-white/80">{s.auth?.method === "google" ? "Your wallet loads after Google or email sign-in finishes." : "Open your wallet app or extension to sign from this device."}</p>}
        </div>
        <div className="rounded-[28px] bg-card p-5 ring-1 ring-line sm:p-6">
          <div className="flex items-center justify-between"><h3 className="text-[16px] font-bold text-ink">Recent transactions</h3>{addr && !!txs?.length && <button data-view-all onClick={() => setAll(true)} className="text-[13px] font-bold text-brand-ink hover:underline">View all</button>}</div>
          {txs === null ? <p className="mt-3 text-[14px] text-ink/60">Loading…</p> : !txs.length ? <p className="mt-3 text-[14px] text-ink/60">Nothing yet. A check-in on the Hub is a good first one.</p> : (
            <ul data-tx-list className="no-bar mt-3 max-h-[250px] divide-y divide-[var(--line)] overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,black_86%,transparent)]">
              {txs.slice(0, 5).map((t) => <TxRow key={t.signature} t={t} />)}
            </ul>
          )}
        </div>
      </section>
      {all && txs && <AllTxs txs={txs} addr={addr} onClose={() => setAll(false)} />}
    </>
  );
}

/** An agent you made: it spends from your wallet, inside its card limit. */
function OtherWallet({ s, a, card, onCard }: { s: State; a: MyAgent; card: Card | null; onCard: () => void }) {
  const hide = useHideBalance();
  const left = card ? Math.max(0, card.limit - card.spent) : 0;
  return (
    <li data-agent-wallet={a.id} className="rounded-[22px] bg-card p-4 ring-1 ring-line">
      <div className="flex items-center gap-3">
        <AgentTile id={a.id} look={s.agent?.look} size={44} />
        <div className="min-w-0 flex-1"><div className="truncate text-[15.5px] font-bold text-ink">{a.name}&apos;s wallet</div><div className="truncate text-[12.5px] text-ink/60">Spends from your wallet{s.auth?.address ? ` · ${shortAddr(s.auth.address)}` : ""}</div></div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-tint p-2"><div className="label text-[8px] text-ink/50">Can spend</div><div className="tab-num mt-0.5 text-[15px] font-bold text-ink">{card ? (hide ? MASK : `$${left}`) : "—"}</div></div>
        <div className="rounded-xl bg-tint p-2"><div className="label text-[8px] text-ink/50">Spent</div><div className="tab-num mt-0.5 text-[15px] font-bold text-ink">{card ? (hide ? MASK : `$${card.spent}`) : "$0"}</div></div>
        <div className="rounded-xl bg-tint p-2"><div className="label text-[8px] text-ink/50">Card</div><div className="mt-0.5 text-[15px] font-bold text-ink">{card ? `··${card.last4}` : "None"}</div></div>
      </div>
      <button onClick={onCard} className="btn btn-line btn-sm mt-3 w-full text-ink">{card ? "Open card" : "Get a card"}</button>
    </li>
  );
}

/** One card: the card itself, a thin usage bar and a centred View card button. Everything else is in the card sheet. */
function CardRow({ a, card, onGet, onOpen }: { a: MyAgent; card: Card | null; onGet: () => void; onOpen: () => void }) {
  const pct = card ? Math.min(100, Math.round((card.spent / Math.max(1, card.limit)) * 100)) : 0;
  return (
    <article data-rise data-card-row={a.id} className="mx-auto flex w-full max-w-[400px] flex-col items-center gap-3 rounded-[24px] bg-card p-4 ring-1 ring-line">
      {card ? <button data-open-card={a.id} onClick={onOpen} aria-label={`Open ${a.name}'s card`} className="block w-full text-left transition active:scale-[.98]"><CardVisual id={a.id} name={a.name} card={card} /></button> : <CardVisual id={a.id} name={a.name} card={card} className="w-full opacity-90" />}
      {card ? (
        <>
          <div data-card-usage className="w-full px-1" aria-label={`${pct}% of the monthly limit used`}>
            <div className="h-1 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-grape" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1.5 text-right text-[11.5px] font-semibold tabular-nums text-ink/55">{pct}% used</div>
          </div>
          <button data-view-card-row onClick={onOpen} className="btn btn-brand btn-sm"><Icon name="eye" size={15} />View card</button>
        </>
      ) : (
        <button onClick={onGet} className="btn btn-brand btn-sm"><Icon name="plus" size={15} />Get a card for {a.name}</button>
      )}
    </article>
  );
}

/** Money: each agent can have a wallet and a card. Your personal agent uses your wallet. */
export default function WalletsView() {
  const s = useApp()!;
  const params = useSearchParams();
  const [tab, setTab] = useState<"wallets" | "cards">(params.get("tab") === "cards" ? "cards" : "wallets");
  const [getFor, setGetFor] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  // Wallets and cards belong to the agents you made. A hired specialist has its own task wallet (see its profile).
  const agents = myAgents(s).filter((a) => isCreated(s, a.id));
  const cards = useCards();
  const go = (t: "wallets" | "cards") => { setTab(t); window.history.replaceState(null, "", t === "cards" ? "/wallets?tab=cards" : "/wallets"); };
  const how = s.auth?.method === "google" ? "Your personal agent uses the wallet made for you when you signed in." : "Your personal agent uses the wallet you signed in with.";
  return (
    <>
      <div data-rise className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="label text-brand-ink">Money</span>
          <h1 className="display mt-3 text-[44px] text-ink sm:text-[60px]">{tab === "wallets" ? "Wallets." : "Cards."}</h1>
          <p className="mt-2 max-w-[38rem] text-[16px] text-ink/70">{tab === "wallets" ? `${how} Your other agents pay with it too.` : "A card lets an agent pay for tools and compute inside a limit you set. Each agent buys its own."}</p>
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
            <div className="flex items-baseline justify-between gap-3"><h2 className="text-[17px] font-bold text-ink">Agent wallets</h2><span className="text-[12.5px] text-ink/55">Agents you made</span></div>
            {agents.length > 1 ? <ul className="mt-3 grid gap-2">{agents.slice(1).map((a) => { const c = cardFor(cards, a.id); return <OtherWallet key={a.id} s={s} a={a} card={c} onCard={() => (c ? setOpenFor(a.id) : setGetFor(a.id))} />; })}</ul>
              : <p className="mt-3 text-[14px] text-ink/60">Agents you make get a wallet here. <button onClick={() => openAdd("create")} className="font-bold text-brand-ink">Create an agent</button></p>}
            {s.hired.length > 0 && <p data-hired-wallet-note className="mt-3 text-[12.5px] leading-snug text-ink/55">Hired specialists don&apos;t use your wallet. Each has its own task wallet and asks you in chat when a task needs funds.</p>}
          </section>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">{agents.map((a) => <CardRow key={a.id} a={a} card={cardFor(cards, a.id)} onGet={() => setGetFor(a.id)} onOpen={() => setOpenFor(a.id)} />)}</div>
      )}
      {getFor && <GetCardDialog s={s} id={getFor} onClose={() => setGetFor(null)} />}
      {openFor && cardFor(cards, openFor) && <CardSheet agent={openFor} name={agents.find((a) => a.id === openFor)?.name || "Agent"} card={cardFor(cards, openFor)!} onClose={() => setOpenFor(null)} />}
    </>
  );
}

export type { State };
