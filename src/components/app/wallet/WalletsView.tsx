"use client";

import { useSearchParams } from "next/navigation";
import { openAdd } from "../overlays";
import { useState } from "react";
import { cardTxns, shortAddr, walletFor } from "@/content/appData";
import { cancelCard, createWallet, toast, updateCard, useApp, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { DemoTag } from "../ui";
import { myAgents, type MyAgent } from "../agents";
import CardVisual from "./CardVisual";
import GetCardDialog from "./GetCardDialog";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const copy = (addr: string, what: string) => { navigator.clipboard?.writeText(addr).catch(() => {}); toast({ text: `Copied ${what}` }); };

function Spark({ pts, light = false }: { pts: number[]; light?: boolean }) {
  const max = Math.max(...pts), min = Math.min(...pts);
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${28 - ((p - min) / (max - min || 1)) * 24}`).join(" ");
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`h-12 w-full ${light ? "text-white" : "text-brand-ink"}`} aria-hidden><polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-grape" : "bg-ink/20"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} /></button>;
}

/* ---------- wallets ---------- */
function PersonalWallet({ s, a }: { s: State; a: MyAgent }) {
  const w = walletFor("home"); const addr = s.wallets.home;
  if (!addr) return <OtherWallet s={s} a={a} />;
  return (
    <section data-rise className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="grain relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#6a3dff,#5b2bff_45%,#2a0f9a)] p-6 text-white shadow-[0_24px_50px_-28px_rgba(91,43,255,.9)] sm:p-7">
        <div className="flex items-center gap-3">
          <AgentTile id="home" look={s.agent?.look} size={48} className="!bg-white/15" />
          <div className="min-w-0 flex-1"><div className="text-[17px] font-bold">{a.name}</div><div className="text-[13px] text-white/75">Personal agent · main wallet</div></div>
          <span className="label rounded-full bg-white/15 px-2.5 py-1 text-[8.5px]">Demo</span>
        </div>
        <div className="mt-7 flex items-end justify-between gap-4">
          <div><div className="label text-[9px] text-white/70">Balance · demo</div><div className="display tab-num mt-2 text-[56px] leading-none">{fmt(w.balance)}</div></div>
          <div className="w-32 opacity-90"><Spark pts={w.spark} light /></div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button onClick={() => copy(addr, `${a.name}'s address`)} title={addr} className="flex min-w-0 items-center gap-2 rounded-full bg-white/15 py-2 pl-3.5 pr-4 font-mono text-[12.5px] transition hover:bg-white/25"><Icon name="wallet" size={15} /><span className="truncate">{shortAddr(addr)}</span><Icon name="copy" size={14} /></button>
          <span className="text-[12.5px] text-white/70">Placeholder address. Not on a real chain.</span>
        </div>
      </div>
      <div className="rounded-[28px] bg-card p-5 ring-1 ring-line sm:p-6">
        <div className="flex items-center justify-between"><h3 className="text-[16px] font-bold text-ink">Recent activity</h3><span className="label text-[8.5px] text-ink/45">demo</span></div>
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {w.lines.map((l) => (
            <li key={l.label} className="flex items-center gap-3 py-3">
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${l.amount > 0 ? "bg-grape text-white" : "bg-tint text-ink/70"}`}><Icon name={l.amount > 0 ? "download" : "arrow"} size={15} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-semibold text-ink">{l.label}</span><span className="block text-[12px] text-ink/50">{l.ago}</span></span>
              <span className={`tab-num font-mono text-[13px] ${l.amount > 0 ? "text-brand-ink" : "text-ink/65"}`}>{l.amount > 0 ? "+" : "−"}{fmt(Math.abs(l.amount))}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function OtherWallet({ s, a }: { s: State; a: MyAgent }) {
  const [busy, setBusy] = useState(false);
  const addr = s.wallets[a.id];
  const make = () => { setBusy(true); setTimeout(() => { createWallet(a.id); setBusy(false); toast({ text: `${a.name} has a wallet address now (demo)` }); }, 1300); };
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[22px] bg-card p-3.5 ring-1 ring-line sm:flex-nowrap sm:p-4">
      <AgentTile id={a.id} look={s.agent?.look} size={46} />
      <div className="min-w-0 flex-1"><div className="truncate text-[15.5px] font-bold text-ink">{a.name}</div><div className="truncate text-[13px] text-ink/60">{a.role}</div></div>
      {addr ? (
        <div className="pop flex w-full items-center gap-2 sm:w-auto">
          <button onClick={() => copy(addr, `${a.name}'s address`)} title={addr} className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-tint py-2 pl-3 pr-3.5 font-mono text-[12.5px] text-ink transition hover:bg-grape hover:text-white sm:flex-none"><Icon name="wallet" size={14} /><span className="truncate">{shortAddr(addr)}</span><Icon name="copy" size={13} /></button>
          <span className="shrink-0 text-right"><span className="label block text-[8px] text-ink/50">Balance · demo</span><span className="tab-num font-mono text-[13.5px] font-semibold text-ink">0.00</span></span>
        </div>
      ) : (
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="label rounded-full border border-dashed border-ink/30 px-2.5 py-1.5 text-[8.5px] text-ink/60">No wallet</span>
          <button onClick={make} disabled={busy} className="btn btn-ghost btn-sm ml-auto !h-10 disabled:opacity-70">{busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-grape" />Generating…</> : <><Icon name="plus" size={15} />Create wallet address</>}</button>
        </div>
      )}
    </li>
  );
}

/* ---------- cards ---------- */
function CardRow({ s, a, onGet }: { s: State; a: MyAgent; onGet: () => void }) {
  const c = s.cards[a.id];
  const [reveal, setReveal] = useState(false);
  if (!c) return (
    <article data-rise className="grid items-center gap-5 rounded-[26px] bg-card p-4 ring-1 ring-line sm:p-5 md:grid-cols-[minmax(0,340px)_1fr]">
      <div className="grid aspect-[1.586] w-full max-w-[380px] place-items-center rounded-[22px] border-2 border-dashed border-ink/20 text-center">
        <div><AgentTile id={a.id} look={s.agent?.look} size={52} className="mx-auto" /><div className="mt-3 text-[14px] font-semibold text-ink/60">No card yet</div></div>
      </div>
      <div>
        <h3 className="text-[18px] font-bold text-ink">{a.name}</h3>
        <p className="mt-1 text-[14.5px] text-ink/65">{a.id === "home" ? "Let your personal agent pay for the things it needs, inside a limit you set." : `${a.name} needs its own card to buy tools or compute for you.`} Cards are not free: each one has a one-time fee.</p>
        <button onClick={onGet} className="btn btn-brand btn-sm mt-4"><Icon name="plus" size={16} />Get a card</button>
      </div>
    </article>
  );
  const tx = cardTxns(a.id); const spent = tx.reduce((t, x) => t + x.amount, 0);
  return (
    <article data-rise className="grid gap-5 rounded-[26px] bg-card p-4 ring-1 ring-line sm:p-5 md:grid-cols-[minmax(0,340px)_1fr]">
      <div>
        <CardVisual id={a.id} name={a.name} card={c} reveal={reveal} />
        <div className="mt-3 flex gap-2">
          <button onClick={() => setReveal((r) => !r)} aria-pressed={reveal} className="btn btn-ghost btn-sm !h-10 flex-1">{reveal ? "Hide details" : "Reveal details"}</button>
          <button onClick={() => copy(c.number, "card number (demo)")} className="btn btn-ghost btn-sm !h-10"><Icon name="copy" size={15} />Copy</button>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2"><h3 className="text-[18px] font-bold text-ink">{a.name}</h3><span className={`label rounded-full px-2 py-1 text-[8.5px] ${c.frozen ? "bg-ink text-[var(--bg)]" : "bg-tint text-brand-ink"}`}>{c.frozen ? "Frozen" : "Active"}</span><span className="label ml-auto text-[8.5px] text-ink/45">demo</span></div>
        <div className="mt-4 rounded-2xl bg-tint p-4">
          <div className="flex items-baseline justify-between text-[13.5px]"><span className="text-ink/65">Spent this month</span><span className="tab-num font-mono font-semibold text-ink">{fmt(spent)} / {fmt(c.limit)}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-grape" style={{ width: `${Math.min(100, (spent / c.limit) * 100)}%` }} /></div>
        </div>
        <div className="mt-3 divide-y divide-[var(--line)] rounded-2xl px-4 ring-1 ring-line">
          <div className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><div className="text-[14.5px] font-semibold text-ink">Freeze card</div><div className="text-[12.5px] text-ink/55">Stops new purchases until you unfreeze.</div></div><Toggle on={c.frozen} onChange={(v) => { updateCard(a.id, { frozen: v }); toast({ text: v ? `${a.name}'s card is frozen` : `${a.name}'s card is active` }); }} label="Freeze card" /></div>
          <div className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><div className="text-[14.5px] font-semibold text-ink">Monthly limit</div><div className="text-[12.5px] text-ink/55">The most this card can spend in a month.</div></div>
            <select value={c.limit} onChange={(e) => updateCard(a.id, { limit: +e.target.value })} aria-label="Monthly limit" className="h-10 rounded-full bg-tint px-3 text-[14px] font-semibold text-ink outline-none ring-grape focus:ring-2">{[100, 250, 500, 1000, 2500].map((l) => <option key={l} value={l}>{fmt(l)}</option>)}</select></div>
        </div>
        <div className="mt-4 flex items-center justify-between"><span className="label text-[9px] text-ink/55">Recent purchases</span><span className="label text-[8.5px] text-ink/40">demo</span></div>
        <ul className="mt-1.5">
          {tx.map((t) => <li key={t.label} className="flex items-center justify-between gap-3 py-2 text-[14px]"><span className="min-w-0 truncate text-ink/80">{t.label}<span className="ml-2 text-[12px] text-ink/45">{t.ago}</span></span><span className="tab-num font-mono text-[13px] text-ink/70">−{fmt(t.amount)}</span></li>)}
        </ul>
        <button onClick={() => { if (confirm(`Cancel ${a.name}'s demo card?`)) { cancelCard(a.id); toast({ text: `${a.name}'s card was cancelled` }); } }} className="mt-2 text-[13px] font-semibold text-ink/55 hover:text-ink hover:underline">Cancel card</button>
      </div>
    </article>
  );
}

export default function WalletsView() {
  const s = useApp()!;
  const params = useSearchParams();
  const [tab, setTab] = useState<"wallets" | "cards">(params.get("tab") === "cards" ? "cards" : "wallets");
  const [getFor, setGetFor] = useState<string | null>(null);
  const agents = myAgents(s);
  const go = (t: "wallets" | "cards") => { setTab(t); window.history.replaceState(null, "", t === "cards" ? "/app/wallets?tab=cards" : "/app/wallets"); };
  const withWallet = agents.filter((a) => s.wallets[a.id]).length, withCard = agents.filter((a) => s.cards[a.id]).length;

  return (
    <>
      <div data-rise className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5"><span className="label text-brand-ink">Money</span><DemoTag /></div>
          <h1 className="display mt-3 text-[44px] text-ink sm:text-[60px]">{tab === "wallets" ? "Wallets." : "Cards."}</h1>
          <p className="mt-2 max-w-[38rem] text-[16px] text-ink/70">{tab === "wallets" ? "Your personal agent comes with a wallet. Give other agents an address when they need one." : "Virtual cards let an agent pay for tools and compute inside a limit you set."} Everything here is demo data.</p>
        </div>
        <div className="inline-flex shrink-0 self-start rounded-full bg-tint p-1 sm:self-end" role="tablist" aria-label="Wallets or cards">
          {([["wallets", "wallet", "Wallets", withWallet], ["cards", "file", "Cards", withCard]] as const).map(([id, ic, l, n]) => (
            <button key={id} role="tab" data-tour={`${id}-tab`} aria-selected={tab === id} onClick={() => go(id)} className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-bold transition ${tab === id ? "bg-card text-ink shadow-[0_2px_0_var(--color-grape)]" : "text-ink/65 hover:text-ink"}`}><Icon name={ic} size={16} />{l}<span className="tab-num rounded-full bg-ink/10 px-1.5 text-[11px]">{n}</span></button>
          ))}
        </div>
      </div>

      {tab === "wallets" ? (
        <div className="mt-8 grid gap-8">
          <PersonalWallet s={s} a={agents[0]} />
          <section data-rise>
            <div className="flex items-baseline justify-between"><h2 className="text-[18px] font-bold text-ink">Other agents</h2><span className="text-[13px] text-ink/55">Hired agents start without a wallet</span></div>
            <ul className="mt-3 grid gap-2.5">{agents.slice(1).map((a) => <OtherWallet key={a.id} s={s} a={a} />)}</ul>
            {agents.length === 1 && <p className="mt-3 text-[14px] text-ink/60">Add an agent to give it a wallet. <button onClick={() => openAdd()} className="font-bold text-brand-ink">Add an agent</button></p>}
          </section>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">{agents.map((a) => <CardRow key={a.id} s={s} a={a} onGet={() => setGetFor(a.id)} />)}</div>
      )}
      {getFor && <GetCardDialog s={s} id={getFor} onClose={() => setGetFor(null)} />}
    </>
  );
}
