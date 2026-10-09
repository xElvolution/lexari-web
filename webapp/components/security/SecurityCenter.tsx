"use client";

import { useCallback, useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import { setHideBalance, useHideBalance, useMask } from "@/lib/privacy";
import { toast } from "@/lib/store";
import Icon from "../Icon";
import { PhraseBadge, phraseChanged } from "./PhraseBadge";

type Sess = { id: string; device: string; network: string; createdAt: number; lastSeenAt: number; current: boolean };
type Addr = { id: string; chain: string; address: string; label: string; at: number };
type Ev = { id: string; kind: string; detail: string; device: string; at: number };
type Data = {
  settings: { phrase: string; dailySendCapUsd: number; allowlistOnly: boolean };
  sessions: Sess[]; addresses: Addr[]; events: Ev[]; movedTodayMicros: number; pin: boolean;
  stepup: { until: number; sendUsd: number }; limits: { defaultCapUsd: number; maxCapUsd: number };
};

const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60_000); return m < 2 ? "Active now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-5)}`;
const CAPS = [0, 25, 100, 250, 1000];
const EV_ICON: Record<string, string> = { signin: "key", signout: "out", stepup: "lock", settings: "settings", address: "pin", send: "send", card: "file", email: "mail", budget: "wallet", integration: "plug" };

