"use client";

import { useRef, useState } from "react";
import type { SecretCard } from "@/content/secrets";
import { cancelSecretRequest, openDesktop, saveSecret } from "@/lib/secrets";
import { friendly } from "@/lib/api";
import { sendTo, set, useApp, type Msg } from "@/lib/store";
import { findSecrets, isBlockedKind } from "@/lib/secretScan";
import { nameOf } from "../agents";
import Icon from "../Icon";

const ibtn = "grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-40";

/**
 * The secure card: an agent asked for a credential. The value is typed into a masked field and sent straight to the
 * vault; it never becomes a chat message, and the field is cleared the moment the request leaves.
 */
export function SecretCardView({ convo, m }: { convo: string; m: Msg & { secret: SecretCard } }) {
  const st = useApp();
  const [c, setC] = useState<SecretCard>(m.secret);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"save" | "cancel" | null>(null);
  const [err, setErr] = useState("");
  const [filled, setFilled] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const who = st ? nameOf(st, c.agent) : "Your agent";
  const keep = (next: SecretCard) => {
    setC(next);
    set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === m.id ? { ...mm, secret: next } : mm)) } }));
  };
  const save = async () => {
    const el = field.current; if (!el) return;
    const value = el.value;
    if (!value.trim()) { setErr("Paste the value first."); return; }
    const bad = (await findSecrets(value)).find((f) => isBlockedKind(f.kind));
    if (bad) { el.value = ""; setFilled(false); setErr(`That looks like ${bad.label}. No agent ever needs one, so it wasn't saved. Keep it private.`); return; }
    setErr(""); setBusy("save");
    el.value = ""; setFilled(false); // the value lives only in this request from here on
    try {
      const r = await saveSecret({ name: c.name, value, label: c.label, service: c.service, requestId: c.id });
      keep(r.card || { ...c, status: "saved" });
      sendTo(convo, `Saved securely as ${r.secret.name}.`);
    } catch (e) { setErr(friendly(e, "It couldn't be saved. Try again.")); }
    finally { setBusy(null); }
  };
  const cancel = async () => {
    setBusy("cancel"); setErr("");
    if (field.current) field.current.value = "";
    try { keep(await cancelSecretRequest(c.id)); } catch (e) { setErr(friendly(e)); } finally { setBusy(null); }
  };
  return (
    <div data-secret-card={c.id} data-secret-status={c.status} className="row-in mt-2 w-[min(320px,100%)] overflow-hidden rounded-2xl bg-card ring-1 ring-line">
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-grape text-white"><Icon name="lock" size={15} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold leading-tight text-ink">{c.label}</div>
          <div className="truncate text-[11.5px] text-ink/55">{c.service ? `${c.service} · ` : ""}{who} asked</div>
        </div>
        {c.status === "saved" && <span className="shrink-0 rounded-full bg-[#e7f8ee] px-2 py-0.5 text-[10.5px] font-bold text-[#137a3d]">Saved</span>}
        {c.status === "cancelled" && <span className="shrink-0 rounded-full bg-tint px-2 py-0.5 text-[10.5px] font-bold text-ink/55">Cancelled</span>}
      </div>
      {c.why && c.status === "pending" && <p className="px-3 pt-1.5 text-[12.5px] leading-snug text-ink/65">{c.why}</p>}
      {c.status === "pending" ? (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex items-center gap-1.5 p-3 pt-2.5" autoComplete="off">
          <span className="flex min-w-0 flex-1 items-center rounded-full bg-tint pl-3 ring-grape focus-within:ring-2">
            <input ref={field} type={show ? "text" : "password"} name={`vault-${c.id}`} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} data-lpignore="true" data-1p-ignore data-secret-input
              onChange={(e) => setFilled(!!e.target.value)} placeholder={`Paste ${c.name}`} aria-label={`${c.label} (kept secret)`} className="h-9 min-w-0 flex-1 bg-transparent font-mono text-[13px] text-ink outline-none placeholder:font-sans placeholder:text-ink/40" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide" : "Show"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/55"><Icon name={show ? "eyeoff" : "eye"} size={15} /></button>
          </span>
          <button type="button" onClick={() => void cancel()} disabled={!!busy} aria-label="Cancel" title="Cancel" data-secret-cancel className={`${ibtn} bg-tint text-ink/70 hover:bg-line`}><Icon name="x" size={15} /></button>
          <button type="submit" disabled={!!busy || !filled} aria-label="Save securely" title="Save securely" data-secret-save className={`${ibtn} bg-grape text-white hover:bg-grape-deep`}>{busy === "save" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Icon name="check" size={16} stroke={2.6} />}</button>
        </form>
      ) : (
        <p className="flex items-center gap-1.5 px-3 pb-3 pt-2 text-[12px] font-semibold text-ink/55">
          {c.status === "saved" ? <><Icon name="key" size={13} />Saved as <code className="font-mono text-ink/75">{c.name}</code> · {who} never sees it</> : "Nothing was saved."}
        </p>
      )}
      {c.status === "pending" && <p className="flex items-center gap-1.5 px-3 pb-3 -mt-1 text-[11px] text-ink/45"><Icon name="eyeoff" size={12} />Encrypted in your vault. Never shown to {who} or in chat.</p>}
      {err && <p role="alert" className="px-3 pb-3 text-[12px] leading-snug text-[#e5484d]">{err}</p>}
    </div>
  );
}

/** The agent stopped at a sign-in page on its computer: you take over its desktop and sign in yourself. */
export function TakeoverCardView({ reason }: { reason: string }) {
  return (
    <div data-takeover-card className="row-in mt-2 flex w-[min(320px,100%)] items-center gap-2.5 rounded-2xl bg-card p-3 ring-1 ring-line">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-tint text-brand-ink"><Icon name="monitor" size={16} /></span>
      <span className="min-w-0 flex-1"><b className="block truncate text-[13.5px] text-ink">{reason}</b><span className="block text-[11.5px] leading-snug text-ink/55">You sign in on my screen. I never see your password.</span></span>
      <button onClick={openDesktop} data-takeover-open className="shrink-0 rounded-full bg-grape px-3 py-1.5 text-[12.5px] font-bold text-white">Take over</button>
    </div>
  );
}
