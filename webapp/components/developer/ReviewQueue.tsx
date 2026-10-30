"use client";

import { useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import Icon from "@/components/Icon";
import { Section, input, primary, secondary, when } from "@/components/developer/parts";

type Check = { name: string; ok: boolean; detail?: string };
type Tool = { name: string; description: string; url: string; intents?: string[] };
type Pending = {
  id: string; version: string; slug: string; listingStatus: string; createdAt: number; checks: Check[];
  developer: { handle: string; name: string; verified: boolean };
  manifest: { name: string; category: string; model: string; persona: { job: string; quip: string; description: string; system?: string }; tools: Tool[]; pricing: { type: string; usd?: number } };
};
type Recent = { id: string; version: string; slug: string; status: string; notes: string | null; reviewedAt: number };

function Item({ p, done }: { p: Pending; done: () => void }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const failed = p.checks.filter((c) => !c.ok);
  const decide = async (approve: boolean) => {
    setBusy(true); setErr("");
    try { await api("/api/admin/review", { body: { versionId: p.id, approve, notes } }); done(); }
    catch (e) { setErr(friendly(e, "Couldn't save that decision.")); }
    finally { setBusy(false); }
  };
  const m = p.manifest;
  return (
    <li className="rounded-2xl bg-tint/40 p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-ink">{m.name} <span className="font-medium text-ink/60">v{p.version}</span></p>
          <p className="text-[13px] text-ink/60">by {p.developer.name} (@{p.developer.handle}) · {m.category} · {m.pricing.type === "hire" ? `$${m.pricing.usd} hire` : "Free"} · sent {when(p.createdAt)}</p>
        </div>
        <span className={`label inline-flex rounded-full px-2 py-0.5 text-[9px] ${failed.length ? "bg-[#fde8e8] text-[#c4262e]" : "bg-[#e6f6ec] text-[#18794e]"}`}>{failed.length ? `${failed.length} check${failed.length > 1 ? "s" : ""} failed` : "Checks passed"}</span>
      </div>
      <p className="mt-2 text-[13.5px] text-ink/80">{m.persona.job}. {m.persona.description}</p>
      <button onClick={() => setOpen(!open)} className="mt-2 text-[13px] font-semibold text-grape">{open ? "Hide details" : "Show prompt, tools and checks"}</button>
      {open && (
        <div className="mt-2 space-y-3 text-[13px]">
          {m.persona.system && <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-tint p-3 text-ink/80">{m.persona.system}</pre>}
          {!!m.tools.length && <ul className="space-y-1">{m.tools.map((t) => <li key={t.name}><span className="font-semibold text-ink">{t.name}</span>: {t.description} <span className="break-all text-ink/50">{t.url}</span>{t.intents?.length ? <span className="ml-1 font-semibold text-[#b54708]">may propose {t.intents.join(" and ")}</span> : null}</li>)}</ul>}
          <ul className="space-y-1">{p.checks.map((c) => <li key={c.name} className={c.ok ? "text-ink/70" : "text-[#e5484d]"}>{c.ok ? "Pass" : "Fail"}: {c.name}{c.detail ? `, ${c.detail}` : ""}</li>)}</ul>
        </div>
      )}
      <textarea className={`${input} mt-3 h-auto min-h-[64px] py-3`} placeholder="Notes for the developer (needed to send back)" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {err && <p className="mt-2 text-[13px] text-[#e5484d]">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || failed.length > 0} onClick={() => void decide(true)} className={`${primary} disabled:opacity-40`}><Icon name="check" size={16} />Approve and list</button>
        <button disabled={busy} onClick={() => void decide(false)} className={secondary}>Send back</button>
      </div>
    </li>
  );
}

export default function ReviewQueue() {
  const [q, setQ] = useState<{ pending: Pending[]; recent: Recent[] } | null>(null);
  const [err, setErr] = useState("");
  const load = () => api<{ pending: Pending[]; recent: Recent[] }>("/api/admin/review").then(setQ, (e) => setErr(friendly(e, "Couldn't load the queue.")));
  useEffect(() => { void load(); }, []);
  return (
    <Section title={`Waiting for review${q ? ` (${q.pending.length})` : ""}`}>
      {err && <p className="text-[13px] text-[#e5484d]">{err}</p>}
      {q && !q.pending.length && <p className="text-[13.5px] text-ink/60">Nothing waiting. New versions show up here after automated checks.</p>}
      {!!q?.pending.length && <ul className="space-y-3">{q.pending.map((p) => <Item key={p.id} p={p} done={() => void load()} />)}</ul>}
      {!!q?.recent.length && (
        <>
          <p className="mt-5 text-[13px] font-semibold text-ink/70">Recent decisions</p>
          <ul className="mt-1 divide-y divide-line">{q.recent.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2 text-[13.5px]"><span className="font-semibold text-ink">{r.slug} v{r.version}</span><span className="text-ink/60">{r.status} {when(r.reviewedAt)}</span></li>)}</ul>
        </>
      )}
    </Section>
  );
}
