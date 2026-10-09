"use client";

import { useEffect, useMemo, useState } from "react";
import { KEY_PROVIDERS, LAMINA, MODEL_NAME_RE, type CatalogRow, type KeyInfo, type KeyProvider, type ModelInfo } from "@/content/models";
import { catalogOf, enabledModels, infoFor, refreshBilling, setModel, useBilling, type BillingState } from "@/lib/billing";
import { api, friendly } from "@/lib/api";
import { toast, type State } from "@/lib/store";
import { myAgents } from "../agents";
import { AgentTile } from "../faces";
import Icon from "../Icon";
import { ModelMark, Sheet, Spinner } from "../billing/parts";

type Pick = null | { kind: "default" } | { kind: "agent"; id: string; name: string };
const card = "rounded-[20px] bg-card ring-1 ring-line";
const h3 = "label mb-1.5 px-1 text-[9.5px] text-ink/50";
const iconBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-40";
const makerMark = (p: KeyProvider) => ({ id: p, label: "", short: "", maker: KEY_PROVIDERS.find((x) => x.id === p)!.maker, blurb: "", pool: "byo", price: { in: 0, out: 0 } }) as ModelInfo;

/** Settings > Models: default and per-agent picks, every model with an on/off switch, and one API key per provider. */
export default function ModelsSection({ s }: { s: State }) {
  const { state: b, error } = useBilling();
  const [sheet, setSheet] = useState<Pick>(null);
  useEffect(() => { void refreshBilling(); }, []);
  if (!b) return error ? <p className="rounded-[22px] bg-card p-5 text-[14px] text-ink/70 ring-1 ring-line">{error} <button onClick={() => void refreshBilling()} className="font-bold text-brand-ink">Try again</button></p> : <div className="space-y-3"><div className="h-[110px] animate-pulse rounded-[22px] bg-tint" /><div className="h-[260px] animate-pulse rounded-[22px] bg-tint" /></div>;
  const def = infoFor(b, b.models.default) ?? LAMINA;
  const agents = myAgents(s);
  return (
    <div data-models-section className="grid gap-5 max-[430px]:gap-4">
      <section>
        <h3 className={h3}>Defaults</h3>
        <div className={`${card} divide-y divide-[var(--line)]`}>
          <PickRow data-account-default={def.id} onClick={() => setSheet({ kind: "default" })} lead={<span className="grid h-8 w-8 place-items-center rounded-[10px] bg-grape text-white"><Icon name="spark" size={15} /></span>} title="Account default" value={def} />
          {agents.map((a) => {
            const own = infoFor(b, b.models.agents[a.id]);
            return <PickRow key={a.id} data-agent-model-row={a.id} onClick={() => setSheet({ kind: "agent", id: a.id, name: a.name })} lead={<AgentTile id={a.id} look={s.agent?.look} size={32} status={false} />} title={a.name} value={own ?? def} follows={!own} />;
          })}
        </div>
      </section>
      <ModelList b={b} />
      <ApiKeys b={b} />
      {sheet?.kind === "default" && <PickSheet b={b} title="Account default" sub="Every agent without its own pick answers with this." current={b.models.default} onClose={() => setSheet(null)} onPick={async (id) => { await api("/api/models/default", { method: "PUT", body: { model: id } }); await refreshBilling(); }} />}
      {sheet?.kind === "agent" && <PickSheet b={b} title={sheet.name} sub={`What ${sheet.name} answers with in chats without their own pick.`} current={b.models.agents[sheet.id] ?? null} followDefault={def} onClose={() => setSheet(null)} onPick={async (id) => { await setModel({ scope: "agent", agent: sheet.id, model: id }); await refreshBilling(); }} />}
    </div>
  );
}

function PickRow({ onClick, lead, title, value, follows = false, ...rest }: { onClick: () => void; lead: React.ReactNode; title: string; value: ModelInfo; follows?: boolean; [k: `data-${string}`]: string }) {
  return (
    <button {...rest} onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-tint/50">
      {lead}
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{title}</span>
      <span className="flex min-w-0 max-w-[55%] items-center gap-1.5 text-[12.5px] font-semibold text-ink/60"><ModelMark m={value} size={18} /><span className="truncate">{follows ? `Default · ${value.short}` : value.label}</span></span>
      <Icon name="right" size={14} className="shrink-0 text-ink/35" />
    </button>
  );
}

