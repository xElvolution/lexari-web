"use client";

import { useEffect, useState } from "react";
import { LAMINA, modelById } from "@/content/models";
import { api, friendly } from "@/lib/api";
import { infoFor, type BillingState } from "@/lib/billing";
import { toast } from "@/lib/store";
import Icon from "../Icon";
import { ModelMark, Spinner, dateShort, money, pct } from "./parts";

type Report = {
  cycleStart: number; cycleEnd: number;
  total: { billed: number; cost: number; turns: number; tokens: number };
  agents: { slug: string; name: string; billed: number; cost: number; turns: number; tokens: number; cap: number | null }[];
  models: { model: string; billed: number; cost: number; turns: number; tokens: number }[];
  days: { day: string; billed: number; cost: number }[];
};

const box = "rounded-[22px] bg-card ring-1 ring-line";
const fmtN = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n.toLocaleString());

/** Every day of the cycle so far, with zero for quiet days, for the bar chart. */
function series(r: Report) {
  const by = new Map(r.days.map((d) => [d.day, d.billed]));
  const out: { day: string; billed: number }[] = [];
  const end = Math.min(Date.now(), r.cycleEnd);
  for (let t = Date.UTC(new Date(r.cycleStart).getUTCFullYear(), new Date(r.cycleStart).getUTCMonth(), new Date(r.cycleStart).getUTCDate()); t <= end && out.length < 62; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ day, billed: by.get(day) ?? 0 });
  }
  return out;
}

/** Settings > Billing > Costs: model spend this cycle by agent, model and day, and a cap per agent. */
export default function Costs({ s }: { s: BillingState }) {
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api<Report>("/api/billing/costs").then((x) => { setR(x); setErr(""); }, (e) => setErr(friendly(e, "Couldn't load costs.")));
  useEffect(() => { void load(); }, []);

  const save = async (agent: string, capUsd: number | null) => {
    if (capUsd !== null && !(capUsd >= 0 && capUsd <= 500)) { toast({ text: "A cap is between $0 and $500 a cycle." }); return; }
    setBusy(true);
    try { setR(await api<Report>("/api/billing/costs", { method: "PUT", body: { agent, capUsd } })); setEdit(null); toast({ text: capUsd === null ? "Cap removed" : `Capped at ${money(capUsd * 1e6, { cents: capUsd % 1 !== 0 })} a cycle` }); }
    catch (e) { toast({ text: friendly(e, "Couldn't save the cap.") }); }
    finally { setBusy(false); }
  };

  if (!r) return <div data-costs className={`${box} grid h-32 place-items-center p-5 text-[14px] text-ink/60`}>{err ? <span>{err} <button onClick={() => void load()} className="font-bold text-brand-ink">Try again</button></span> : <Spinner className="text-brand-ink" />}</div>;
  const days = series(r);
  const top = Math.max(1, ...days.map((d) => d.billed));
  return (
    <div data-costs>
      <div className={`${box} p-5`}>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div><div data-costs-total className="display text-[34px] leading-none text-ink">{money(r.total.billed, { cents: true })}</div><div className="mt-1 text-[13px] text-ink/60">Billed for models since {dateShort(r.cycleStart)}</div></div>
          <div className="text-right text-[12.5px] leading-snug text-ink/55">{fmtN(r.total.turns)} {r.total.turns === 1 ? "reply" : "replies"} · {fmtN(r.total.tokens)} tokens<br />Engine cost {money(r.total.cost, { cents: true })}</div>
        </div>
        <div data-costs-days aria-label="Billed per day" className="mt-4 flex h-20 items-end gap-[3px]">
          {days.map((d) => <span key={d.day} title={`${dateShort(Date.parse(d.day))}: ${money(d.billed, { cents: true })}`} className={`min-w-[3px] flex-1 rounded-t-[3px] ${d.billed ? "bg-grape" : "bg-tint"}`} style={{ height: `${d.billed ? Math.max(6, pct(d.billed, top)) : 4}%` }} />)}
        </div>
      </div>

      <ul data-costs-agents className={`${box} mt-3 divide-y divide-[var(--line)] px-5`}>
        {r.agents.map((a) => {
          const capped = a.cap !== null;
          const used = capped ? pct(a.billed, a.cap!) : 0;
          return (
            <li key={a.slug || "gone"} data-cost-agent={a.slug} className="py-3.5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-[14px] font-bold text-brand-ink">{a.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-[14.5px] font-semibold text-ink">{a.name}</div><div className="text-[12.5px] text-ink/55">{a.turns ? `${fmtN(a.turns)} ${a.turns === 1 ? "reply" : "replies"} · ${fmtN(a.tokens)} tokens` : "No model use this cycle"}</div></div>
                <div className="shrink-0 text-right"><div className="text-[14px] font-bold tabular-nums text-ink">{money(a.billed, { cents: true })}</div>{capped && <div className="text-[11.5px] text-ink/50">of {money(a.cap!, { cents: a.cap! % 1e6 !== 0 })} cap</div>}</div>
                {a.slug && <button data-cap-edit={a.slug} onClick={() => { setEdit(edit === a.slug ? null : a.slug); setVal(capped ? String(a.cap! / 1e6) : ""); }} aria-label={`Model cap for ${a.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-tint hover:text-ink"><Icon name="settings" size={16} /></button>}
              </div>
              {capped && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint"><div className={`h-full rounded-full ${used >= 100 ? "bg-[#e5484d]" : used >= 80 ? "bg-[#f5a524]" : "bg-grape"}`} style={{ width: `${used}%` }} /></div>}
              {edit === a.slug && (
                <form data-cap-form onSubmit={(e) => { e.preventDefault(); void save(a.slug, val.trim() === "" ? null : Number(val)); }} className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-full bg-tint px-4 text-[14px] text-ink"><span className="text-ink/50">$</span><input data-cap-input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, ""))} placeholder="No cap" aria-label="Cap in dollars per cycle" className="min-w-0 flex-1 bg-transparent outline-none" /><span className="whitespace-nowrap text-[12px] text-ink/50">a cycle</span></label>
                  <button type="submit" disabled={busy} className="btn btn-brand btn-sm !h-10 disabled:opacity-60">Save</button>
                  {capped && <button type="button" disabled={busy} onClick={() => void save(a.slug, null)} className="h-10 rounded-full px-3 text-[13px] font-bold text-ink/60 hover:text-ink disabled:opacity-60">Remove</button>}
                  <p className="w-full text-[12px] leading-snug text-ink/50">When {a.name} reaches its cap, its chats pause until the next cycle or until you raise it. Your own API keys never count.</p>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {r.models.length > 0 && (
        <ul data-costs-models className={`${box} mt-3 divide-y divide-[var(--line)] px-5`}>
          {r.models.map((m) => {
            const info = infoFor(s, m.model) ?? modelById(m.model) ?? LAMINA;
            return (
              <li key={m.model} className="flex items-center gap-3 py-3">
                <ModelMark m={info} size={30} />
                <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold text-ink">{info.label}</div><div className="text-[12px] text-ink/50">{fmtN(m.turns)} {m.turns === 1 ? "reply" : "replies"} · {fmtN(m.tokens)} tokens</div></div>
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-ink">{money(m.billed, { cents: true })}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