function Group({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section id={id} className="mt-6 first:mt-0"><h3 className="label mb-1 text-[9.5px] text-ink/50">{title}</h3><div className="divide-y divide-[var(--line)] rounded-[22px] bg-card px-5 ring-1 ring-line max-[430px]:px-4">{children}</div></section>;
}
function Row({ title, desc, children }: { title: React.ReactNode; desc?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1"><div className="text-[15px] font-semibold text-ink">{title}</div>{desc && <div className="mt-0.5 text-[13.5px] leading-snug text-ink/60">{desc}</div>}</div>
      {children && <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-grape" : "bg-ink/20"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} /></button>;
}
const smallBtn = "inline-flex h-10 items-center gap-2 rounded-full bg-tint px-4 text-[14px] font-semibold text-ink transition hover:bg-grape hover:text-white disabled:opacity-50";
const input = "h-11 w-full min-w-0 rounded-2xl bg-tint px-4 text-[14.5px] text-ink outline-none ring-grape placeholder:text-ink/40 focus:ring-2";

/** Settings > Security: balances privacy, anti-phishing phrase, money limits, saved addresses, devices and activity. */
export default function SecurityCenter() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api<Data>("/api/security").then((x) => { setD(x); setErr(""); }, (e) => setErr(friendly(e, "Couldn't load your security settings."))), []);
  useEffect(() => { void load(); }, [load]);
  const hide = useHideBalance();
  const mask = useMask();
  const save = async (patch: Partial<Data["settings"]>, done: string) => {
    try { const r = await api<{ settings: Data["settings"] }>("/api/security", { method: "PATCH", body: patch }); setD((x) => (x ? { ...x, settings: r.settings } : x)); toast({ text: done }); void load(); }
    catch (e) { toast({ text: friendly(e, "That didn't save.") }); }
  };
  return (
    <div data-security-center className="mt-6">
      <Group title="Privacy">
        <Row title="Hide balances" desc="Shows •••• instead of your Lexari balance, agent wallets, history and card spend, on every device. Tap the eye next to any balance to switch.">
          <Toggle on={hide} onChange={(v) => setHideBalance(v)} label="Hide balances" />
        </Row>
      </Group>

      {err && <p role="alert" className="mt-4 rounded-2xl bg-[#fde8e8] p-3 text-[13.5px] font-semibold text-[#b42318]">{err}</p>}
      {d && <>
        <Phrase d={d} save={save} />
        <Group title="Money protection">
          <Row title="Daily money limit" desc={<>The most your agents can send, pay or trade, plus wallet sends they prepare, in 24 hours. <span data-moved-today className="font-semibold text-ink/75">{mask(`$${(d.movedTodayMicros / 1e6).toFixed(2)}`)} used</span>.</>}>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Daily money limit">
              {CAPS.map((c) => <button key={c} role="radio" aria-checked={d.settings.dailySendCapUsd === c} onClick={() => d.settings.dailySendCapUsd !== c && void save({ dailySendCapUsd: c }, c === 0 ? "Agents can't move money now" : `Daily limit is $${c}`)}
                className={`h-9 rounded-full px-3.5 text-[13.5px] font-bold transition ${d.settings.dailySendCapUsd === c ? "bg-grape text-white" : "bg-tint text-ink/75 hover:text-ink"}`}>${c.toLocaleString("en-US")}</button>)}
            </div>
          </Row>
          <Row title="Saved addresses only" desc="Agents can only send to addresses in your list below. Anything else is blocked.">
            <Toggle on={d.settings.allowlistOnly} onChange={(v) => void save({ allowlistOnly: v }, v ? "Only saved addresses now" : "Any address, with a warning for new ones")} label="Saved addresses only" />
          </Row>
          <Row title="Confirm it's you" desc={<>Sends of ${d.stepup.sendUsd} or more, first-time addresses, new API keys, raising budgets or limits and changing where mail goes ask for {d.pin ? "your PIN" : "a wallet signature"} first. {d.pin ? "" : "Set an app PIN below to use a PIN instead."}</>} />
        </Group>
        <Addresses d={d} setD={setD} />
        <Sessions d={d} setD={setD} />
        <Group title="Recent security activity">
          {d.events.length ? d.events.slice(0, 8).map((e) => (
            <div key={e.id} data-sec-event={e.kind} className="flex items-center gap-3 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-ink/70"><Icon name={(EV_ICON[e.kind] || "info") as never} size={15} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{e.detail}</span><span className="block text-[12px] text-ink/50">{[e.device, ago(e.at)].filter(Boolean).join(" · ")}</span></span>
            </div>
          )) : <Row title="Nothing yet" desc="Sign-ins and security changes show here." />}
        </Group>
      </>}
      {!d && !err && <div className="mt-6 h-40 animate-pulse rounded-[22px] bg-tint" />}
    </div>
  );
}

function Phrase({ d, save }: { d: Data; save: (p: Partial<Data["settings"]>, done: string) => Promise<void> }) {
  const [edit, setEdit] = useState(!d.settings.phrase);
  const [v, setV] = useState("");
  return (
    <Group title="Anti-phishing phrase">
      <div className="py-4">
        <p className="text-[13.5px] leading-snug text-ink/65">A few words only you know. Lexari shows them on every confirm and payment screen. If a screen asks you to confirm and your phrase isn&apos;t on it, it&apos;s not Lexari: close it.</p>
        {d.settings.phrase && !edit ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><PhraseBadge phrase={d.settings.phrase} /></div><button onClick={() => { setEdit(true); setV(""); }} className={smallBtn}><Icon name="edit" size={14} />Change</button></div>
        ) : (
          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (v.trim().length >= 3) void save({ phrase: v.trim() }, "Security phrase saved").then(() => { phraseChanged(); setEdit(false); }); }}>
            <input data-phrase-input value={v} onChange={(e) => setV(e.target.value.replace(/[<>]/g, "").slice(0, 40))} placeholder="e.g. purple mango at noon" aria-label="Security phrase" autoComplete="off" className={input} />
            <div className="flex gap-2">{d.settings.phrase && <button type="button" onClick={() => setEdit(false)} className={smallBtn}>Cancel</button>}<button type="submit" disabled={v.trim().length < 3} className={`${smallBtn} !bg-grape !text-white`}>Save</button></div>
          </form>
        )}
      </div>
    </Group>
  );
}

