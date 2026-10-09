"use client";

import { useCallback, useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import { toast } from "@/lib/store";
import Icon from "../Icon";
import { Sheet, Spinner } from "../billing/parts";

type Budget = { perTaskUsd: number; dailyUsd: number; spentTodayUsd: number; limits: { perTaskMaxUsd: number; dailyMaxUsd: number }; recent: { id: string; title: string; usd: number; status: string; explorer?: string; at: number }[] };
const usd = (n: number) => `$${n.toFixed(n > 0 && n < 1 ? 2 : n % 1 ? 2 : 0)}`;
const TASK = [0.1, 0.5, 1, 5];
const DAY = [1, 2, 5, 20];

/** In the agent panel: what this agent may spend on its own. Opens the budget sheet. */
export default function BudgetRow({ agent, name }: { agent: string; name: string }) {
  const [b, setB] = useState<Budget | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => api<Budget>(`/api/agents/budget?agent=${encodeURIComponent(agent)}`).then(setB).catch(() => setB(null)), [agent]);
  useEffect(() => { void load(); }, [load]);
  if (!b) return null;
  return (
    <>
      <button type="button" data-agent-budget={agent} onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-3.5 text-left ring-1 ring-line transition hover:ring-grape/60">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#0f9f6e] text-white"><Icon name="gauge" size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">Budget<span className="font-semibold text-ink/55">· {usd(b.perTaskUsd)}/task · {usd(b.dailyUsd)}/day</span></span>
          <span className="block text-[12.5px] leading-snug text-ink/60">{usd(b.spentTodayUsd)} spent today on services and other agents.</span>
        </span>
        <Icon name="right" size={16} className="shrink-0 text-ink/35" />
      </button>
      {open && <BudgetSheet agent={agent} name={name} b={b} onSaved={setB} onClose={() => setOpen(false)} />}
    </>
  );
}

function BudgetSheet({ agent, name, b, onSaved, onClose }: { agent: string; name: string; b: Budget; onSaved: (b: Budget) => void; onClose: () => void }) {
  const [task, setTask] = useState(b.perTaskUsd);
  const [day, setDay] = useState(b.dailyUsd);
  const [busy, setBusy] = useState(false);
  const pct = Math.min(100, b.dailyUsd ? (b.spentTodayUsd / b.dailyUsd) * 100 : 0);
  const dirty = task !== b.perTaskUsd || day !== b.dailyUsd;
  const save = async () => {
    setBusy(true);
    try { const r = await api<Budget>("/api/agents/budget", { body: { agent, perTaskUsd: task, dailyUsd: Math.max(day, task) } }); onSaved(r); toast({ text: `${name}'s budget saved` }); onClose(); }
    catch (e) { toast({ text: friendly(e, "Couldn't save the budget.") }); }
    finally { setBusy(false); }
  };
  return (
    <Sheet label="budget" title="Budget" sub={`${name} pays x402 services and other agents from its own wallet. Inside this budget it pays on its own; over it, you confirm.`} icon={<Icon name="gauge" size={20} />} onClose={onClose}
      footer={<button disabled={!dirty || busy} onClick={save} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-grape text-[15px] font-bold text-white disabled:opacity-40">{busy ? <Spinner /> : null}Save</button>}>
      <div className="rounded-2xl bg-tint/60 p-3">
        <div className="flex items-baseline justify-between text-[13px] font-bold text-ink"><span>Today</span><span>{usd(b.spentTodayUsd)} <span className="font-semibold text-ink/50">of {usd(b.dailyUsd)}</span></span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><i className="block h-full rounded-full bg-[#0f9f6e]" style={{ width: `${pct}%` }} /></div>
      </div>
      <Picker label="Per task" value={task} opts={TASK} max={b.limits.perTaskMaxUsd} onChange={(v) => { setTask(v); if (day < v) setDay(v); }} />
      <Picker label="Per day" value={day} opts={DAY} max={b.limits.dailyMaxUsd} min={task} onChange={setDay} />
      {b.recent.length > 0 && (
        <div className="mt-4">
          <div className="label mb-1.5 text-[10px] text-ink/50">Recent payments</div>
          <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
            {b.recent.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2.5 text-[13px]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.status === "confirmed" ? "bg-[#22c55e]" : r.status === "prepared" ? "bg-[#e0a100]" : r.status === "failed" || r.status === "rejected" ? "bg-[#e5484d]" : "bg-ink/30"}`} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.title}</span>
                <span className="shrink-0 font-bold text-ink">{usd(r.usd)}</span>
                {r.explorer && <a href={r.explorer} target="_blank" rel="noreferrer" aria-label="View transaction" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/50 hover:bg-tint"><Icon name="link" size={14} /></a>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

function Picker({ label, value, opts, onChange, max, min = 0 }: { label: string; value: number; opts: number[]; onChange: (v: number) => void; max: number; min?: number }) {
  const step = (d: number) => onChange(Math.max(min, Math.min(max, Math.round((value + d) * 100) / 100)));
  const inc = value < 1 ? 0.1 : 1;
  return (
    <div className="mt-3 rounded-2xl p-3 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[14px] font-bold text-ink">{label}</span>
        <button type="button" aria-label={`Less ${label}`} onClick={() => step(-inc)} className="grid h-8 w-8 place-items-center rounded-full bg-tint text-[18px] font-bold text-ink">−</button>
        <span className="w-16 text-center text-[17px] font-bold tabular-nums text-ink">{usd(value)}</span>
        <button type="button" aria-label={`More ${label}`} onClick={() => step(inc)} className="grid h-8 w-8 place-items-center rounded-full bg-tint text-ink"><Icon name="plus" size={15} /></button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {opts.filter((o) => o >= min && o <= max).map((o) => <button key={o} type="button" onClick={() => onChange(o)} className={`h-7 flex-1 rounded-full text-[12px] font-bold ${o === value ? "bg-grape text-white" : "bg-tint text-ink/70"}`}>{usd(o)}</button>)}
      </div>
    </div>
  );
}
