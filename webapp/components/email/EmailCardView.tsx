"use client";

import { useState } from "react";
import type { EmailCard } from "@/content/email";
import { actOnEmail } from "@/lib/email";
import { friendly } from "@/lib/api";
import { set, useApp, type Msg } from "@/lib/store";
import { nameOf } from "../agents";
import Icon from "../Icon";

const CHIP: Record<EmailCard["status"], [string, string]> = {
  draft: ["Draft", "bg-grape/12 text-brand-ink"], sending: ["Sending", "bg-[#fff4d6] text-[#8a5a00]"], sent: ["Sent", "bg-[#e7f8ee] text-[#137a3d]"],
  failed: ["Failed", "bg-[#fdecec] text-[#c4292f]"], cancelled: ["Cancelled", "bg-tint text-ink/55"], received: ["Received", "bg-tint text-ink/60"],
};

/** An email an agent wrote, in chat. Nothing is sent until you tap Send; you can edit it first. */
export function EmailCardView({ convo, m }: { convo: string; m: Msg & { email: EmailCard } }) {
  const [e, setE] = useState<EmailCard>(m.email);
  const [busy, setBusy] = useState<"send" | "cancel" | null>(null);
  const [edit, setEdit] = useState(false);
  const [subject, setSubject] = useState(e.subject);
  const [text, setText] = useState(e.text);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const st = useApp();
  const who = st ? nameOf(st, e.agent) : "Your agent";
  const keep = (n: EmailCard) => { setE(n); set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === m.id ? { ...mm, email: n } : mm)) } })); };
  const run = async (op: "send" | "cancel") => {
    setErr(""); setBusy(op);
    try { keep(await actOnEmail(e.id, op, op === "send" && (subject !== e.subject || text !== e.text) ? { subject, text } : undefined)); setEdit(false); }
    catch (x) { setErr(friendly(x, "That didn't go through. Nothing was sent.")); }
    finally { setBusy(null); }
  };
  const [label, chip] = CHIP[e.status];
  const long = e.text.length > 220;
  return (
    <div data-email-card={e.id} data-email-status={e.status} className="row-in mt-2 w-[min(330px,100%)] overflow-hidden rounded-2xl bg-card ring-1 ring-line">
      <div className="flex items-center gap-2.5 bg-tint/70 px-3.5 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-grape text-white"><Icon name="mail" size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold leading-tight text-ink">{edit ? "Edit email" : e.subject || "(no subject)"}</div>
          <div className="truncate text-[11.5px] text-ink/55">{e.fromLabel} · {who}</div>
        </div>
        <span data-email-chip className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${chip}`}>{label}</span>
      </div>
      <dl className="space-y-1 px-3.5 pt-2.5 text-[12.5px]">
        <div className="flex gap-2"><dt className="w-12 shrink-0 text-ink/50">To</dt><dd className="min-w-0 break-all font-semibold text-ink">{e.to.join(", ")}</dd></div>
        <div className="flex gap-2"><dt className="w-12 shrink-0 text-ink/50">From</dt><dd className="min-w-0 break-all text-ink/75">{e.from}</dd></div>
        {e.replyTo && <div className="flex gap-2"><dt className="w-12 shrink-0 text-ink/50">Reply</dt><dd className="min-w-0 break-all text-ink/75">{e.replyTo}</dd></div>}
      </dl>
      <div className="px-3.5 pt-2.5">
        {edit ? (
          <div className="grid gap-2">
            <input value={subject} onChange={(x) => setSubject(x.target.value.slice(0, 200))} aria-label="Subject" className="field !py-2 !text-[13.5px]" />
            <textarea value={text} onChange={(x) => setText(x.target.value.slice(0, 10000))} aria-label="Body" rows={7} className="field resize-none !py-2 !text-[13.5px] !leading-snug" />
          </div>
        ) : (
          <button type="button" onClick={() => setOpen(!open)} className="block w-full rounded-xl bg-tint/60 px-3 py-2.5 text-left">
            <p className={`whitespace-pre-wrap text-[13px] leading-snug text-ink/85 ${open || !long ? "" : "line-clamp-5"}`}>{e.text}</p>
            {long && <span className="mt-1 block text-[11.5px] font-bold text-brand-ink">{open ? "Show less" : "Show all"}</span>}
          </button>
        )}
      </div>
      <div className="px-3.5 pb-3.5 pt-2.5">
        {e.mock && <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/50"><span className="h-1.5 w-1.5 rounded-full bg-[#f5a524]" />Test mode · not delivered outside Lexari</p>}
        {e.status === "draft" && (
          <div className="mt-2.5 flex gap-2">
            <button data-email-cancel onClick={() => void run("cancel")} disabled={!!busy} aria-label="Cancel draft" title="Cancel" className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-line text-ink/70 transition hover:bg-tint disabled:opacity-50">{busy === "cancel" ? <i className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Icon name="x" size={17} />}</button>
            <button data-email-edit onClick={() => { setEdit(!edit); setSubject(e.subject); setText(e.text); }} disabled={!!busy} aria-label={edit ? "Stop editing" : "Edit"} title={edit ? "Stop editing" : "Edit"} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 transition disabled:opacity-50 ${edit ? "bg-ink text-[var(--bg)] ring-ink" : "ring-line text-ink/70 hover:bg-tint"}`}><Icon name="edit" size={16} /></button>
            <button data-email-send onClick={() => void run("send")} disabled={!!busy || !text.trim()} className="btn btn-brand btn-sm !h-10 flex-1 gap-1.5 disabled:opacity-60">{busy === "send" ? "Sending…" : <><Icon name="send" size={15} />Send</>}</button>
          </div>
        )}
        {e.status === "sent" && <p data-email-sent className="pop mt-2.5 flex items-center gap-2 rounded-xl bg-[#e7f8ee] px-3 py-2.5 text-[13px] font-bold text-[#137a3d]"><Icon name="check" size={15} stroke={2.6} />{e.mock ? "Sent · test mode" : "Sent"}{e.sentAt ? <span className="ml-auto text-[11.5px] font-semibold">{new Date(e.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span> : null}</p>}
        {e.status === "failed" && <p role="alert" className="mt-2.5 rounded-xl bg-[#fdecec] px-3 py-2.5 text-[12.5px] font-semibold text-[#c4292f]">{e.error || "It didn't send. Nothing went out."}</p>}
        {e.status === "cancelled" && <p className="mt-2.5 text-[12.5px] font-semibold text-ink/55">Cancelled. Nothing was sent.</p>}
        {err && <p role="alert" className="mt-2 text-[12.5px] text-[#e5484d]">{err}</p>}
      </div>
    </div>
  );
}