function Switch({ on, onChange, label, disabled = false, busy = false }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; busy?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled || busy} onClick={() => onChange(!on)} className={`relative h-6 w-10 shrink-0 rounded-full transition disabled:cursor-not-allowed ${on ? "bg-grape" : "bg-ink/20"} ${disabled ? "opacity-60" : ""} ${busy ? "animate-pulse" : ""}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

/** The model list: search, a switch per model, and "Add" for a model id that isn't listed. */
function ModelList({ b }: { b: BillingState }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const rows = useMemo(() => catalogOf(b), [b]);
  const keyed = b.models.keys.map((k) => k.provider);
  const query = q.trim().toLowerCase();
  const shown = query ? rows.filter((r) => `${r.m.label} ${r.m.id} ${r.m.maker}`.toLowerCase().includes(query)) : rows;
  const addable = query && MODEL_NAME_RE.test(q.trim()) && !rows.some((r) => r.m.id.endsWith(`:${q.trim()}`)) ? keyed : [];
  const run = async (key: string, f: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await f(); await refreshBilling(); if (ok) toast({ text: ok }); }
    catch (e) { toast({ text: friendly(e, "Couldn't change that. Try again.") }); }
    finally { setBusy(null); }
  };
  const toggle = (r: CatalogRow, on: boolean) => run(r.m.id, () => api("/api/models", { method: "PATCH", body: { op: "toggle", id: r.m.id, on } }));
  const add = (p: KeyProvider) => run(`add:${p}`, () => api("/api/models", { method: "PATCH", body: { op: "add", provider: p, model: q.trim() } }), `${q.trim()} added`).then(() => setQ(""));
  const drop = (r: CatalogRow) => run(r.m.id, () => api("/api/models", { method: "PATCH", body: { op: "drop", id: r.m.id } }), `${r.m.label} removed`);
  return (
    <section data-model-list>
      <h3 className={h3}>Models</h3>
      <div className={card}>
        <label className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2">
          <Icon name="search" size={15} className="shrink-0 text-ink/45" />
          <input data-model-search value={q} onChange={(e) => setQ(e.target.value)} placeholder={keyed.length ? "Search or add a model id" : "Search models"} autoCapitalize="off" autoCorrect="off" spellCheck={false} className="h-8 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink/40" />
          {q && <button onClick={() => setQ("")} aria-label="Clear search" className="grid h-7 w-7 place-items-center rounded-full text-ink/50 hover:bg-tint"><Icon name="x" size={14} /></button>}
        </label>
        <ul className="divide-y divide-[var(--line)]">
          {shown.map((r) => (
            <li key={r.m.id} data-model-row={r.m.id} data-enabled={r.enabled ? "1" : "0"} className="flex items-center gap-2.5 px-3 py-2">
              <ModelMark m={r.m} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{r.m.label}</span>
                <span className="block truncate text-[11.5px] text-ink/50">{r.provider ? <>{KEY_PROVIDERS.find((p) => p.id === r.provider)!.name} key · <span className="font-mono">{r.m.id.split(":").slice(2).join(":")}</span></> : r.m.pool === "premium" ? "Premium usage" : "Included"}</span>
              </span>
              {r.added && <button onClick={() => void drop(r)} disabled={busy === r.m.id} aria-label={`Remove ${r.m.label}`} title="Remove" className={`${iconBtn} !h-7 !w-7 text-ink/45 hover:bg-[#e5484d]/12 hover:text-[#e5484d]`}><Icon name="trash" size={14} /></button>}
              <Switch on={r.enabled} disabled={r.locked} busy={busy === r.m.id} label={`${r.m.label} ${r.enabled ? "on" : "off"}`} onChange={(v) => void toggle(r, v)} />
            </li>
          ))}
          {addable.map((p) => (
            <li key={p}><button data-add-model={p} onClick={() => void add(p)} disabled={!!busy} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-tint/50">
              <span className="grid h-[26px] w-[26px] place-items-center rounded-[9px] bg-grape/15 text-brand-ink">{busy === `add:${p}` ? <Spinner /> : <Icon name="plus" size={14} stroke={2.6} />}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">Add <span className="font-mono font-semibold">{q.trim()}</span></span>
              <span className="shrink-0 text-[11.5px] font-semibold text-ink/50">{KEY_PROVIDERS.find((x) => x.id === p)!.name}</span>
            </button></li>
          ))}
          {query && !shown.length && !addable.length && <li className="px-3 py-3 text-[12.5px] text-ink/50">{keyed.length ? "No match. Model ids use letters, numbers and . : / @ + - _" : "No match. Add an API key below to use more models."}</li>}
        </ul>
        {!keyed.length && !query && <p className="border-t border-[var(--line)] px-3 py-2.5 text-[12px] leading-snug text-ink/55">Add an API key below and GPT, Claude, Gemini and Grok models show up here.</p>}
      </div>
    </section>
  );
}

