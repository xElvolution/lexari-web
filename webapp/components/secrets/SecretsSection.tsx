"use client";

import { useEffect, useRef, useState } from "react";
import type { SecretInfo } from "@/content/secrets";
import { deleteSecret, listSecrets, replaceSecret, saveSecret, setSecretAgents } from "@/lib/secrets";
import { friendly } from "@/lib/api";
import { toast, type State } from "@/lib/store";
import { findSecrets, isBlockedKind, SECRET_NAME_RE, toSecretName } from "@/lib/secretScan";
import { myAgents } from "../agents";
import { AgentTile } from "../faces";
import Icon from "../Icon";
import { Sheet } from "../billing/parts";

const card = "rounded-[20px] bg-card ring-1 ring-line";
const h3 = "label mb-1.5 px-1 text-[9.5px] text-ink/50";
const ibtn = "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-ink/70 transition hover:bg-grape hover:text-white disabled:opacity-40";
const day = (t: number) => new Date(t).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

type Edit = null | { kind: "add" } | { kind: "replace"; s: SecretInfo } | { kind: "agents"; s: SecretInfo } | { kind: "delete"; s: SecretInfo };

/** Settings > Secrets: what's in your vault (names, services, last 4), which agents can use each, Replace and Delete. */
export default function SecretsSection({ s }: { s: State }) {
  const [list, setList] = useState<SecretInfo[] | null>(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Edit>(null);
  const load = () => listSecrets().then((l) => { setList(l); setError(""); }, (e) => setError(friendly(e, "Couldn't load your secrets.")));
  useEffect(() => { void load(); }, []);
  const agents = myAgents(s);
  const agentName = (id: string) => agents.find((a) => a.id === id)?.name || id;
  const put = (x: SecretInfo) => setList((cur) => { const l = cur || []; const i = l.findIndex((y) => y.id === x.id); return i < 0 ? [x, ...l] : l.map((y) => (y.id === x.id ? x : y)); });

  return (
    <div data-secrets-section className="grid gap-5 max-[430px]:gap-4">
      <section>
        <div className="mb-1.5 flex items-end justify-between px-1">
          <h3 className="label text-[9.5px] text-ink/50">Vault</h3>
          <button onClick={() => setEdit({ kind: "add" })} data-secret-add className="inline-flex h-8 items-center gap-1.5 rounded-full bg-grape px-3 text-[12.5px] font-bold text-white hover:bg-grape-deep"><Icon name="plus" size={14} stroke={2.4} />Add</button>
        </div>
        <div className={`${card} overflow-hidden`}>
          {!list && !error && <div className="space-y-2 p-4"><div className="h-12 animate-pulse rounded-2xl bg-tint" /><div className="h-12 animate-pulse rounded-2xl bg-tint" /></div>}
          {error && <p className="p-4 text-[14px] text-ink/70">{error} <button onClick={() => void load()} className="font-bold text-brand-ink">Try again</button></p>}
          {list && !list.length && (
            <div className="flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-tint text-brand-ink"><Icon name="key" size={18} /></span>
              <p className="text-[13.5px] leading-snug text-ink/65">Nothing saved yet. When an agent needs an API key or token it asks with a secure card in the chat, and it lands here.</p>
            </div>
          )}
          {list?.map((x) => (
            <div key={x.id} data-secret-row={x.name} className="flex items-center gap-2.5 border-b border-line px-3.5 py-3 last:border-0 max-[430px]:px-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-tint text-brand-ink"><Icon name="key" size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[13px] font-semibold text-ink">{x.name}</div>
                <div className="truncate text-[11.5px] text-ink/55">{x.service || x.label || "Secret"} · <span className="font-mono">••••{x.last4}</span> · {day(x.createdAt)}</div>
                <div className="mt-0.5 truncate text-[11.5px] text-ink/55"><Icon name="team" size={11} className="mr-1 inline -translate-y-px" />{x.agents.length ? x.agents.map(agentName).join(", ") : "All your agents"}</div>
              </div>
              <button onClick={() => setEdit({ kind: "agents", s: x })} aria-label={`Which agents can use ${x.name}`} title="Agents" data-secret-agents className={ibtn}><Icon name="team" size={15} /></button>
              <button onClick={() => setEdit({ kind: "replace", s: x })} aria-label={`Replace ${x.name}`} title="Replace" data-secret-replace className={ibtn}><Icon name="edit" size={15} /></button>
              <button onClick={() => setEdit({ kind: "delete", s: x })} aria-label={`Delete ${x.name}`} title="Delete" data-secret-delete className={`${ibtn} hover:!bg-[#e5484d]`}><Icon name="trash" size={15} /></button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className={h3}>How it works</h3>
        <ul className={`${card} space-y-2.5 p-4 text-[13px] leading-snug text-ink/70`}>
          <li className="flex gap-2.5"><Icon name="lock" size={15} className="mt-0.5 shrink-0 text-brand-ink" />Encrypted on our server (AES-256). Nobody, not even your agents, can read a saved value back.</li>
          <li className="flex gap-2.5"><Icon name="terminal" size={15} className="mt-0.5 shrink-0 text-brand-ink" />Agents use a secret by name. It&apos;s added to their command only while it runs, and blocked out of anything they see.</li>
          <li className="flex gap-2.5"><Icon name="eyeoff" size={15} className="mt-0.5 shrink-0 text-brand-ink" />Never paste keys in chat. If you do, Lexari catches it and offers to save it here. Recovery phrases and private keys are always refused.</li>
        </ul>
      </section>
      {edit?.kind === "add" && <ValueSheet title="Add a secret" onClose={() => setEdit(null)} onSave={async (v, name, service) => { const r = await saveSecret({ name: name!, value: v, service, label: service ? `${service} key` : undefined }); put(r.secret); toast({ text: `Saved as ${r.secret.name}` }); }} withName />}
      {edit?.kind === "replace" && <ValueSheet title={`Replace ${edit.s.name}`} onClose={() => setEdit(null)} onSave={async (v) => { put(await replaceSecret(edit.s.id, v)); toast({ text: `${edit.s.name} replaced` }); }} />}
      {edit?.kind === "agents" && <AgentsSheet s={s} secret={edit.s} onClose={() => setEdit(null)} onSave={async (ids) => { put(await setSecretAgents(edit.s.id, ids)); }} />}
      {edit?.kind === "delete" && (
        <Sheet label="Delete secret" title={`Delete ${edit.s.name}?`} sub="Agents lose access right away. This can't be undone." icon={<Icon name="trash" size={20} />} onClose={() => setEdit(null)}
          footer={<div className="flex gap-2"><button onClick={() => setEdit(null)} className="btn btn-line btn-sm !h-11 flex-1 text-ink">Keep</button><button data-secret-delete-confirm onClick={async () => { try { await deleteSecret(edit.s.id); setList((l) => (l || []).filter((y) => y.id !== edit.s.id)); setEdit(null); toast({ text: `${edit.s.name} deleted` }); } catch (e) { toast({ text: friendly(e) }); } }} className="btn btn-sm !h-11 flex-1 bg-[#e5484d] text-white">Delete</button></div>}>
          <span />
        </Sheet>
      )}
    </div>
  );
}

function ValueSheet({ title, onClose, onSave, withName = false }: { title: string; onClose: () => void; onSave: (value: string, name?: string, service?: string) => Promise<void>; withName?: boolean }) {
  const field = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    const el = field.current; if (!el) return;
    const v = el.value;
    if (!v.trim()) { setErr("Paste the value first."); return; }
    if (withName && !SECRET_NAME_RE.test(toSecretName(name))) { setErr("Give it a name like CLOUDFLARE_API_TOKEN."); return; }
    const bad = (await findSecrets(v)).find((f) => isBlockedKind(f.kind));
    if (bad) { el.value = ""; setErr(`That looks like ${bad.label}. Lexari never stores those. Keep it private.`); return; }
    setBusy(true); setErr(""); el.value = "";
    try { await onSave(v, toSecretName(name), service.trim() || undefined); onClose(); } catch (e) { setErr(friendly(e, "It couldn't be saved.")); } finally { setBusy(false); }
  };
  return (
    <Sheet label={title} title={title} sub="The value is encrypted and never shown again." icon={<Icon name="key" size={20} />} onClose={onClose}
      footer={<button data-secret-sheet-save onClick={() => void go()} disabled={busy} className="btn btn-brand btn-sm !h-11 w-full disabled:opacity-60">{busy ? "Saving…" : "Save securely"}</button>}>
      <form onSubmit={(e) => { e.preventDefault(); void go(); }} autoComplete="off" className="grid gap-2.5">
        {withName && <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <input value={name} onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 64))} placeholder="NAME" aria-label="Name" spellCheck={false} data-secret-name className="field !h-11 !py-0 font-mono !text-[14px]" />
          <input value={service} onChange={(e) => setService(e.target.value.slice(0, 40))} placeholder="Service" aria-label="Service" className="field !h-11 !py-0 !text-[14px]" />
        </div>}
        <span className="flex items-center rounded-2xl bg-tint pl-3.5 ring-grape focus-within:ring-2">
          <input ref={field} type={show ? "text" : "password"} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} data-lpignore="true" data-1p-ignore placeholder="Paste the value" aria-label="Value" data-secret-value className="h-11 min-w-0 flex-1 bg-transparent font-mono text-[14px] text-ink outline-none placeholder:font-sans placeholder:text-ink/40" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide" : "Show"} className="grid h-11 w-11 place-items-center text-ink/55"><Icon name={show ? "eyeoff" : "eye"} size={16} /></button>
        </span>
        {err && <p role="alert" className="text-[12.5px] text-[#e5484d]">{err}</p>}
      </form>
    </Sheet>
  );
}

