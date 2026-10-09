"use client";

import { useCallback, useEffect, useState } from "react";
import type { MailItem } from "@/content/email";
import { closeMail, loadMailbox, readMail, refreshUnread, saveMailbox, setUnread, testMail, useEmail, type MailState } from "@/lib/email";
import { friendly } from "@/lib/api";
import { sendTo, toast, useApp } from "@/lib/store";
import { nameOf } from "../agents";
import { AgentTile } from "../faces";
import Icon from "../Icon";
import { Sheet, Spinner } from "../billing/parts";

const when = (t: number) => { const d = new Date(t); const today = new Date().toDateString() === d.toDateString(); return today ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" }); };
const initial = (m: MailItem) => (m.dir === "out" ? m.to[0] : m.fromName || m.from).trim()[0]?.toUpperCase() || "?";
const iconBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-ink transition hover:bg-grape hover:text-white disabled:opacity-45";

/** Mounted once in the app shell: opens an agent's mailbox (also from a notification link with ?mail=1). */
export default function MailSheetHost() {
  const { open } = useEmail();
  useEffect(() => {
    void refreshUnread();
    const t = setInterval(() => { if (document.visibilityState === "visible") void refreshUnread(); }, 60_000);
    const q = new URLSearchParams(window.location.search);
    const m = window.location.pathname.match(/^\/agents\/([\w-]+)/);
    if (q.get("mail") === "1" && m) { import("@/lib/email").then((x) => x.openMail(m[1])); q.delete("mail"); window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`); }
    return () => clearInterval(t);
  }, []);
  return open ? <MailSheet key={open} agent={open} /> : null;
}

type View = { kind: "list" } | { kind: "read"; id: string } | { kind: "setup" };

function MailSheet({ agent }: { agent: string }) {
  const s = useApp();
  const name = s ? nameOf(s, agent) : "Agent";
  const [st, setSt] = useState<MailState | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"in" | "out">("in");
  const [view, setView] = useState<View>({ kind: "list" });
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const r = await loadMailbox(agent); setSt(r); setUnread(agent, r.box.unread); setErr(""); }
    catch (e) { setErr(friendly(e, "Couldn't open the inbox.")); }
  }, [agent]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 20_000); return () => clearInterval(t); }, [load]);

  const copy = (text: string, what: string) => { void navigator.clipboard?.writeText(text).then(() => toast({ text: `${what} copied` }), () => toast({ text: "Couldn't copy. Long-press to copy instead." })); };
  const test = async (kind: "mail" | "gmail_verify") => {
    setBusy(kind);
    try { await testMail(agent, kind); await load(); setTab("in"); toast({ text: kind === "mail" ? "A test email arrived" : "A Gmail confirmation arrived" }); }
    catch (e) { toast({ text: friendly(e, "Couldn't add a test email.") }); }
    finally { setBusy(null); }
  };
  const ask = (text: string) => { closeMail(); void sendTo(agent, text); };

  const box = st?.box;
  const verify = st?.inbox.find((m) => m.kind === "forward_verify" && !m.read);
  const list = tab === "in" ? st?.inbox ?? [] : st?.sent ?? [];
  const title = view.kind === "setup" ? "Forwarding" : `${name}'s email`;
  return (
    <Sheet label="mailbox" title={title} sub={box ? <span className="flex items-center gap-1.5"><span data-mail-address className="truncate font-mono text-[12px]">{box.address}</span><button onClick={() => copy(box.address, "Address")} aria-label="Copy address" className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-tint hover:text-ink"><Icon name="copy" size={13} /></button></span> : "Loading…"}
      icon={<AgentTile id={agent} look={s?.agent?.look} size={40} status={false} />} onClose={closeMail}>
      {!st ? (err ? <p className="py-6 text-center text-[13.5px] text-ink/65">{err} <button onClick={() => void load()} className="font-bold text-brand-ink">Try again</button></p> : <div className="grid h-40 place-items-center text-ink/50"><Spinner /></div>) : view.kind === "read" ? (
        <ReadView id={view.id} name={name} onBack={() => { setView({ kind: "list" }); void load(); }} onAsk={ask} />
      ) : view.kind === "setup" ? (
        <Setup st={st} agent={agent} name={name} onBack={() => setView({ kind: "list" })} onSaved={(b) => setSt({ ...st, box: b })} copy={copy} />
      ) : (
        <div data-mail-list>
          {st.box.mode === "mock" && <p data-mail-mode="mock" className="mb-2.5 flex items-center gap-1.5 rounded-xl bg-[#fff8e6] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a00]"><span className="h-1.5 w-1.5 rounded-full bg-[#f5a524]" />Test mode: mail stays inside Lexari until email is switched on.</p>}
          <div className="flex items-center gap-2">
            <div className="inline-flex flex-1 rounded-full bg-tint p-1" role="tablist">
              {([["in", `Inbox${st.box.unread ? ` · ${st.box.unread}` : ""}`], ["out", "Sent"]] as const).map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} data-mail-tab={id} onClick={() => setTab(id)} className={`h-8 flex-1 rounded-full text-[12.5px] font-bold transition ${tab === id ? "bg-card text-ink shadow-sm" : "text-ink/60"}`}>{l}</button>)}
            </div>
            <button onClick={() => setView({ kind: "setup" })} aria-label="Forwarding and sending" title="Forwarding and sending" data-mail-setup className={iconBtn}><Icon name="forward" size={16} /></button>
            {st.box.mode === "mock" && <button onClick={() => void test("mail")} disabled={!!busy} aria-label="Add a test email" title="Add a test email" data-mail-test className={iconBtn}>{busy === "mail" ? <Spinner /> : <Icon name="inbox" size={16} />}</button>}
          </div>
          {verify?.verify && tab === "in" && <VerifyCard m={verify} copy={copy} onOpen={() => setView({ kind: "read", id: verify.id })} />}
          {list.length === 0 ? (
            <div className="py-8 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-tint text-ink/50"><Icon name={tab === "in" ? "inbox" : "send"} size={22} /></span>
              <p className="mt-2 text-[13px] text-ink/60">{tab === "in" ? `Nothing yet. Forward mail to ${name}, or anyone can write to the address above.` : `Ask ${name} to write an email. You approve every one before it goes.`}</p>
              {tab === "in" && <button onClick={() => setView({ kind: "setup" })} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-grape px-3.5 text-[12.5px] font-bold text-white"><Icon name="forward" size={14} />Set up forwarding</button>}
            </div>
          ) : (
            <ul className="mt-2.5 divide-y divide-[var(--line)] overflow-hidden rounded-[18px] bg-card ring-1 ring-line">
              {list.map((m) => (
                <li key={m.id}>
                  <button data-mail-item={m.id} onClick={() => setView({ kind: "read", id: m.id })} className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-tint/60">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold ${m.kind === "forward_verify" ? "bg-[#1a73e8] text-white" : m.read ? "bg-tint text-ink/60" : "bg-grape text-white"}`}>{m.kind === "forward_verify" ? <Icon name="forward" size={14} /> : initial(m)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2"><span className={`min-w-0 flex-1 truncate text-[13.5px] ${m.read ? "font-semibold text-ink/80" : "font-bold text-ink"}`}>{m.dir === "out" ? `To ${m.to.join(", ")}` : m.fromName || m.from}</span><span className="shrink-0 text-[11px] text-ink/45">{when(m.at)}</span></span>
                      <span className={`block truncate text-[12.5px] ${m.read ? "text-ink/65" : "font-semibold text-ink"}`}>{m.subject || "(no subject)"}</span>
                      <span className="block truncate text-[11.5px] text-ink/45">{m.status === "draft" ? "Draft · waiting for you in chat" : m.status === "failed" ? "Failed to send" : m.snippet}</span>
                    </span>
                    {!m.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-grape" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {st.inbox.length > 0 && tab === "in" && (
            <button data-mail-summarize onClick={() => ask("Summarize my inbox: what's new, what needs a reply, and anything urgent.")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-tint py-2.5 text-[13px] font-bold text-brand-ink transition hover:bg-grape hover:text-white"><Icon name="spark" size={15} />Ask {name} to summarize</button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function VerifyCard({ m, copy, onOpen }: { m: MailItem; copy: (t: string, w: string) => void; onOpen: () => void }) {
  const v = m.verify!;
  return (
    <div data-forward-verify className="pop mt-2.5 rounded-[18px] bg-[#1a73e8]/10 p-3 ring-1 ring-[#1a73e8]/35">
      <button onClick={onOpen} className="block w-full text-left">
        <p className="text-[13.5px] font-bold text-ink">{v.service} wants to confirm forwarding</p>
        <p className="mt-0.5 text-[12px] leading-snug text-ink/65">{v.for ? `${v.for} asked to forward mail here. ` : ""}Confirm it in {v.service} to start forwarding.</p>
      </button>
      <div className="mt-2.5 flex items-center gap-2">
        {v.code && <button data-verify-code={v.code} onClick={() => copy(v.code!, "Code")} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-card font-mono text-[13px] font-bold text-ink ring-1 ring-line"><Icon name="copy" size={13} />{v.code}</button>}
        {v.link && <a href={v.link} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#1a73e8] px-3 text-[13px] font-bold text-white">Confirm<Icon name="arrow" size={13} /></a>}
      </div>
    </div>
  );
}

function ReadView({ id, name, onBack, onAsk }: { id: string; name: string; onBack: () => void; onAsk: (t: string) => void }) {
  const [m, setM] = useState<Awaited<ReturnType<typeof readMail>> | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { readMail(id).then(setM, (e) => setErr(friendly(e, "Couldn't open that email."))); }, [id]);
  return (
    <div data-mail-read={id}>
      <button onClick={onBack} className="mb-2 inline-flex h-8 items-center gap-1 rounded-full pr-2 text-[12.5px] font-bold text-ink/70 hover:text-ink"><Icon name="back" size={15} />Back</button>
      {!m ? (err ? <p className="text-[13px] text-ink/65">{err}</p> : <div className="grid h-32 place-items-center text-ink/50"><Spinner /></div>) : (
        <>
          <h3 className="text-[16px] font-bold leading-snug text-ink">{m.subject || "(no subject)"}</h3>
          <dl className="mt-2 space-y-0.5 text-[12px]">
            <div className="flex gap-2"><dt className="w-10 shrink-0 text-ink/45">From</dt><dd className="min-w-0 break-all text-ink/80">{m.fromName ? `${m.fromName} <${m.from}>` : m.from}</dd></div>
            <div className="flex gap-2"><dt className="w-10 shrink-0 text-ink/45">To</dt><dd className="min-w-0 break-all text-ink/80">{m.to.join(", ")}</dd></div>
            <div className="flex gap-2"><dt className="w-10 shrink-0 text-ink/45">Date</dt><dd className="text-ink/80">{new Date(m.at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</dd></div>
          </dl>
          <div className="mt-3 max-h-[42dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-[16px] bg-tint/60 p-3 text-[13px] leading-relaxed text-ink/85">{m.text || "(no text)"}</div>
          {m.dir === "in" && m.kind === "mail" && (
            <div className="mt-3 flex gap-2">
              <button data-mail-ask="summarize" onClick={() => onAsk(`Summarize the email "${m.subject}" from ${m.fromName || m.from} (id ${m.id.slice(0, 8)}) and tell me what I need to do.`)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-tint text-[13px] font-bold text-ink transition hover:bg-grape hover:text-white"><Icon name="spark" size={15} />Summarize</button>
              <button data-mail-ask="reply" onClick={() => onAsk(`Draft a reply to the email "${m.subject}" from ${m.fromName || m.from} (id ${m.id.slice(0, 8)}).`)} className="btn btn-brand btn-sm !h-10 flex-1 gap-1.5"><Icon name="reply" size={15} />Reply with {name}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Setup({ st, agent, name, onBack, onSaved, copy }: { st: MailState; agent: string; name: string; onBack: () => void; onSaved: (b: MailState["box"]) => void; copy: (t: string, w: string) => void }) {
  const [you, setYou] = useState(st.box.replyTo || "");
  const [mode, setMode] = useState(st.box.senderMode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [how, setHow] = useState<"gmail" | "outlook">("gmail");
  const dirty = you.trim() !== (st.box.replyTo || "") || mode !== st.box.senderMode;
  const save = async () => {
    setBusy(true); setErr("");
    try { onSaved(await saveMailbox(agent, { replyTo: you.trim() || null, senderMode: mode })); toast({ text: "Saved" }); }
    catch (e) { setErr(friendly(e, "Couldn't save. Try again.")); }
    finally { setBusy(false); }
  };
  const steps = how === "gmail"
    ? ["Gmail on the web: Settings (gear) → See all settings → Forwarding and POP/IMAP.", "Add a forwarding address and paste the address above.", `Gmail sends a confirmation to ${name}. It shows up in this inbox with a code and a Confirm button.`, "Confirm, then pick Forward a copy of incoming mail to it (or a filter for just some mail)."]
    : ["Outlook on the web: Settings → Mail → Forwarding.", "Turn on Enable forwarding and paste the address above.", "Tick Keep a copy of forwarded messages, then Save. No code needed.", "Work accounts may need IT to allow forwarding outside the company."];
  return (
    <div data-mail-setup-view>
      <button onClick={onBack} className="mb-2 inline-flex h-8 items-center gap-1 rounded-full pr-2 text-[12.5px] font-bold text-ink/70 hover:text-ink"><Icon name="back" size={15} />Inbox</button>
      <button onClick={() => copy(st.box.address, "Address")} className="flex w-full items-center gap-2 rounded-[16px] bg-grape/10 px-3 py-2.5 text-left ring-1 ring-grape/30"><Icon name="mail" size={16} className="shrink-0 text-brand-ink" /><span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold text-ink">{st.box.address}</span><Icon name="copy" size={14} className="shrink-0 text-ink/55" /></button>
      <div className="mt-3 inline-flex w-full rounded-full bg-tint p-1" role="tablist">
        {([["gmail", "Gmail"], ["outlook", "Outlook"]] as const).map(([id, l]) => <button key={id} role="tab" aria-selected={how === id} onClick={() => setHow(id)} className={`h-8 flex-1 rounded-full text-[12.5px] font-bold transition ${how === id ? "bg-card text-ink shadow-sm" : "text-ink/60"}`}>{l}</button>)}
      </div>
      <ol className="mt-2.5 space-y-1.5">{steps.map((t, i) => <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-ink/75"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-tint text-[10.5px] font-bold text-ink">{i + 1}</span>{t}</li>)}</ol>
      <h4 className="label mt-4 text-[9px] text-ink/50">Sending</h4>
      <label className="mt-1.5 block"><span className="text-[12px] font-semibold text-ink/70">Your email</span><input data-reply-to value={you} onChange={(e) => setYou(e.target.value.slice(0, 254))} type="email" inputMode="email" autoCapitalize="off" placeholder="you@gmail.com" className="field mt-1 !py-2.5 !text-[14px]" /></label>
      <div className="mt-2.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Send as">
        {([["agent", name, "From the agent"], ["user", "You via Lexari", "Replies come to you"]] as const).map(([id, t, d]) => (
          <button key={id} role="radio" aria-checked={mode === id} data-sender-mode={id} onClick={() => setMode(id)} className={`rounded-[16px] p-2.5 text-left transition ${mode === id ? "bg-grape/12 ring-2 ring-grape" : "bg-card ring-1 ring-line"}`}>
            <span className="block truncate text-[13px] font-bold text-ink">{t}</span><span className="block text-[11.5px] text-ink/55">{d}</span>
          </button>
        ))}
      </div>
      {err && <p role="alert" className="mt-2.5 text-[12.5px] text-[#e5484d]">{err}</p>}
      <button data-mail-save onClick={() => void save()} disabled={!dirty || busy} className="btn btn-brand mt-3 !h-10 w-full disabled:opacity-45 disabled:shadow-none">{busy ? <Spinner /> : "Save"}</button>
      {st.box.mode === "mock" && <button onClick={() => void testMail(agent, "gmail_verify").then(onBack)} data-mail-test-verify className="mt-2 w-full text-center text-[12px] font-bold text-brand-ink">Try a Gmail confirmation (test)</button>}
    </div>
  );
}
