"use client";

import { useEffect, useState } from "react";
import { BYO_PROVIDERS, INCLUDED, LAMINA, PREMIUM, byoProvider, customInfo, type ByoProvider, type CustomModel, type ModelInfo } from "@/content/models";
import { infoFor, refreshBilling, setModel, useBilling, type BillingState } from "@/lib/billing";
import { api, friendly } from "@/lib/api";
import { toast, type State } from "@/lib/store";
import { myAgents } from "../agents";
import { AgentTile } from "../faces";
import Icon from "../Icon";
import { BurnChip, ModelMark, Sheet, Spinner } from "../billing/parts";

type Pick = null | { kind: "default" } | { kind: "agent"; id: string; name: string } | { kind: "add" } | { kind: "own"; id: string };
const tile = "flex w-full items-center gap-3 rounded-[18px] bg-card p-3 text-left ring-1 ring-line transition hover:ring-grape/50 max-[430px]:gap-2.5 max-[430px]:p-2.5";
const ago = (t: number) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : new Date(t).toLocaleDateString([], { month: "short", day: "numeric" }); };

/** Settings > Models: the account default, each agent's model, and models on your own API key. */
export default function ModelsSection({ s }: { s: State }) {
  const { state: b, error } = useBilling();
  const [sheet, setSheet] = useState<Pick>(null);
  useEffect(() => { void refreshBilling(); }, []);
  if (!b) return error ? <p className="rounded-[22px] bg-card p-5 text-[14px] text-ink/70 ring-1 ring-line">{error} <button onClick={() => void refreshBilling()} className="font-bold text-brand-ink">Try again</button></p> : <div className="space-y-3"><div className="h-[110px] animate-pulse rounded-[22px] bg-tint" /><div className="h-[160px] animate-pulse rounded-[22px] bg-tint" /></div>;
  const def = infoFor(b, b.models.default) ?? LAMINA;
  const custom = b.models.custom ?? [];
  const agents = myAgents(s);
  return (
    <div data-models-section className="grid gap-5 max-[430px]:gap-4">
      <button data-account-default={def.id} onClick={() => setSheet({ kind: "default" })} className="grain relative flex items-center gap-3.5 overflow-hidden rounded-[22px] bg-[linear-gradient(130deg,#2a0f9a,#5b2bff_60%,#8f6bff)] p-4 text-left text-white">
        <span className="rounded-[15px] ring-2 ring-white/30"><ModelMark m={def} size={46} /></span>
        <span className="min-w-0 flex-1">
          <span className="label block text-[9px] text-white/70">Account default</span>
          <span className="mt-0.5 block truncate text-[19px] font-bold leading-tight">{def.label}</span>
          <span className="mt-0.5 block truncate text-[12px] text-white/75">{def.pool === "byo" ? "On your key · never uses your balance" : def.pool === "lamina" ? "Included on every plan" : "Premium usage"}</span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15"><Icon name="right" size={16} className="rotate-90" /></span>
      </button>

      <section>
        <h3 className="label mb-1.5 px-1 text-[9.5px] text-ink/50">Agents</h3>
        <div className="grid gap-2">
          {agents.map((a) => {
            const own = infoFor(b, b.models.agents[a.id]);
            const m = own ?? def;
            return (
              <button key={a.id} data-agent-model-row={a.id} onClick={() => setSheet({ kind: "agent", id: a.id, name: a.name })} className={tile}>
                <AgentTile id={a.id} look={s.agent?.look} size={38} status={false} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-bold text-ink">{a.name}</span><span className="block truncate text-[12px] text-ink/55">{own ? m.label : `Default · ${m.label}`}</span></span>
                <ModelMark m={m} size={28} />
                <Icon name="right" size={15} className="shrink-0 text-ink/35" />
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h3 className="label text-[9.5px] text-ink/50">Your models · your keys</h3>
          <button data-add-model onClick={() => setSheet({ kind: "add" })} aria-label="Add a model" className="grid h-8 w-8 place-items-center rounded-full bg-grape text-white shadow-sm transition hover:scale-105"><Icon name="plus" size={16} stroke={2.6} /></button>
        </div>
        {custom.length === 0 ? (
          <button onClick={() => setSheet({ kind: "add" })} className="flex w-full items-center gap-3 rounded-[18px] border border-dashed border-[var(--line)] bg-card/60 p-3.5 text-left transition hover:border-grape/60">
            <span className="flex -space-x-2">{BYO_PROVIDERS.slice(0, 4).map((p) => <span key={p.id} className="rounded-[12px] ring-2 ring-[var(--card)]"><ModelMark m={customInfo({ id: p.id, provider: p.id, label: p.name, model: "" })} size={30} /></span>)}</span>
            <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold text-ink">Bring your own model</span><span className="block text-[12px] leading-snug text-ink/55">OpenAI, Claude, Gemini, Grok, OpenRouter or any OpenAI-compatible API. Never uses your Lexari balance.</span></span>
          </button>
        ) : (
          <div className="grid gap-2">{custom.map((c) => <OwnRow key={c.id} c={c} onOpen={() => setSheet({ kind: "own", id: c.id })} />)}</div>
        )}
      </section>

      {sheet?.kind === "default" && <PickSheet b={b} title="Account default" sub="Every agent without its own pick answers with this." current={b.models.default} onClose={() => setSheet(null)} onPick={async (id) => { await api("/api/models/default", { method: "PUT", body: { model: id } }); await refreshBilling(); }} onAdd={() => setSheet({ kind: "add" })} />}
      {sheet?.kind === "agent" && <PickSheet b={b} title={sheet.name} sub={`The model ${sheet.name} answers with in chats without their own pick.`} current={b.models.agents[sheet.id] ?? null} followDefault={def} onClose={() => setSheet(null)} onPick={async (id) => { await setModel({ scope: "agent", agent: sheet.id, model: id }); await refreshBilling(); }} onAdd={() => setSheet({ kind: "add" })} />}
      {sheet?.kind === "add" && <AddSheet onClose={() => setSheet(null)} onAdded={(id) => setSheet({ kind: "own", id })} />}
      {sheet?.kind === "own" && custom.find((c) => c.id === sheet.id) && <OwnSheet b={b} c={custom.find((c) => c.id === sheet.id)!} onClose={() => setSheet(null)} />}
    </div>
  );
}

function StatusDot({ c }: { c: CustomModel }) {
  const [t, cls] = c.status === "ok" ? ["Connected", "bg-[#e7f8ee] text-[#137a3d]"] : c.status === "failed" ? ["Failed", "bg-[#fdecec] text-[#c4292f]"] : ["Not tested", "bg-tint text-ink/55"];
  return <span data-model-status={c.status} className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${cls}`}>{t}</span>;
}

function OwnRow({ c, onOpen }: { c: CustomModel; onOpen: () => void }) {
  const m = customInfo(c);
  return (
    <button data-own-model={c.id} onClick={onOpen} className={tile}>
      <ModelMark m={m} size={38} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-bold text-ink">{m.label}</span>
        <span className="block truncate text-[12px] text-ink/55">{byoProvider(c.provider)?.name} · <span className="font-mono">••••{c.last4}</span></span>
      </span>
      <StatusDot c={c} />
    </button>
  );
}

/** Pick a model: Lamina and the included models, premium (when on), and your own. */
function PickSheet({ b, title, sub, current, followDefault, onClose, onPick, onAdd }: { b: BillingState; title: string; sub: string; current: string | null; followDefault?: ModelInfo; onClose: () => void; onPick: (id: string | null) => Promise<void>; onAdd: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (id: string | null, label: string) => {
    setBusy(id ?? "default");
    try { await onPick(id); toast({ text: id ? `Now using ${label}` : `Following the default (${label})` }); onClose(); }
    catch (e) { toast({ text: friendly(e, "Couldn't change the model. Try again.") }); }
    finally { setBusy(null); }
  };
  const built = [LAMINA, ...INCLUDED, ...PREMIUM].filter((m) => b.models.available[m.id]);
  const soon = PREMIUM.filter((m) => !b.models.available[m.id]);
  const custom = (b.models.custom ?? []).map(customInfo);
  const Opt = ({ m, on, id }: { m: ModelInfo; on: boolean; id: string | null }) => (
    <button data-pick-model={id ?? "default"} onClick={() => void go(id, m.label)} disabled={!!busy} aria-pressed={on} className={`flex w-full items-center gap-3 rounded-[16px] p-2.5 text-left transition ${on ? "bg-grape text-white" : "bg-card ring-1 ring-line hover:ring-grape/50"}`}>
      <ModelMark m={m} size={34} />
      <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="truncate text-[14px] font-bold">{id === null ? "Account default" : m.label}</span><BurnChip m={m} on={on} /></span><span className={`block truncate text-[12px] ${on ? "text-white/75" : "text-ink/55"}`}>{id === null ? m.label : m.blurb}</span></span>
      {busy === (id ?? "default") ? <Spinner /> : on ? <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-brand-ink"><Icon name="check" size={13} stroke={3} /></span> : <span className="h-6 w-6 rounded-full ring-1 ring-line" />}
    </button>
  );
  return (
    <Sheet label="pick-model" title={title} sub={sub} icon={<Icon name="spark" size={20} />} onClose={onClose}>
      <div className="grid gap-2">
        {followDefault && <Opt m={followDefault} on={current === null} id={null} />}
        <h4 className="label mt-1 px-1 text-[9px] text-ink/45">Built in</h4>
        {built.map((m) => <Opt key={m.id} m={m} on={current === m.id || (!followDefault && !current && m.id === LAMINA.id)} id={m.id} />)}
        {soon.length > 0 && <p className="px-1 text-[11.5px] text-ink/45">Soon: {soon.map((m) => m.short).join(", ")}</p>}
        <div className="mt-1 flex items-center justify-between px-1"><h4 className="label text-[9px] text-ink/45">Your models</h4><button onClick={onAdd} className="inline-flex items-center gap-1 text-[12px] font-bold text-brand-ink"><Icon name="plus" size={13} stroke={2.6} />Add</button></div>
        {custom.length ? custom.map((m) => <Opt key={m.id} m={m} on={current === m.id} id={m.id} />) : <p className="px-1 text-[12px] text-ink/50">None yet.</p>}
      </div>
    </Sheet>
  );
}

/** Add a model on your own key: provider, model id, key (and base URL for a custom API). Saves, then tests. */
function AddSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const [provider, setProvider] = useState<ByoProvider>("openai");
  const p = byoProvider(provider)!;
  const [model, setModelId] = useState(p.models[0] ?? "");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [label, setLabel] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const choose = (id: ByoProvider) => { setProvider(id); setModelId(byoProvider(id)!.models[0] ?? ""); setErr(""); };
  const ok = model.trim() && key.trim().length >= 8 && (provider !== "custom" || baseUrl.trim());
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api<{ model: CustomModel }>("/api/models", { body: { provider, model: model.trim(), key: key.trim(), ...(label.trim() ? { label: label.trim() } : {}), ...(provider === "custom" ? { baseUrl: baseUrl.trim() } : {}) } });
      setKey("");
      // Test right away so the list shows whether it works.
      const t = await api<{ result: { ok: boolean; error?: string } }>(`/api/models/${encodeURIComponent(r.model.id)}`, { body: { op: "test" } }).catch(() => null);
      await refreshBilling();
      toast({ text: t?.result.ok ? `${r.model.label} is connected` : `${r.model.label} saved. ${t?.result.error || "The test didn't pass."}` });
      onAdded(r.model.id);
    } catch (e) { setErr(friendly(e, "Couldn't save that model. Try again.")); }
    finally { setBusy(false); }
  };
  return (
    <Sheet label="add-model" title="Add a model" sub="Your key is encrypted on Lexari's server and never shown again. Usage goes on your provider account, not your Lexari balance." icon={<Icon name="plus" size={20} stroke={2.4} />} onClose={onClose}
      footer={<button data-save-model disabled={!ok || busy} onClick={() => void save()} className="btn btn-brand !h-11 w-full disabled:opacity-45 disabled:shadow-none">{busy ? <><Spinner className="mr-2" />Saving and testing…</> : "Save and test"}</button>}>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Provider">
        {BYO_PROVIDERS.map((x) => (
          <button key={x.id} role="radio" aria-checked={provider === x.id} data-provider={x.id} onClick={() => choose(x.id)} className={`flex flex-col items-center gap-1 rounded-[16px] p-2 text-center transition ${provider === x.id ? "bg-grape/12 ring-2 ring-grape" : "bg-card ring-1 ring-line hover:ring-grape/50"}`}>
            <ModelMark m={customInfo({ id: x.id, provider: x.id, label: x.name, model: "" })} size={30} />
            <span className="w-full truncate text-[11.5px] font-bold text-ink">{x.name}</span>
          </button>
        ))}
      </div>
      {provider === "custom" && (
        <label className="mt-3 block"><span className="label text-[9px] text-ink/55">Base URL</span><input data-base-url value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="https://api.example.com/v1" className="field mt-1 !py-2.5 !text-[14px]" /></label>
      )}
      <label className="mt-3 block"><span className="label text-[9px] text-ink/55">Model id</span><input data-model-id value={model} onChange={(e) => setModelId(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={provider === "custom" ? "e.g. llama-3.3-70b" : p.models[0]} className="field mt-1 !py-2.5 font-mono !text-[14px]" /></label>
      {p.models.length > 0 && <div className="no-bar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">{p.models.map((m) => <button key={m} onClick={() => setModelId(m)} className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[11.5px] font-semibold transition ${model === m ? "bg-ink text-[var(--bg)]" : "bg-tint text-ink/70 hover:text-ink"}`}>{m}</button>)}</div>}
      <label className="mt-3 block"><span className="label text-[9px] text-ink/55">API key</span>
        <span className="relative mt-1 block"><input data-api-key value={key} onChange={(e) => setKey(e.target.value)} type={show ? "text" : "password"} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={p.keyHint} className="field !py-2.5 !pr-11 font-mono !text-[14px]" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide key" : "Show key"} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink/55 hover:bg-tint"><Icon name={show ? "eyeoff" : "eye"} size={16} /></button></span>
      </label>
      <label className="mt-3 block"><span className="label text-[9px] text-ink/55">Name (optional)</span><input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} placeholder={model || "My model"} className="field mt-1 !py-2.5 !text-[14px]" /></label>
      {err && <p role="alert" className="mt-3 rounded-xl bg-[#fdecec] px-3 py-2.5 text-[12.5px] font-semibold text-[#c4292f]">{err}</p>}
    </Sheet>
  );
}

