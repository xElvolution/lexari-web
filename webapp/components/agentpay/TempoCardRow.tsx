"use client";

import Capped from "../Capped";
import { useCallback, useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import { toast } from "@/lib/store";
import Icon from "../Icon";
import { Sheet, Spinner } from "../billing/parts";
import { useMask } from "@/lib/privacy";

type Card = {
  address: string; network: string; explorer: string; frozen: boolean; perTxUsd: number; dailyUsd: number; spentTodayUsd: number;
  limits: { perTxMaxUsd: number; dailyMaxUsd: number }; balances: { symbol: string; amount: number }[] | null;
  history: { id: string; title: string; usd: number; status: string; explorer?: string; at: number }[];
};
const usd = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;
const PER = [1, 5, 10, 25];
const DAY = [10, 20, 50, 100];
const total = (c: Card) => (c.balances || []).reduce((s, b) => s + b.amount, 0);

/** The agent's Tempo card face: balance, limits, frozen state. Opens the card sheet. */
export default function TempoCardRow({ agent, name, summary }: { agent: string; name: string; /** Wallets > Cards: balance and limits as a tidy strip under the card face, not a second card */ summary?: boolean }) {
  const mask = useMask();
  const [c, setC] = useState<Card | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => api<Card>(`/api/agents/card?agent=${encodeURIComponent(agent)}`).then(setC).catch(() => setC(null)), [agent]);
  useEffect(() => { void load(); }, [load]);
  if (!c) return null;
  if (summary) {
    const stats: [string, string][] = [["Balance", c.balances ? mask(`$${total(c).toFixed(2)}`) : "Unavailable"], ["Per payment", usd(c.perTxUsd)], ["Per day", usd(c.dailyUsd)], ["Spent today", mask(usd(c.spentTodayUsd))]];
    return (
      <>
        <div data-tempo-summary={agent} className="w-full rounded-2xl bg-tint/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="label text-[10px] text-ink/55">Tempo card</span>
            <span className={`label rounded-full px-2 py-0.5 text-[9.5px] ${c.frozen ? "bg-ink/10 text-ink/70" : "bg-[#22c55e]/15 text-[#15803d] dark:text-[#4ade80]"}`}>{c.frozen ? "Frozen" : "Active"}</span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
            {stats.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[11.5px] text-ink/55">{k}</dt><dd className="truncate text-[15px] font-bold tabular-nums text-ink">{v}</dd></div>)}
          </dl>
          <button type="button" data-tempo-card={agent} onClick={() => setOpen(true)} className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl px-1 py-1 text-left text-[12.5px] font-semibold text-ink/70 transition hover:text-ink">
            <span className="truncate font-mono text-[11.5px]">{c.address.slice(0, 6)}…{c.address.slice(-4)}</span>
            <span className="flex shrink-0 items-center gap-1 text-grape">Limits and history<Icon name="right" size={14} /></span>
          </button>
        </div>
        {open && <CardSheet agent={agent} name={name} c={c} onSaved={setC} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return (
    <>
      <button type="button" data-tempo-card={agent} onClick={() => setOpen(true)} className={`relative w-full overflow-hidden rounded-2xl p-4 text-left text-white ring-1 ring-black/10 transition hover:opacity-95 ${c.frozen ? "bg-[#5b5b66]" : "bg-gradient-to-br from-[#1b1b2f] via-[#3b2a8f] to-[#6d4aff]"}`}>
        <span className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wider text-white/70"><span>Tempo card</span><span>{c.frozen ? "Frozen" : "Active"}</span></span>
        <span className="mt-3 block text-[24px] font-extrabold tabular-nums">{c.balances ? mask(`$${total(c).toFixed(2)}`) : "Balance unavailable"}</span>
        <span className="mt-1 block text-[12.5px] text-white/75">{name} · {usd(c.perTxUsd)} a payment · {usd(c.dailyUsd)} a day · {mask(usd(c.spentTodayUsd))} spent today</span>
        <span className="mt-2 block font-mono text-[11.5px] text-white/60">{c.address.slice(0, 6)}…{c.address.slice(-4)}</span>
      </button>
      {open && <CardSheet agent={agent} name={name} c={c} onSaved={setC} onClose={() => setOpen(false)} />}
    </>
  );
}

function CardSheet({ agent, name, c, onSaved, onClose }: { agent: string; name: string; c: Card; onSaved: (c: Card) => void; onClose: () => void }) {
  const mask = useMask();
  const [per, setPer] = useState(c.perTxUsd);
  const [day, setDay] = useState(c.dailyUsd);
  const [busy, setBusy] = useState(false);
  const save = async (frozen: boolean, msg: string) => {
    setBusy(true);
    try { const r = await api<Card>("/api/agents/card", { body: { agent, perTxUsd: per, dailyUsd: Math.max(day, per), frozen } }); onSaved(r); toast({ text: msg }); }
    catch (e) { toast({ text: friendly(e, "Couldn't save the card.") }); }
    finally { setBusy(false); }
  };
  const dirty = per !== c.perTxUsd || day !== c.dailyUsd;
  return (
    <Sheet label="tempo-card" title="Tempo card" sub={`${name} pays merchants in stablecoins on Tempo. Every payment waits for your Confirm, inside these limits.`} icon={<Icon name="wallet" size={20} />} onClose={onClose}
      footer={<div className="flex gap-2">
        <button disabled={busy} onClick={() => save(!c.frozen, c.frozen ? "Card unfrozen" : "Card frozen")} className="h-11 flex-1 rounded-full bg-tint text-[15px] font-bold text-ink disabled:opacity-40">{c.frozen ? "Unfreeze" : "Freeze"}</button>
        <button disabled={!dirty || busy} onClick={() => save(c.frozen, "Card limits saved")} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-grape text-[15px] font-bold text-white disabled:opacity-40">{busy ? <Spinner /> : null}Save limits</button>
      </div>}>
      <div className="rounded-2xl bg-tint/60 p-3 text-[13px]">
        <div className="font-bold text-ink">Balance</div>
        {c.balances ? c.balances.map((b) => <div key={b.symbol} className="mt-1 flex justify-between text-ink/80"><span>{b.symbol}</span><span className="font-bold tabular-nums">{mask(b.amount.toFixed(2))}</span></div>) : <div className="mt-1 text-ink/60">Tempo didn&apos;t answer. Try again in a moment.</div>}
        <a href={c.explorer} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-[11.5px] text-grape">{c.address}</a>
      </div>
      <Pick label="Per payment" value={per} opts={PER} max={c.limits.perTxMaxUsd} onChange={(v) => { setPer(v); if (day < v) setDay(v); }} />
      <Pick label="Per day" value={day} opts={DAY.filter((d) => d >= per)} max={c.limits.dailyMaxUsd} onChange={setDay} />
      <div className="mt-4">
        <div className="label mb-1.5 text-[10px] text-ink/50">History</div>
        {c.history.length ? (
          <Capped className="rounded-2xl ring-1 ring-line"><ul className="divide-y divide-line">
            {c.history.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2.5 text-[13px]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.status === "confirmed" ? "bg-[#22c55e]" : r.status === "prepared" ? "bg-[#e0a100]" : r.status === "failed" || r.status === "rejected" ? "bg-[#e5484d]" : "bg-ink/30"}`} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.title}</span>
                <span className="shrink-0 font-bold text-ink">{mask(usd(r.usd))}</span>
                {r.explorer && <a href={r.explorer} target="_blank" rel="noreferrer" aria-label="View transaction" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/50 hover:bg-tint"><Icon name="link" size={14} /></a>}
              </li>
            ))}
          </ul></Capped>
        ) : <p className="text-[13px] text-ink/60">No card payments yet. Ask {name} to pay with its Tempo card in chat.</p>}
      </div>
    </Sheet>
  );
}

function Pick({ label, value, opts, onChange, max }: { label: string; value: number; opts: number[]; onChange: (v: number) => void; max: number }) {
  return (
    <div className="mt-3 rounded-2xl p-3 ring-1 ring-line">
      <div className="flex items-center justify-between text-[14px] font-bold text-ink"><span>{label}</span><span className="tabular-nums">{usd(value)}</span></div>
      <div className="mt-2 flex gap-1.5">
        {opts.filter((o) => o <= max).map((o) => <button key={o} type="button" onClick={() => onChange(o)} className={`h-7 flex-1 rounded-full text-[12px] font-bold ${o === value ? "bg-grape text-white" : "bg-tint text-ink/70"}`}>{usd(o)}</button>)}
      </div>
    </div>
  );
}
