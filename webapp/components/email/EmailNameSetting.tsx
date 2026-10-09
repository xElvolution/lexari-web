"use client";

import { useEffect, useRef, useState } from "react";
import { chooseHandle, loadHandle, refreshUnread, useEmail, type HandleInfo } from "@/lib/email";
import { ApiError } from "@/lib/api";
import { toast } from "@/lib/store";
import Icon from "../Icon";

/** The server's own message (keys, names), never the wallet wording. */
const say = (e: unknown, fallback: string) => (e instanceof ApiError && e.status < 500 ? e.message : fallback);

const slugAgent = (n: string) => n.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "agent";

/**
 * Settings > Account: your email name. Every agent's address is <agent>.<email name>@agents.lexari.ai. It starts as
 * your first name and you can choose your own once, with a live availability check.
 */
export default function EmailNameSetting({ agent }: { agent: string }) {
  const { mode } = useEmail();
  const [info, setInfo] = useState<HandleInfo | null>(null);
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState("");
  const [check, setCheck] = useState<HandleInfo["check"] | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => { void refreshUnread(); }, []);
  useEffect(() => { if (mode && mode !== "off") loadHandle().then(setInfo, () => {}); }, [mode]);
  const name = v.trim().toLowerCase();
  useEffect(() => {
    if (!edit || !name || name === info?.handle) { setCheck(null); setChecking(false); return; }
    const n = ++seq.current;
    setChecking(true);
    const t = setTimeout(() => { loadHandle(name).then((r) => { if (n === seq.current) { setCheck(r.check ?? null); setChecking(false); } }, () => { if (n === seq.current) setChecking(false); }); }, 350);
    return () => clearTimeout(t);
  }, [name, edit, info?.handle]);
  if (!mode || mode === "off" || !info) return null;
  const sample = (h: string) => `${slugAgent(agent)}.${h || "yourname"}@${info.domain}`;
  const ok = !!check?.available && check.handle === name;
  const save = async () => {
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try { const r = await chooseHandle(name); setInfo(r); setEdit(false); setConfirm(false); toast({ text: `Your agents are now @${r.handle}` }); }
    catch (e) { toast({ text: say(e, "Couldn't save that name. Try another.") }); setConfirm(false); }
    finally { setBusy(false); }
  };
  return (
    <section className="mt-6 first:mt-0"><h3 className="label mb-1 text-[9.5px] text-ink/50">Agent email</h3><div data-email-name className="rounded-[22px] bg-card px-5 py-4 ring-1 ring-line max-[430px]:px-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">Email name{info.chosen && <span className="label inline-flex items-center gap-1 rounded-full bg-tint px-1.5 py-0.5 text-[8px] text-ink/60"><Icon name="lock" size={9} />Set</span>}</div>
          <div className="mt-0.5 text-[13.5px] leading-snug text-ink/60">All your agents share it. Their addresses look like <span data-email-sample className="break-all font-mono text-[12.5px] font-semibold text-ink">{sample(edit ? name : info.handle)}</span></div>
        </div>
        {!info.chosen && !edit && <button data-email-name-edit onClick={() => { setEdit(true); setV(info.handle); }} aria-label="Choose your email name" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tint text-ink transition hover:bg-grape hover:text-white"><Icon name="edit" size={16} /></button>}
      </div>
      {edit && (
        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <span className="relative min-w-0 flex-1">
              <input data-email-name-input value={v} onChange={(e) => { setV(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30)); setConfirm(false); }} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Email name" placeholder="yourname" className="field h-10 !rounded-full !py-0 !pl-4 !pr-10 font-mono !text-[14px]" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">{checking ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-grape" /> : name === info.handle ? null : ok ? <Icon name="check" size={16} stroke={2.8} className="text-[#2fbf71]" /> : check ? <Icon name="x" size={16} stroke={2.6} className="text-[#e5484d]" /> : null}</span>
            </span>
            <button onClick={() => { setEdit(false); setConfirm(false); }} aria-label="Cancel" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/60 ring-1 ring-line hover:bg-tint"><Icon name="x" size={16} /></button>
            <button data-email-name-save onClick={() => void save()} disabled={!ok || busy || checking} className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-bold text-white transition disabled:bg-tint disabled:text-ink/40 ${confirm ? "bg-[#e5484d]" : "bg-grape"}`}>{busy ? "Saving…" : confirm ? "Confirm" : "Save"}</button>
          </div>
          <p data-email-name-status className={`mt-1.5 px-1 text-[12px] font-semibold ${confirm ? "text-[#e5484d]" : ok ? "text-[#2fbf71]" : check && !checking ? "text-[#e5484d]" : "text-ink/50"}`}>
            {confirm ? "You can only choose this once. Old addresses stop receiving mail." : checking ? "Checking…" : name === info.handle ? "This is your name now." : check ? (check.available ? `${check.handle} is available` : check.reason) : "Lowercase letters, numbers and hyphens."}
          </p>
        </div>
      )}
    </div></section>
  );
}