/** One of your models: test the connection, make it the default, or remove it (and its key). */
function OwnSheet({ b, c, onClose }: { b: BillingState; c: CustomModel; onClose: () => void }) {
  const m = customInfo(c);
  const [busy, setBusy] = useState<"test" | "remove" | "default" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const users = Object.entries(b.models.agents).filter(([, id]) => id === c.id).length + (b.models.default === c.id ? 1 : 0);
  const test = async () => {
    setBusy("test");
    try { const r = await api<{ result: { ok: boolean; error?: string; ms?: number } }>(`/api/models/${encodeURIComponent(c.id)}`, { body: { op: "test" } }); await refreshBilling(); toast({ text: r.result.ok ? `Connected in ${((r.result.ms ?? 0) / 1000).toFixed(1)}s` : r.result.error || "The test didn't pass." }); }
    catch (e) { toast({ text: friendly(e, "Couldn't test it. Try again.") }); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy("remove");
    try { await api(`/api/models/${encodeURIComponent(c.id)}`, { method: "DELETE" }); await refreshBilling(); toast({ text: `${m.label} removed. Its key is deleted.` }); onClose(); }
    catch (e) { toast({ text: friendly(e, "Couldn't remove it. Try again.") }); setBusy(null); }
  };
  const makeDefault = async () => {
    setBusy("default");
    try { await api("/api/models/default", { method: "PUT", body: { model: c.id } }); await refreshBilling(); toast({ text: `${m.label} is your default` }); }
    catch (e) { toast({ text: friendly(e, "Couldn't change the default.") }); }
    finally { setBusy(null); }
  };
  const rows: [string, React.ReactNode][] = [
    ["Provider", byoProvider(c.provider)?.name], ["Model id", <span key="m" className="font-mono">{c.model}</span>],
    ...(c.baseUrl ? [["Base URL", <span key="u" className="break-all font-mono text-[12px]">{c.baseUrl}</span>] as [string, React.ReactNode]] : []),
    ["API key", <span key="k" className="font-mono">••••••••{c.last4}</span>], ["Billing", "Your provider account"],
  ];
  return (
    <Sheet label="own-model" title={m.label} sub={c.note ? `${c.note}${c.testedAt ? ` · ${ago(c.testedAt)}` : ""}` : "Not tested yet."} icon={<ModelMark m={m} size={44} />} onClose={onClose}
      footer={confirm ? (
        <div className="grid gap-2"><p className="text-[12.5px] text-ink/65">{users ? `${users} place${users === 1 ? "" : "s"} use${users === 1 ? "s" : ""} it and will go back to Lamina. ` : ""}The key is deleted.</p>
          <div className="flex gap-2"><button onClick={() => setConfirm(false)} className="btn btn-line btn-sm !h-10 flex-1 text-ink">Keep</button><button data-remove-confirm onClick={() => void remove()} disabled={!!busy} className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-[#e5484d] text-[14px] font-bold text-white disabled:opacity-50">{busy === "remove" ? <Spinner /> : "Remove"}</button></div></div>
      ) : (
        <div className="flex items-center gap-2">
          <button data-test-model onClick={() => void test()} disabled={!!busy} className="btn btn-brand btn-sm !h-10 flex-1 disabled:opacity-60">{busy === "test" ? <><Spinner className="mr-2" />Testing…</> : "Test connection"}</button>
          <button data-default-own onClick={() => void makeDefault()} disabled={!!busy || b.models.default === c.id} aria-label="Make account default" title="Make account default" className="grid h-10 w-10 place-items-center rounded-full bg-tint text-ink transition hover:bg-grape hover:text-white disabled:opacity-45">{busy === "default" ? <Spinner /> : <Icon name="star" size={17} />}</button>
          <button data-remove-model onClick={() => setConfirm(true)} disabled={!!busy} aria-label="Remove model" title="Remove" className="grid h-10 w-10 place-items-center rounded-full text-[#e5484d] ring-1 ring-[#e5484d]/40 transition hover:bg-[#e5484d] hover:text-white"><Icon name="trash" size={16} /></button>
        </div>
      )}>
      <div className="mb-3 flex items-center gap-2"><StatusDot c={c} />{b.models.default === c.id && <span className="label rounded-full bg-grape px-1.5 py-0.5 text-[8px] text-white">Default</span>}<BurnChip m={m} /></div>
      <dl className="divide-y divide-[var(--line)] rounded-[16px] bg-tint/50 px-3.5 text-[13px] ring-1 ring-line">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2.5"><dt className="shrink-0 text-ink/55">{k}</dt><dd className="min-w-0 text-right font-semibold text-ink">{v}</dd></div>)}
      </dl>
    </Sheet>
  );
}