/** API Keys: one row per provider. Verify checks the key with the provider and saves it encrypted. */
function ApiKeys({ b }: { b: BillingState }) {
  return (
    <section data-api-keys>
      <h3 className={h3}>API Keys</h3>
      <div className={`${card} divide-y divide-[var(--line)]`}>
        {KEY_PROVIDERS.map((p) => <KeyRow key={p.id} provider={p.id} saved={b.models.keys.find((k) => k.provider === p.id) ?? null} ready={b.models.byoReady !== false} />)}
      </div>
      <p className="mt-2 px-1 text-[11.5px] leading-snug text-ink/50">Keys are encrypted on Lexari&apos;s server and never shown again. Replies on your key are billed by your provider and never use your Lexari balance.</p>
    </section>
  );
}

function KeyRow({ provider, saved, ready }: { provider: KeyProvider; saved: KeyInfo | null; ready: boolean }) {
  const p = KEY_PROVIDERS.find((x) => x.id === provider)!;
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"verify" | "remove" | "base" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [baseOn, setBaseOn] = useState(!!saved?.baseUrl);
  const [base, setBase] = useState(saved?.baseUrl ?? "");
  useEffect(() => { setBaseOn(!!saved?.baseUrl); setBase(saved?.baseUrl ?? ""); }, [saved?.baseUrl]);
  const fresh = key.trim().length >= 8;
  const verify = async () => {
    setBusy("verify"); setErr("");
    try {
      if (fresh) { const r = await api<{ note: string }>(`/api/models/keys/${provider}`, { method: "PUT", body: { key: key.trim() } }); setKey(""); setShow(false); toast({ text: `${p.name} key verified. ${r.note.replace(/^Verified in/, "Took")}` }); }
      else { const r = await api<{ result: { ok: boolean; error?: string } }>(`/api/models/keys/${provider}`, { body: { op: "verify" } }); if (!r.result.ok) setErr(r.result.error || "The key didn't pass."); else toast({ text: `${p.name} key works` }); }
      await refreshBilling();
    } catch (e) { setErr(friendly(e, "Couldn't verify the key. Try again.")); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy("remove"); setErr("");
    try { await api(`/api/models/keys/${provider}`, { method: "DELETE" }); await refreshBilling(); toast({ text: `${p.name} key removed` }); setConfirm(false); }
    catch (e) { setErr(friendly(e, "Couldn't remove the key.")); }
    finally { setBusy(null); }
  };
  const saveBase = async (url: string | null) => {
    setBusy("base"); setErr("");
    try { await api(`/api/models/keys/openai`, { method: "PATCH", body: { baseUrl: url } }); await refreshBilling(); toast({ text: url ? "OpenAI models now use your base URL" : "Back to api.openai.com" }); }
    catch (e) { setErr(friendly(e, "Couldn't save the base URL.")); if (!url) setBaseOn(true); }
    finally { setBusy(null); }
  };
  const status = saved ? (saved.status === "ok" ? ["Verified", "text-[#2fbf71]"] : saved.status === "failed" ? ["Failed", "text-[#e5484d]"] : ["Not checked", "text-ink/50"]) : null;
  return (
    <div data-key-row={provider} data-key-status={saved?.status ?? "none"} className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <ModelMark m={makerMark(provider)} size={22} />
        <span className="text-[14px] font-bold text-ink">{p.name}</span>
        {status && <span className={`inline-flex items-center gap-1 text-[11.5px] font-semibold ${status[1]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status[0]}</span>}
        <a href={p.keyUrl} target="_blank" rel="noreferrer" className="ml-auto text-[11.5px] font-semibold text-ink/45 hover:text-brand-ink">Get a key</a>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="relative min-w-0 flex-1">
          <input data-key-input={provider} value={key} onChange={(e) => { setKey(e.target.value); setErr(""); setConfirm(false); }} type={show ? "text" : "password"} disabled={!ready} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            placeholder={saved ? `••••••••${saved.last4}` : "API key"} aria-label={`${p.name} API key`} className="field h-9 !rounded-full !py-0 !pl-3.5 !pr-9 font-mono !text-[13px]" />
          {key && <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide key" : "Show key"} className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink/50 hover:bg-tint"><Icon name={show ? "eyeoff" : "eye"} size={14} /></button>}
        </span>
        <button data-key-verify={provider} onClick={() => void verify()} disabled={!ready || !!busy || (!fresh && !saved)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-grape px-3 text-[13px] font-bold text-white transition hover:brightness-110 disabled:bg-tint disabled:text-ink/40">
          {busy === "verify" ? <Spinner /> : <Icon name={fresh || !saved ? "check" : "refresh"} size={14} stroke={2.6} />}{fresh || !saved ? "Verify" : "Check"}
        </button>
        {saved && (confirm
          ? <button data-key-remove-confirm={provider} onClick={() => void remove()} disabled={!!busy} aria-label={`Confirm remove ${p.name} key`} className={`${iconBtn} bg-[#e5484d] text-white`}>{busy === "remove" ? <Spinner /> : <Icon name="trash" size={15} />}</button>
          : <button data-key-remove={provider} onClick={() => setConfirm(true)} disabled={!!busy} aria-label={`Remove ${p.name} key`} title="Remove key" className={`${iconBtn} text-ink/50 ring-1 ring-line hover:text-[#e5484d] hover:ring-[#e5484d]/50`}><Icon name="trash" size={15} /></button>)}
      </div>
      {confirm && <p className="mt-1.5 text-[11.5px] text-[#e5484d]">Tap the red button to remove the key. Its models leave your list.</p>}
      {err && <p role="alert" className="mt-1.5 text-[12px] font-semibold text-[#e5484d]">{err}</p>}
      {provider === "openai" && saved && (
        <div className="mt-2.5 rounded-[14px] bg-tint/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink">Override OpenAI base URL</span><span className="block text-[11px] leading-snug text-ink/50">For any OpenAI-compatible API, with this key.</span></span>
            <Switch on={baseOn} busy={busy === "base"} label="Override OpenAI base URL" onChange={(v) => { setBaseOn(v); if (!v && saved.baseUrl) void saveBase(null); }} />
          </div>
          {baseOn && (
            <div className="mt-2 flex items-center gap-1.5">
              <input data-base-url value={base} onChange={(e) => setBase(e.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="https://api.example.com/v1" aria-label="Base URL" className="field h-9 min-w-0 flex-1 !rounded-full !py-0 !pl-3.5 font-mono !text-[12.5px]" />
              <button data-base-save onClick={() => void saveBase(base.trim())} disabled={!!busy || !base.trim() || base.trim() === saved.baseUrl} aria-label="Save base URL" className={`${iconBtn} bg-grape text-white disabled:bg-tint disabled:text-ink/40`}>{busy === "base" ? <Spinner /> : <Icon name="check" size={15} stroke={2.6} />}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Pick a model from the ones switched on. */
function PickSheet({ b, title, sub, current, followDefault, onClose, onPick }: { b: BillingState; title: string; sub: string; current: string | null; followDefault?: ModelInfo; onClose: () => void; onPick: (id: string | null) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (id: string | null, label: string) => {
    setBusy(id ?? "default");
    try { await onPick(id); toast({ text: id ? `Now using ${label}` : `Following the default (${label})` }); onClose(); }
    catch (e) { toast({ text: friendly(e, "Couldn't change the model. Try again.") }); }
    finally { setBusy(null); }
  };
  const list = enabledModels(b);
  const Opt = ({ m, on, id }: { m: ModelInfo; on: boolean; id: string | null }) => (
    <button data-pick-model={id ?? "default"} onClick={() => void go(id, m.label)} disabled={!!busy} aria-pressed={on} className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition first:rounded-t-[18px] last:rounded-b-[18px] ${on ? "bg-grape text-white" : "hover:bg-tint/50"}`}>
      <ModelMark m={m} size={26} />
      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{id === null ? "Account default" : m.label}</span><span className={`block truncate text-[11.5px] ${on ? "text-white/75" : "text-ink/50"}`}>{id === null ? m.label : m.pool === "byo" ? m.blurb : m.pool === "premium" ? "Premium usage" : "Included"}</span></span>
      {busy === (id ?? "default") ? <Spinner /> : on ? <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-brand-ink"><Icon name="check" size={13} stroke={3} /></span> : <span className="h-6 w-6 rounded-full ring-1 ring-line" />}
    </button>
  );
  return (
    <Sheet label="pick-model" title={title} sub={sub} icon={<Icon name="spark" size={20} />} onClose={onClose}>
      <div className="divide-y divide-[var(--line)] rounded-[18px] ring-1 ring-line">
        {followDefault && <Opt m={followDefault} on={current === null} id={null} />}
        {list.map((m) => <Opt key={m.id} m={m} on={current === m.id || (!followDefault && !current && m.id === LAMINA.id)} id={m.id} />)}
      </div>
      <p className="mt-2.5 px-1 text-[11.5px] text-ink/50">Only models switched on in Settings &gt; Models show here.</p>
    </Sheet>
  );
}

