"use client";

import { useRef, useState } from "react";
import { cutSecrets, findSecrets, isBlockedKind, scanSecrets, SECRET_NAME_RE, toSecretName, type Finding } from "@/lib/secretScan";
import { saveSecret } from "@/lib/secrets";
import { friendly } from "@/lib/api";
import { toast } from "@/lib/store";
import Icon from "../Icon";

type Item = { id: number; kind: Finding["kind"]; label: string; service: string; name: string; busy?: boolean; err?: string };
const ph = (id: number) => `[secret ${id}]`;
const B58_CAND = /\b[1-9A-HJ-NP-Za-km-z]{85,90}\b/;

/**
 * Paste protection for the chat box. Anything that looks like an API key, token or password is pulled out of the
 * message (a placeholder stays) and offered "Save securely" into the vault; a recovery phrase or private key is
 * removed and refused outright. Caught values sit only in a ref until saved or discarded, never in the message.
 */
export function usePasteGuard(getText: () => string, setText: (v: string) => void) {
  const [items, setItems] = useState<Item[]>([]);
  const values = useRef(new Map<number, string>());
  const next = useRef(1);

  /** Pulls secrets out of `text`; returns the cleaned text (or null when nothing was found). */
  const catchIn = async (text: string): Promise<string | null> => {
    const found = await findSecrets(text);
    if (!found.length) return null;
    const add: Item[] = [];
    const clean = cutSecrets(text, found, (f) => {
      const id = next.current++;
      if (!isBlockedKind(f.kind)) values.current.set(id, f.value);
      add.push({ id, kind: f.kind, label: f.label, service: f.service, name: f.name });
      return isBlockedKind(f.kind) ? "" : ph(id);
    }).replace(/[ \t]{2,}/g, " ");
    setItems((cur) => [...cur.filter((c) => !isBlockedKind(c.kind)), ...add]);
    return clean;
  };

  /** onPaste for the textarea: secrets never land in the box. */
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted || (!scanSecrets(pasted).length && !B58_CAND.test(pasted))) return;
    e.preventDefault();
    const el = e.currentTarget, a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
    const before = el.value.slice(0, a), after = el.value.slice(b);
    void catchIn(pasted).then((clean) => setText(`${before}${clean ?? pasted}${after}`.slice(0, 2000)));
  };

  /** Before sending: true when the message may go (nothing caught and nothing still waiting). */
  const check = async (text: string) => {
    const clean = await catchIn(text);
    if (clean !== null) { setText(clean); return false; }
    if (items.some((i) => !isBlockedKind(i.kind))) { toast({ text: "Save or discard the key first. It never goes in the chat." }); return false; }
    return true;
  };

  const swap = (id: number, put: string) => { const t = getText(); setText(t.includes(ph(id)) ? t.split(ph(id)).join(put).replace(/[ \t]{2,}/g, " ") : t); };
  const drop = (id: number) => { values.current.delete(id); setItems((cur) => cur.filter((c) => c.id !== id)); };
  const patch = (id: number, p: Partial<Item>) => setItems((cur) => cur.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const save = async (it: Item) => {
    const value = values.current.get(it.id);
    const name = toSecretName(it.name);
    if (!value) { drop(it.id); return; }
    if (!SECRET_NAME_RE.test(name)) { patch(it.id, { err: "Use a name like OPENAI_API_KEY." }); return; }
    patch(it.id, { busy: true, err: "" });
    try {
      const r = await saveSecret({ name, value, service: it.service || undefined, label: it.label.replace(/^an? /, "") });
      swap(it.id, `(saved securely as ${r.secret.name})`);
      drop(it.id);
      toast({ text: `Saved as ${r.secret.name}. Your agents can use it, never see it.` });
    } catch (e) { patch(it.id, { busy: false, err: friendly(e, "It couldn't be saved.") }); }
  };
  const discard = (it: Item) => { swap(it.id, ""); drop(it.id); };
  const clearAll = () => { values.current.clear(); setItems([]); };

  const panel = items.length ? (
    <div data-paste-guard className="mb-2 overflow-hidden rounded-[18px] bg-card ring-1 ring-line">
      {items.map((it) => isBlockedKind(it.kind) ? (
        <div key={it.id} data-guard-blocked={it.kind} role="alert" className="flex items-start gap-2.5 bg-[#e5484d]/12 p-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#e5484d] text-white"><Icon name="lock" size={15} /></span>
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink"><b className="block text-[13.5px]">Removed {it.label}</b>Never share it with anyone, agents included. Lexari will never ask for it, and it can't be saved or sent.</p>
          <button onClick={() => drop(it.id)} aria-label="Got it" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-tint"><Icon name="x" size={14} /></button>
        </div>
      ) : (
        <div key={it.id} data-guard-key={it.id} className="border-b border-line p-3 last:border-0">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-grape text-white"><Icon name="key" size={15} /></span>
            <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink/70"><b className="block truncate text-[13.5px] text-ink">That looks like {it.label}</b>Keys never go in chat. Save it to your vault instead.</p>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <input value={it.name} onChange={(e) => patch(it.id, { name: toSecretName(e.target.value) || e.target.value.toUpperCase().slice(0, 64), err: "" })} aria-label="Save as" placeholder="NAME" spellCheck={false} autoCapitalize="characters" className="h-9 min-w-0 flex-1 rounded-full bg-tint px-3 font-mono text-[12.5px] text-ink outline-none ring-grape focus:ring-2" />
            <button onClick={() => discard(it)} disabled={it.busy} aria-label="Discard it" title="Discard" data-guard-discard className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-ink/70 hover:bg-line disabled:opacity-40"><Icon name="trash" size={15} /></button>
            <button onClick={() => void save(it)} disabled={it.busy} data-guard-save className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-grape px-3 text-[12.5px] font-bold text-white hover:bg-grape-deep disabled:opacity-50">{it.busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Icon name="lock" size={13} />}Save securely</button>
          </div>
          {it.err && <p role="alert" className="mt-1.5 text-[12px] text-[#e5484d]">{it.err}</p>}
        </div>
      ))}
    </div>
  ) : null;

  return { onPaste, check, panel, clearAll, pending: items.some((i) => !isBlockedKind(i.kind)) };
}