function AgentsSheet({ s, secret, onClose, onSave }: { s: State; secret: SecretInfo; onClose: () => void; onSave: (ids: string[]) => Promise<void> }) {
  const agents = myAgents(s);
  const [all, setAll] = useState(!secret.agents.length);
  const [pick, setPick] = useState<string[]>(secret.agents);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Sheet label="Agents" title={secret.name} sub="Which agents can use this secret." icon={<Icon name="team" size={20} />} onClose={onClose}
      footer={<button disabled={busy || (!all && !pick.length)} onClick={async () => { setBusy(true); try { await onSave(all ? [] : pick); onClose(); } catch (e) { toast({ text: friendly(e) }); } finally { setBusy(false); } }} className="btn btn-brand btn-sm !h-11 w-full disabled:opacity-50">Save</button>}>
      <div className="grid gap-1.5">
        <button onClick={() => setAll(true)} aria-pressed={all} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${all ? "bg-grape/10 ring-2 ring-grape" : "bg-tint"}`}><Icon name="team" size={18} /><span className="flex-1 text-[14px] font-semibold text-ink">All your agents</span>{all && <Icon name="check" size={16} className="text-brand-ink" />}</button>
        {agents.map((a) => { const on = !all && pick.includes(a.id); return (
          <button key={a.id} onClick={() => { setAll(false); toggle(a.id); }} aria-pressed={on} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-left ${on ? "bg-grape/10 ring-2 ring-grape" : "bg-tint"}`}>
            <AgentTile id={a.id} look={a.id === "home" ? s.agent?.look : undefined} size={30} status={false} ring={false} /><span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{a.name}</span>{on && <Icon name="check" size={16} className="text-brand-ink" />}
          </button>
        ); })}
      </div>
    </Sheet>
  );
}
