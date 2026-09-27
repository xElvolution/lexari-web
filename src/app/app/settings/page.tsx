"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_ADDRESS, DEMO_GOOGLE, LOOKS, TONES, shortAddr } from "@/content/appData";
import {
  agentName, clearChats, exportData, setActive, linkMethod, planOf, release, resetAll, setNotif, setPrefs, signOut, toast, updateAgent, useApp, type State,
} from "@/lib/store";
import Icon from "@/components/app/Icon";
import { AgentFace, AgentTile } from "@/components/app/faces";
import { DemoTag } from "@/components/app/ui";
import { myAgents } from "@/components/app/agents";

const SECTIONS = [
  { id: "general", label: "General", icon: "settings" },
  { id: "personal", label: "Personalization", icon: "spark" },
  { id: "agents", label: "Agents", icon: "team" },
  { id: "notifications", label: "Notifications", icon: "chat" },
  { id: "data", label: "Data controls", icon: "folder" },
  { id: "security", label: "Security", icon: "pin" },
  { id: "accounts", label: "Connected accounts", icon: "globe" },
  { id: "billing", label: "Billing & cards", icon: "wallet" },
  { id: "about", label: "About", icon: "list" },
] as const;
type Sec = (typeof SECTIONS)[number]["id"];
type Theme = "light" | "dark" | "system";