function Addresses({ d, setD }: { d: Data; setD: (f: (x: Data | null) => Data | null) => void }) {
  const [open, setOpen] = useState(false);
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try { const r = await api<{ addresses: Addr[] }>("/api/security/addresses", { body: { address: addr.trim(), label: label.trim() } }); setD((x) => (x ? { ...x, addresses: r.addresses } : x)); setAddr(""); setLabel(""); setOpen(false); toast({ text: "Address saved" }); }
    catch (e) { toast({ text: friendly(e, "Couldn't save that address.") }); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { const r = await api<{ addresses: Addr[] }>("/api/security/addresses", { body: { remove: id } }); setD((x) => (x ? { ...x, addresses: r.addresses } : x)); toast({ text: "Address removed" }); }
    catch (e) { toast({ text: friendly(e, "Couldn't remove it.") }); }
  };
  return (
    <Group title="Saved addresses">
      {d.addresses.map((a) => (
        <div key={a.id} data-saved-address className="flex items-center gap-3 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grape/12 text-brand-ink"><Icon name="verified" size={15} /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{a.label || "Saved address"}</span><span className="block font-mono text-[12px] text-ink/55">{short(a.address)} · {a.chain === "evm" ? "EVM" : "Solana"}</span></span>
          <button onClick={() => void remove(a.id)} aria-label={`Remove ${a.label || short(a.address)}`} className="grid h-9 w-9 place-items-center rounded-full text-ink/55 hover:bg-tint hover:text-[#e5484d]"><Icon name="trash" size={15} /></button>
        </div>
      ))}
      {open ? (
        <form className="grid gap-2 py-4" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <input value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="Solana or 0x… address" aria-label="Address" autoComplete="off" spellCheck={false} className={`${input} font-mono text-[13px]`} />
          <input value={label} onChange={(e) => setLabel(e.target.value.replace(/[<>]/g, "").slice(0, 40))} placeholder="Name (e.g. My Phantom)" aria-label="Name" autoComplete="off" className={input} />
          <p className="text-[12.5px] text-ink/55">Check every character. You&apos;ll confirm it&apos;s you before it&apos;s saved.</p>
          <div className="flex gap-2"><button type="button" onClick={() => setOpen(false)} className={smallBtn}>Cancel</button><button type="submit" disabled={busy || addr.length < 32} className={`${smallBtn} !bg-grape !text-white`}>{busy ? "Saving…" : "Save address"}</button></div>
        </form>
      ) : (
        <Row title={d.addresses.length ? `${d.addresses.length} saved` : "No saved addresses"} desc="Sends to an address that isn't here and that you've never used show a warning first.">
          <button data-add-address onClick={() => setOpen(true)} className={smallBtn}><Icon name="plus" size={15} />Add</button>
        </Row>
      )}
    </Group>
  );
}

function Sessions({ d, setD }: { d: Data; setD: (f: (x: Data | null) => Data | null) => void }) {
  const [busy, setBusy] = useState(false);
  const end = async (body: { id: string } | { others: true }) => {
    setBusy(true);
    try { const r = await api<{ ended: number; sessions: Sess[] }>("/api/security/sessions", { body }); setD((x) => (x ? { ...x, sessions: r.sessions } : x)); toast({ text: r.ended ? `Signed out ${r.ended} ${r.ended === 1 ? "device" : "devices"}` : "No other devices" }); }
    catch (e) { toast({ text: friendly(e, "Couldn't sign that out.") }); }
    finally { setBusy(false); }
  };
  const others = d.sessions.filter((x) => !x.current).length;
  return (
    <Group title="Where you're signed in">
      {d.sessions.map((x) => (
        <div key={x.id} data-session={x.current ? "current" : "other"} className="flex items-center gap-3 py-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${x.current ? "bg-grape text-white" : "bg-tint text-ink/70"}`}><Icon name={/iPhone|Android|iPad/.test(x.device) ? "phone" : "laptop"} size={15} /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{x.device}{x.current && <span className="ml-1.5 rounded-full bg-grape/12 px-2 py-0.5 text-[11px] font-bold text-brand-ink">This device</span>}</span><span className="block truncate text-[12px] text-ink/50">{[x.network && `Network ${x.network}`, x.current ? "Active now" : ago(x.lastSeenAt)].filter(Boolean).join(" · ")}</span></span>
          {!x.current && <button onClick={() => void end({ id: x.id })} disabled={busy} className="h-9 shrink-0 rounded-full px-3 text-[13px] font-bold text-[#e5484d] hover:bg-[#fde8e8] disabled:opacity-50">Sign out</button>}
        </div>
      ))}
      <Row title="Sign out everywhere else" desc={others ? `Ends ${others} other ${others === 1 ? "session" : "sessions"}. This device stays signed in.` : "You're only signed in here."}>
        <button data-signout-others onClick={() => void end({ others: true })} disabled={busy || !others} className={smallBtn}><Icon name="out" size={15} />Sign out others</button>
      </Row>
    </Group>
  );
}
