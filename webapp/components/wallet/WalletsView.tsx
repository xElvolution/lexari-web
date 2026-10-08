"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { isCreated, useApp, type State } from "@/lib/store";
import { openTopUp } from "@/lib/billing";
import Icon from "../Icon";
import { myAgents, type MyAgent } from "../agents";
import { openAdd } from "../overlays";
import { money } from "../billing/parts";
import CardVisual from "./CardVisual";
import GetCardDialog from "./GetCardDialog";
import { cardFor, useCards } from "./useCards";
import type { Card } from "@/lib/pay";
import { MASK, setHideBalance, useHideBalance } from "@/lib/privacy";
import CardSheet from "./CardSheet";
import { AgentWalletCard, useWallet, type WalletData } from "./agentWallet";
import HistorySheet from "./HistorySheet";

/** Your Lexari balance in dollars: Top up by card or USDC, and History in its own sheet. */
function Balance({ d }: { d: WalletData | null | undefined }) {
  const hide = useHideBalance();
  const [open, setOpen] = useState(false);
  const hist = d?.history ?? [];
  return (
    <section data-rise className="min-w-0">
      <div data-lexari-balance className="grain relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#6a3dff,#5b2bff_45%,#2a0f9a)] p-6 text-white shadow-[0_24px_50px_-28px_rgba(91,43,255,.9)] sm:p-7">
        <div className="flex items-center gap-2"><span className="label text-[9px] text-white/75">Lexari balance</span><button data-hide-balance onClick={() => setHideBalance(!hide)} aria-label={hide ? "Show balance" : "Hide balance"} aria-pressed={hide} className="grid h-7 w-7 place-items-center rounded-full bg-white/15 hover:bg-white/25"><Icon name={hide ? "eyeoff" : "eye"} size={14} /></button></div>
        <div data-balance className="display tab-num mt-3 text-[56px] leading-none">{d === undefined ? "…" : hide ? MASK : money(d?.balance ?? 0, { cents: true })}</div>
        <p className="mt-3 max-w-[28rem] text-[13.5px] leading-snug text-white/80">Pays for AI usage past your plan, hires, agent cards and funding your agents.</p>
        <div data-balance-actions className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button data-open-topup onClick={() => openTopUp({ product: "credits" })} className="btn btn-white btn-sm !h-11 w-full sm:w-auto"><Icon name="plus" size={16} />Top up</button>
          <button data-open-history onClick={() => setOpen(true)} aria-haspopup="dialog" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/15 px-4 text-[14px] font-bold ring-1 ring-white/20 transition hover:bg-white/25 active:scale-[.98] sm:w-auto">
            <Icon name="clock" size={16} />History{hist.length ? <span className="tab-num rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] leading-none">{hist.length}</span> : null}
          </button>
        </div>
      </div>
      {open && <HistorySheet rows={hist} loading={d === undefined} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** Every agent on your team has its own wallet, separate from your balance. */
function AgentWallets({ s, d }: { s: State; d: WalletData | null | undefined }) {
  const names = new Map(myAgents(s).map((a) => [a.id, a.name]));
  const list = d?.agents ?? [];
  return (
    <section data-rise className="min-w-0">
      <div className="flex items-baseline justify-between gap-3"><h2 className="text-[17px] font-bold text-ink">Your agents&apos; wallets</h2><span className="text-[12.5px] text-ink/55">One per agent</span></div>
      <p className="mt-1 text-[13px] leading-snug text-ink/60">Each agent holds its own funds for tasks. Fund one from your balance; what&apos;s left can come back.</p>
      {d === undefined ? <p className="mt-3 text-[14px] text-ink/60">Loading…</p> : !list.length ? <p className="mt-3 text-[14px] text-ink/60">No agents yet. <button onClick={() => openAdd("create")} className="font-bold text-brand-ink">Create an agent</button></p> : (
        <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2">{list.map((a) => <AgentWalletCard key={a.slug} a={a} name={names.get(a.slug) || a.name || "Agent"} look={a.slug === "home" ? s.agent?.look : undefined} funding={d!.funding} fundings={d!.fundings} />)}</ul>
      )}
      {d && <p className="mt-3 text-[12px] leading-snug text-ink/50">{d.funding.network === "devnet" ? "Test funds on Solana devnet, not real money. " : ""}Base and Ethereum wallets are coming later.</p>}
    </section>
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

/** Money: your Lexari balance on top, then each agent's own wallet. Cards live on their own tab. */
export default function WalletsView() {
  const s = useApp()!;
  const params = useSearchParams();
  const [tab, setTab] = useState<"wallets" | "cards">(params.get("tab") === "cards" ? "cards" : "wallets");
  const [getFor, setGetFor] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const d = useWallet();
  // Cards belong to the agents you made. A hired specialist uses its own wallet instead.
  const agents = myAgents(s).filter((a) => isCreated(s, a.id));
  const cards = useCards();
  const go = (t: "wallets" | "cards") => { setTab(t); window.history.replaceState(null, "", t === "cards" ? "/wallets?tab=cards" : "/wallets"); };
  return (
    <>
      <div data-rise className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="label text-brand-ink">Money</span>
          <h1 className="display mt-3 text-[44px] text-ink sm:text-[60px]">{tab === "wallets" ? "Wallet." : "Cards."}</h1>
          <p className="mt-2 max-w-[38rem] text-[16px] text-ink/70">{tab === "wallets" ? "Your Lexari balance, and the wallets your agents hold." : "A card lets an agent pay for tools and compute inside a limit you set. Each agent gets its own."}</p>
        </div>
        <div className="inline-flex shrink-0 self-start rounded-full bg-tint p-1 sm:self-end" role="tablist" aria-label="Wallet or cards">
          {([["wallets", "wallet", "Wallet"], ["cards", "file", "Cards"]] as const).map(([id, ic, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => go(id)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-bold transition ${tab === id ? "bg-card text-ink shadow-[0_2px_0_var(--color-grape)]" : "text-ink/65 hover:text-ink"}`}><Icon name={ic} size={15} />{l}</button>
          ))}
        </div>
      </div>
      {tab === "wallets" ? (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6">
          <Balance d={d} />
          <AgentWallets s={s} d={d} />
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