/* ---------- building blocks ---------- */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-grape" : "bg-ink/20"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} /></button>;
}
function Select({ value, options, onChange, label }: { value: string; options: (string | [string, string])[]; onChange: (v: string) => void; label: string }) {
  return (
    <span className="relative inline-flex">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-10 appearance-none rounded-full bg-tint pl-4 pr-9 text-[14px] font-semibold text-ink outline-none ring-grape focus:ring-2">
        {options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}
      </select>
      <Icon name="right" size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-ink/60" />
    </span>
  );
}
function Row({ title, desc, children, danger = false }: { title: string; desc?: React.ReactNode; children?: React.ReactNode; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1"><div className={`text-[15px] font-semibold ${danger ? "text-[#e5484d]" : "text-ink"}`}>{title}</div>{desc && <div className="mt-0.5 text-[13.5px] leading-snug text-ink/60">{desc}</div>}</div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return <section className="mt-6 first:mt-0">{title && <h3 className="label mb-1 text-[9.5px] text-ink/50">{title}</h3>}<div className="divide-y divide-[var(--line)] rounded-[22px] bg-card px-5 ring-1 ring-line">{children}</div></section>;
}
const smallBtn = "inline-flex h-10 items-center gap-2 rounded-full bg-tint px-4 text-[14px] font-semibold text-ink transition hover:bg-grape hover:text-white";
const dangerBtn = "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-[#e5484d] ring-1 ring-[#e5484d]/40 transition hover:bg-[#e5484d] hover:text-white";

/* ---------- sections ---------- */
function General({ s }: { s: State }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => { const t = localStorage.getItem("lexari-theme"); setTheme(t === "light" || t === "dark" ? t : "system"); }, []);
  const applyTheme = (t: Theme) => {
    setTheme(t);
    const v = t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
    document.documentElement.setAttribute("data-theme", v);
    try { if (t === "system") localStorage.removeItem("lexari-theme"); else localStorage.setItem("lexari-theme", t); } catch {}
  };
  const p = s.prefs;
  return (
    <>
      <Group title="Appearance">
        <Row title="Theme" desc="Light, dark, or follow your device.">
          <div className="inline-flex rounded-full bg-tint p-1" role="radiogroup" aria-label="Theme">
            {([["light", "sun", "Light"], ["dark", "moon", "Dark"], ["system", "laptop", "System"]] as const).map(([id, ic, l]) => (
              <button key={id} role="radio" aria-checked={theme === id} onClick={() => applyTheme(id)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition ${theme === id ? "bg-card text-ink shadow-sm" : "text-ink/60 hover:text-ink"}`}><Icon name={ic} size={14} />{l}</button>
            ))}
          </div>
        </Row>
        <Row title="Animations" desc="Smooth motion across the app. Turn off for a calmer screen."><Toggle on={p.motion} onChange={(v) => setPrefs({ motion: v })} label="Animations" /></Row>
        <Row title="Show demo labels" desc="Keep the small “Demo” tags visible on sample data."><Toggle on={p.demoLabels} onChange={(v) => setPrefs({ demoLabels: v })} label="Show demo labels" /></Row>
      </Group>
      <Group title="Language and voice">
        <Row title="Language" desc="Used for the app and your agents' replies."><Select label="Language" value={p.language} options={["English", "Français", "Español", "Português", "Deutsch", "Yorùbá", "Hausa", "Igbo"]} onChange={(v) => setPrefs({ language: v })} /></Row>
        <Row title="Voice" desc="How agents sound on calls and in voice notes.">
          <Select label="Voice" value={p.voice} options={["Iris", "Nova", "Orbit", "Ember", "Sage"]} onChange={(v) => setPrefs({ voice: v })} />
          <button onClick={() => toast({ text: `Playing a sample of ${p.voice} (demo, no audio)` })} className={smallBtn}><Icon name="play" size={13} />Play</button>
        </Row>
      </Group>
      <Group title="Chats">
        <Row title="Default agent" desc="Who opens first on the Agents page."><Select label="Default agent" value={p.defaultAgent} options={myAgents(s).map((a) => [a.id, a.name] as [string, string])} onChange={(v) => { setPrefs({ defaultAgent: v }); setActive(v); }} /></Row>
        <Row title="Send with Enter" desc="Shift+Enter always adds a new line."><Toggle on onChange={() => toast({ text: "Enter to send is always on in the demo" })} label="Send with Enter" /></Row>
      </Group>
    </>
  );
}

function Personal({ s }: { s: State }) {
  const a = s.agent!;
  const [name, setName] = useState(a.name);
  const [you, setYou] = useState(a.you);
  const [ins, setIns] = useState(s.prefs.instructions);
  const dirty = name.trim() !== a.name || you.trim() !== a.you;
  return (
    <>
      <Group title="Your agent">
        <div className="flex flex-col gap-5 py-5 sm:flex-row sm:items-center">
          <span className="grid h-24 w-24 shrink-0 place-items-center rounded-[26px] bg-grape"><AgentFace look={a.look} size={78} /></span>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <label><span className="label text-[9.5px] text-ink/60">Agent name</span><input value={name} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 12))} className="field mt-1.5 !py-2.5" /></label>
            <label><span className="label text-[9.5px] text-ink/60">It calls you</span><input value={you} onChange={(e) => setYou(e.target.value.slice(0, 20))} className="field mt-1.5 !py-2.5" placeholder="Ada" /></label>
            <div className="sm:col-span-2"><button disabled={!dirty || !name.trim()} onClick={() => { updateAgent({ name: name.trim(), you: you.trim() }); toast({ text: "Saved", face: "home" }); }} className="btn btn-brand btn-sm !h-10 disabled:opacity-40 disabled:shadow-none">Save</button></div>
          </div>
        </div>
        <Row title="Face" desc="Pick a different generated face. It changes everywhere." />
        <div className="grid grid-cols-6 gap-2 pb-5 sm:grid-cols-12">
          {LOOKS.map((l) => { const on = a.look === l; return <button key={String(l)} onClick={() => updateAgent({ look: l })} aria-pressed={on} aria-label={l === null ? "House face" : `Face ${l}`} className={`grid aspect-square place-items-center rounded-2xl transition ${on ? "bg-grape ring-2 ring-grape ring-offset-2 ring-offset-[var(--card)]" : "bg-tint hover:bg-lilac/40"}`}><AgentFace look={l} size={36} /></button>; })}
        </div>
        <Row title="Tone" desc={`How ${agentName(s)} talks to you.`}>
          <Select label="Tone" value={a.tone} options={TONES.map((t) => [t.id, t.label] as [string, string])} onChange={(v) => updateAgent({ tone: v as typeof a.tone })} />
        </Row>
      </Group>
      <Group title="Custom instructions">
        <div className="py-4">
          <p className="text-[13.5px] text-ink/60">Anything every agent should know or do, every time.</p>
          <textarea value={ins} onChange={(e) => setIns(e.target.value.slice(0, 600))} rows={4} placeholder="e.g. Keep answers short. I work from Lagos, so use WAT for times." className="field mt-3 resize-none !text-[15px] !font-medium" />
          <div className="mt-2 flex items-center justify-between"><span className="text-[12px] text-ink/45">{ins.length}/600</span><button disabled={ins === s.prefs.instructions} onClick={() => { setPrefs({ instructions: ins }); toast({ text: "Instructions saved" }); }} className="btn btn-brand btn-sm !h-10 disabled:opacity-40 disabled:shadow-none">Save</button></div>
        </div>
      </Group>
      <Group title="Memory">
        <Row title="Memory" desc="Let agents remember useful things about you between chats."><Toggle on={s.prefs.memory} onChange={(v) => { setPrefs({ memory: v }); toast({ text: v ? "Memory is on" : "Memory is off. Nothing new will be saved." }); }} label="Memory" /></Row>
        <Row title="Manage memory" desc={`${s.memory.length} things remembered. See, edit or forget any of them.`}><Link href="/app/memory" className={smallBtn}>Open brain</Link></Row>
        <Row title="Replay onboarding" desc="Walk through naming and setup again."><Link href="/onboarding" className={smallBtn}>Replay</Link></Row>
      </Group>
    </>
  );
}

function Agents({ s }: { s: State }) {
  const p = planOf(s);
  return (
    <>
      <Group title={`Your team · ${1 + s.hired.length} of ${p.seats} seats`}>
        {myAgents(s).map((a) => (
          <div key={a.id} className="flex items-center gap-3 py-3.5">
            <AgentTile id={a.id} look={s.agent?.look} size={44} />
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold text-ink">{a.name}</span>{s.prefs.defaultAgent === a.id && <span className="label rounded-full bg-tint px-1.5 py-0.5 text-[8px] text-brand-ink">Default</span>}</div><div className="truncate text-[13px] text-ink/55">{a.role} · seat {String(a.seat).padStart(2, "0")}{s.wallets[a.id] ? " · wallet" : ""}{s.cards[a.id] ? " · card" : ""}</div></div>
            <Link href={`/app?c=${a.id}`} className={smallBtn}>Chat</Link>
            {a.id !== "home" && <button onClick={() => { if (confirm(`Release ${a.name} from seat ${a.seat}?`)) { release(a.id); toast({ text: `${a.name} left the team` }); } }} className="hidden h-10 rounded-full px-3 text-[13.5px] font-semibold text-ink/55 hover:text-ink sm:inline-flex sm:items-center">Release</button>}
          </div>
        ))}
      </Group>
      <Group>
        <Row title="Hire more agents" desc="Browse specialists in the marketplace."><Link href="/app/marketplace" className={smallBtn}>Marketplace</Link></Row>
        <Row title="Seats and plan" desc="Seats decide how many agents you can have."><Link href="/app/team" className={smallBtn}>Team</Link></Row>
      </Group>
    </>
  );
}

const NOTIFS: [string, string, string][] = [
  ["replies", "Agent replies", "When an agent answers you and you're not looking."],
  ["groups", "Group mentions", "When someone names you or asks you in a group."],
  ["calls", "Missed calls", "When an agent tried to reach you."],
  ["wallet", "Wallet activity", "Money in or out of an agent's wallet."],
  ["cards", "Card purchases", "Every purchase an agent makes with its card."],
  ["digest", "Weekly email digest", "A short summary of what your team did."],
  ["product", "Product news", "New features and agents. Rarely."],
];
function Notifications({ s }: { s: State }) {
  return (
    <>
      <Group title="Push and in-app">{NOTIFS.slice(0, 5).map(([k, t, d]) => <Row key={k} title={t} desc={d}><Toggle on={!!s.prefs.notif[k]} onChange={(v) => setNotif(k, v)} label={t} /></Row>)}</Group>
      <Group title="Email">{NOTIFS.slice(5).map(([k, t, d]) => <Row key={k} title={t} desc={d}><Toggle on={!!s.prefs.notif[k]} onChange={(v) => setNotif(k, v)} label={t} /></Row>)}</Group>
    </>
  );
}

function Data({ s }: { s: State }) {
  const router = useRouter();
  const [del, setDel] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <>
      <Group title="History">
        <Row title="Save chat history" desc="Keep your chats so you can come back to them."><Toggle on={s.prefs.history} onChange={(v) => setPrefs({ history: v })} label="Save chat history" /></Row>
        <Row title="Help improve Lexari" desc="Share anonymous usage to make agents better. Off by default."><Toggle on={s.prefs.improve} onChange={(v) => setPrefs({ improve: v })} label="Help improve Lexari" /></Row>
      </Group>
      <Group title="Your data">
        <Row title="Export data" desc="Download everything in this demo as a JSON file."><button onClick={() => { exportData(); toast({ text: "Export downloaded" }); }} className={smallBtn}><Icon name="download" size={15} />Export</button></Row>
        <Row title="Clear all chats" desc="Removes every message. Agents and memory stay."><button onClick={() => { if (confirm("Clear every chat?")) { clearChats(); toast({ text: "All chats cleared" }); } }} className={smallBtn}>Clear</button></Row>
        <Row title="Reset demo data" desc="Start the demo again from scratch."><button onClick={() => { if (confirm("Reset all demo data in this browser?")) { resetAll(); router.push("/"); } }} className={smallBtn}><Icon name="undo" size={15} />Reset</button></Row>
      </Group>
      <Group title="Danger zone">
        <Row danger title="Delete account" desc="Permanently removes your account, agents, wallets and cards.">{!del && <button onClick={() => setDel(true)} className={dangerBtn}><Icon name="trash" size={15} />Delete</button>}</Row>
        {del && (
          <div className="pb-5">
            <p className="text-[13.5px] text-ink/70">Type <b className="font-mono">DELETE</b> to confirm. In this demo it only wipes data saved in this browser.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type DELETE" className="field !w-48 !py-2" />
              <button disabled={typed !== "DELETE"} onClick={() => { resetAll(); router.push("/"); }} className="inline-flex h-11 items-center rounded-full bg-[#e5484d] px-4 text-[14px] font-bold text-white disabled:opacity-40">Delete account</button>
              <button onClick={() => { setDel(false); setTyped(""); }} className={smallBtn}>Cancel</button>
            </div>
          </div>
        )}
      </Group>
    </>
  );
}

const SESSIONS = [
  { id: "this", device: "Chrome on Linux", where: "Lagos, NG", when: "Active now", icon: "laptop", current: true },
  { id: "phone", device: "Safari on iPhone", where: "Lagos, NG", when: "2 hours ago", icon: "phone" },
  { id: "tab", device: "Firefox on Windows", where: "Abuja, NG", when: "3 days ago", icon: "laptop" },
];
function Security({ s }: { s: State }) {
  const [setup, setSetup] = useState(false);
  const live = SESSIONS.filter((x) => !s.prefs.signedOut.includes(x.id));
  return (
    <>
      <Group title="Sign-in protection">
        <Row title="Two-step verification" desc={s.prefs.twofa ? "On. You'll enter a code from your authenticator app." : "Add a code from an authenticator app when you sign in."}>
          <Toggle on={s.prefs.twofa} onChange={(v) => { if (v) setSetup(true); else { setPrefs({ twofa: false }); toast({ text: "Two-step verification is off" }); } }} label="Two-step verification" />
        </Row>
        {setup && !s.prefs.twofa && (
          <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-center">
            <div className="grid h-28 w-28 shrink-0 grid-cols-7 gap-0.5 rounded-xl bg-white p-2" aria-label="Setup code (demo)">{Array.from({ length: 49 }).map((_, i) => <i key={i} className={((i * 7919) % 11) % 3 === 0 || [0, 1, 7, 8, 5, 6, 12, 13, 35, 36, 42, 43].includes(i) ? "bg-[#0a0a0a]" : ""} />)}</div>
            <div className="text-[13.5px] text-ink/70"><p>Scan this with your authenticator app, or enter <b className="font-mono text-ink">LXRI 4F2K 9QZD</b>. Demo code, not a real secret.</p>
              <div className="mt-3 flex gap-2"><button onClick={() => { setPrefs({ twofa: true }); setSetup(false); toast({ text: "Two-step verification is on (demo)" }); }} className="btn btn-brand btn-sm !h-10">I've added it</button><button onClick={() => setSetup(false)} className={smallBtn}>Cancel</button></div></div>
          </div>
        )}
        <Row title="Passkeys" desc="Sign in with your fingerprint, face or device PIN."><button onClick={() => toast({ text: "Passkeys are coming soon (demo)" })} className={smallBtn}><Icon name="plus" size={15} />Add passkey</button></Row>
      </Group>
      <Group title="Active sessions">
        {live.map((x) => (
          <div key={x.id} className="flex items-center gap-3 py-3.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-tint text-ink/75"><Icon name={x.icon} size={18} /></span>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[15px] font-semibold text-ink">{x.device}{x.current && <span className="label rounded-full bg-grape px-1.5 py-0.5 text-[8px] text-white">This device</span>}</div><div className="text-[13px] text-ink/55">{x.where} · {x.when}</div></div>
            {!x.current && <button onClick={() => { setPrefs({ signedOut: [...s.prefs.signedOut, x.id] }); toast({ text: `Signed out of ${x.device}` }); }} className={smallBtn}>Sign out</button>}
          </div>
        ))}
        {live.length > 1 && <Row title="Sign out everywhere else" desc="Ends every session except this one."><button onClick={() => { setPrefs({ signedOut: SESSIONS.filter((x) => !x.current).map((x) => x.id) }); toast({ text: "Signed out of other sessions" }); }} className={dangerBtn}>Sign out all</button></Row>}
      </Group>
    </>
  );
}

function Accounts({ s }: { s: State }) {
  const methods = [
    { id: "google" as const, icon: "google", title: "Google", sub: s.links.google ? DEMO_GOOGLE.email : "Not connected" },
    { id: "wallet" as const, icon: "wallet", title: "Crypto wallet sign-in", sub: s.links.wallet ? `${shortAddr(DEMO_ADDRESS)} · ${s.auth?.method === "wallet" ? s.auth.sub : "OKX Wallet (placeholder)"}` : "Not connected. OKX Wallet is one option (placeholder)." },
  ];
  return (
    <Group title="Sign in with">
      {methods.map((m) => { const on = s.links[m.id]; const inUse = s.auth?.method === m.id; return (
        <div key={m.id} className="flex items-center gap-3 py-4">
          <span className={`grid h-11 w-11 place-items-center rounded-2xl ${on ? "bg-ink text-[var(--bg)]" : "bg-tint text-ink"}`}><Icon name={m.icon} size={20} /></span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[15px] font-semibold text-ink">{m.title}{inUse && <span className="label rounded-full bg-grape px-1.5 py-0.5 text-[8px] text-white">Signed in</span>}</div><div className="truncate text-[13px] text-ink/55">{m.sub}</div></div>
          {inUse ? <span className="text-[13px] font-semibold text-ink/50">In use</span> : <button onClick={() => { linkMethod(m.id, !on); toast({ text: on ? `${m.title} disconnected` : `${m.title} connected (demo)` }); }} className={on ? dangerBtn : smallBtn}>{on ? "Disconnect" : "Connect"}</button>}
        </div>
      ); })}
    </Group>
  );
}

function Billing({ s }: { s: State }) {
  const p = planOf(s); const cards = Object.keys(s.cards).length;
  return (
    <>
      <Group title="Plan">
        <div className="flex flex-wrap items-center gap-5 py-5">
          <div><span className="label text-[9px] text-ink/55">Current plan</span><div className="display mt-1 text-[36px] leading-none text-ink">{p.name}</div></div>
          <div className="min-w-[180px] flex-1"><div className="flex flex-wrap gap-1">{Array.from({ length: Math.min(p.seats, 20) }).map((_, i) => <i key={i} className={`h-3.5 w-3.5 rounded-[4px] ${i === 0 ? "bg-grape" : i <= s.hired.length ? "bg-lilac" : "border-2 border-dashed border-ink/25"}`} />)}</div><p className="mt-2 text-[13.5px] text-ink/60">{1 + s.hired.length} of {p.seats} seats filled</p></div>
          <Link href="/app/team" className={smallBtn}>Change plan</Link>
        </div>
      </Group>
      <Group title="Agent cards">
        <Row title="Virtual cards" desc={cards ? `${cards} agent card${cards > 1 ? "s" : ""} active. Freeze, reveal or set limits from Cards.` : "No agent has a card yet. Each card has a one-time fee (demo)."}><Link href="/app/wallets?tab=cards" className={smallBtn}>{cards ? "Manage cards" : "Get a card"}</Link></Row>
        <Row title="Wallets" desc={`${Object.keys(s.wallets).length} agent wallet${Object.keys(s.wallets).length === 1 ? "" : "s"}.`}><Link href="/app/wallets" className={smallBtn}>Open wallets</Link></Row>
      </Group>
      <Group title="Invoices">
        <Row title="No invoices" desc="The demo never charges anything, so there's nothing here." />
      </Group>
    </>
  );
}

function About() {
  const router = useRouter();
  return (
    <>
      <Group>
        <Row title="Version" desc="Lexari web · demo build"><span className="font-mono text-[13px] text-ink/60">0.3.0-demo</span></Row>
        <Row title="Sample data" desc="Everything you see runs on example data saved in this browser only. Nothing is live."><DemoTag /></Row>
      </Group>
      <Group title="Legal">
        <Row title="Terms of use"><Link href="/legal/terms" className={smallBtn}>Read</Link></Row>
        <Row title="Privacy policy"><Link href="/legal/privacy" className={smallBtn}>Read</Link></Row>
      </Group>
      <Group>
        <Row title="Sign out" desc="You can sign back in with Google or a wallet."><button onClick={() => { signOut(); router.push("/signin"); }} className={smallBtn}><Icon name="out" size={15} />Sign out</button></Row>
      </Group>
    </>
  );
}

export default function SettingsPage() {
  const s = useApp()!;
  const [sec, setSec] = useState<Sec>("general");
  const [open, setOpen] = useState(false); // phones: list first, then a section
  useEffect(() => { const h = window.location.hash.slice(1) as Sec; if (SECTIONS.some((x) => x.id === h)) { setSec(h); setOpen(true); } }, []);
  const pick = (id: Sec) => { setSec(id); setOpen(true); window.history.replaceState(null, "", `#${id}`); window.scrollTo({ top: 0 }); };
  const cur = SECTIONS.find((x) => x.id === sec)!;
  const body = { general: <General s={s} />, personal: <Personal s={s} />, agents: <Agents s={s} />, notifications: <Notifications s={s} />, data: <Data s={s} />, security: <Security s={s} />, accounts: <Accounts s={s} />, billing: <Billing s={s} />, about: <About /> }[sec];

  return (
    <div data-rise className="grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-10">
      <aside className={`${open ? "hidden lg:block" : ""}`}>
        <h1 className="display text-[44px] text-ink">Settings</h1>
        <nav className="mt-5 grid gap-0.5" aria-label="Settings sections">
          {SECTIONS.map((x) => (
            <button key={x.id} onClick={() => pick(x.id)} aria-current={sec === x.id ? "page" : undefined} className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-[15px] font-semibold transition ${sec === x.id ? "lg:bg-card lg:text-ink lg:shadow-[0_0_0_1px_var(--line)]" : ""} text-ink/75 hover:bg-tint hover:text-ink`}>
              <Icon name={x.icon} size={18} className={sec === x.id ? "lg:text-brand-ink" : ""} />{x.label}<Icon name="right" size={16} className="ml-auto text-ink/35 lg:hidden" />
            </button>
          ))}
        </nav>
      </aside>
      <main className={`min-w-0 ${open ? "" : "hidden lg:block"}`}>
        <div className="mb-5 flex items-center gap-2">
          <button onClick={() => setOpen(false)} aria-label="All settings" className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-tint lg:hidden"><Icon name="back" size={19} /></button>
          <h2 className="display text-[34px] text-ink lg:text-[40px]">{cur.label}</h2>
        </div>
        <div className="max-w-[760px]">{body}</div>
      </main>
    </div>
  );
}
