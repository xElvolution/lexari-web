"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LOOKS, TONES, shortAddr } from "@/content/appData";
import {
  agentName, clearChats, deleteAccount, exportData, setActive, setNotif, setPrefs, signOut, toast, updateAgent, useApp, type State,
} from "@/lib/store";
import { LANDING_URL, WEBAPP_URL } from "@shared/sites";
import { applyTheme, onTheme, savedTheme, watchSystemTheme } from "@shared/components/theme";
import { hirePriceLabel } from "@/lib/prices";
import Icon from "@/components/Icon";
import { AgentFace, AgentTile } from "@/components/faces";
import { myAgents } from "@/components/agents";
import { openAdd, openAgent } from "@/components/overlays";
import BillingSection from "@/components/billing/BillingSection";
import LockSettings from "@/components/lock/LockSettings";
import SocialLinks from "@/components/social/SocialLinks";
import IntegrationsSection from "@/components/integrations/IntegrationsSection";
import ModelsSection from "@/components/models/ModelsSection";
import EmailNameSetting from "@/components/email/EmailNameSetting";
import { disablePush, enablePush, pushOnHere, pushPermission } from "@/lib/notifications";

const SECTIONS = [
  { id: "general", label: "General", icon: "settings" },
  { id: "personal", label: "Personalization", icon: "spark" },
  { id: "agents", label: "Agents", icon: "team" },
  { id: "models", label: "Models", icon: "chip" },
  { id: "notifications", label: "Notifications", icon: "chat" },
  { id: "data", label: "Data controls", icon: "folder" },
  { id: "security", label: "Security", icon: "pin" },
  { id: "accounts", label: "Account", icon: "globe" },
  { id: "social", label: "Connected accounts", icon: "link" },
  { id: "integrations", label: "Integrations", icon: "plug" },
  { id: "billing", label: "Billing", icon: "wallet" },
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
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { setTheme(savedTheme()); watchSystemTheme(); return onTheme(setTheme); }, []);
  const pickTheme = (t: Theme) => { applyTheme(t); setPrefs({ theme: t }); };
  const p = s.prefs;
  return (
    <>
      <Group title="Appearance">
        <Row title="Theme" desc={theme === "system" ? "Following your device right now." : "Light, dark, or follow your device."}>
          <div className="inline-flex rounded-full bg-tint p-1" role="radiogroup" aria-label="Theme">
            {([["light", "sun", "Light"], ["dark", "moon", "Dark"], ["system", "laptop", "System"]] as const).map(([id, ic, l]) => (
              <button key={id} role="radio" aria-checked={theme === id} onClick={() => pickTheme(id)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition ${theme === id ? "bg-card text-ink shadow-sm" : "text-ink/60 hover:text-ink"}`}><Icon name={ic} size={14} />{l}</button>
            ))}
          </div>
        </Row>
        <Row title="Animations" desc="Smooth motion across the app. Turn off for a calmer screen."><Toggle on={p.motion} onChange={(v) => setPrefs({ motion: v })} label="Animations" /></Row>
      </Group>
      <Group title="Language and voice">
        <Row title="Language" desc="Used for the app and your agents' replies."><Select label="Language" value={p.language} options={["English", "Français", "Español", "Português", "Deutsch", "Yorùbá", "Hausa", "Igbo"]} onChange={(v) => setPrefs({ language: v })} /></Row>
        <Row title="Voices" desc="Each agent has its own voice for calls and Read aloud. Open an agent, tap Edit, then Voice.">
          <button onClick={() => openAgent("home")} className={smallBtn}><Icon name="speaker" size={14} />{agentName(s)}&apos;s voice</button>
        </Row>
      </Group>
      <Group title="Chats">
        <Row title="Default agent" desc="Who opens first on the Agents page."><Select label="Default agent" value={p.defaultAgent} options={myAgents(s).map((a) => [a.id, a.name] as [string, string])} onChange={(v) => { setPrefs({ defaultAgent: v }); setActive(v); }} /></Row>
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
          <span className="grid h-24 w-24 shrink-0 place-items-center rounded-[26px] bg-[var(--face-tile)] ring-1 ring-line"><AgentFace look={a.look} size={78} /></span>
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
        <Row title="Manage memory" desc={`${s.memory.length} things remembered. See, edit or forget any of them.`}><Link href="/brain" className={smallBtn}>Open brain</Link></Row>
        <Row title="Replay onboarding" desc="Walk through naming and setup again."><Link href="/onboarding" className={smallBtn}>Replay</Link></Row>
      </Group>
    </>
  );
}

function Agents({ s }: { s: State }) {
  return (
    <>
      <Group title={`Your team · ${1 + s.hired.length} agent${s.hired.length ? "s" : ""}${s.custom.length ? ` · ${s.custom.length} made by you` : ""}`}>
        {myAgents(s).map((a) => (
          <div key={a.id} className="flex items-center gap-3 py-3.5">
            <AgentTile id={a.id} look={s.agent?.look} size={44} />
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold text-ink">{a.name}</span>{s.prefs.defaultAgent === a.id && <span className="label rounded-full bg-tint px-1.5 py-0.5 text-[8px] text-brand-ink">Default</span>}</div><div className="text-[13px] leading-snug text-ink/55">{a.role} · seat {String(a.seat).padStart(2, "0")}{s.wallets[a.id] ? " · wallet" : ""}{s.cards[a.id] ? " · card" : ""}</div></div>
            <Link href={`/agents/${a.id}`} className={smallBtn}>Chat</Link>
            <button onClick={() => openAgent(a.id)} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-ink/65 hover:bg-tint hover:text-ink"><Icon name="idcard" size={15} />Edit</button>
          </div>
        ))}
      </Group>
      <Group>
        <Row title="Add an agent" desc="Create your own, or hire a specialist from the marketplace."><button onClick={() => openAdd()} className={smallBtn}>Add agent</button></Row>
        <Row title="Your team" desc="Everyone you hired, and the specialists you can bring back for free."><Link href="/team" className={smallBtn}>Team</Link></Row>
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
function DevicePush() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void pushOnHere().then(setOn); }, []);
  const perm = pushPermission();
  const flip = async (v: boolean) => {
    setBusy(true);
    try {
      if (v) { const r = await enablePush(true); setOn(r.ok); toast({ text: r.ok ? "Notifications are on. A test one is on its way." : r.why || "Couldn't turn on notifications" }); }
      else { await disablePush(); setOn(false); toast({ text: "Notifications are off for this device" }); }
    } finally { setBusy(false); }
  };
  const desc = perm === "unsupported" ? "This browser can't show notifications. On iPhone, add Lexari to your Home Screen first."
    : perm === "denied" ? "Blocked in your browser. Allow notifications for app.lexari.ai in site settings, then come back."
    : "Get replies, quest rewards, your daily box and payment updates even when Lexari is closed.";
  return (
    <Group title="This device">
      <Row title="Push notifications" desc={desc}>
        {perm === "unsupported" || perm === "denied" ? <span className="text-[12px] font-semibold text-ink/45">Off</span>
          : <span data-push-toggle className={busy ? "pointer-events-none opacity-60" : ""}><Toggle on={!!on} onChange={(v) => void flip(v)} label="Push notifications" /></span>}
      </Row>
    </Group>
  );
}

function Notifications({ s }: { s: State }) {
  return (
    <>
      <DevicePush />
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
        <Row title="Export data" desc="Download your account, agents, chats, memories and hires as a JSON file."><button onClick={() => { void exportData().then(() => toast({ text: "Export downloaded" }), () => toast({ text: "Export failed. Try again." })); }} className={smallBtn}><Icon name="download" size={15} />Export</button></Row>
        <Row title="Clear all chats" desc="Removes every message. Agents and memory stay."><button onClick={() => { if (confirm("Clear every chat?")) { clearChats(); toast({ text: "All chats cleared" }); } }} className={smallBtn}>Clear</button></Row>
      </Group>
      <Group title="Danger zone">
        <Row danger title="Delete account" desc="Permanently removes your account, agents, chats and memories from Lexari. Onchain records and your wallet stay yours.">{!del && <button onClick={() => setDel(true)} className={dangerBtn}><Icon name="trash" size={15} />Delete</button>}</Row>
        {del && (
          <div className="pb-5">
            <p className="text-[13.5px] text-ink/70">Type <b className="font-mono">DELETE</b> to confirm. This cannot be undone.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type DELETE" className="field !w-48 !py-2" />
              <button disabled={typed !== "DELETE"} onClick={() => { void deleteAccount().then(() => window.location.assign(LANDING_URL), () => toast({ text: "Could not delete the account. Try again." })); }} className="inline-flex h-11 items-center rounded-full bg-[#e5484d] px-4 text-[14px] font-bold text-white disabled:opacity-40">Delete account</button>
              <button onClick={() => { setDel(false); setTyped(""); }} className={smallBtn}>Cancel</button>
            </div>
          </div>
        )}
      </Group>
    </>
  );
}

function Security({ s }: { s: State }) {
  const router = useRouter();
  const google = s.auth?.method === "google";
  return (
    <>
      <Group title="Sign-in protection">
        <Row title={google ? "Google or email" : "Wallet signature"} desc={google ? "Privy checks your Google account or a one-time email code. Your Lexari wallet is created and kept by Privy." : "You sign a one-time message with your wallet. Lexari never sees your keys."} />
        <Row title="Session" desc="Sessions last up to 30 days on this device. Signing out ends it here and in your wallet." />
      </Group>
      <Group title="App lock"><LockSettings /></Group>
      <Group title="This device">
        <Row title="Sign out" desc="Ends this session."><button onClick={() => { void signOut().then(() => router.push("/signin")); }} className={smallBtn}><Icon name="out" size={15} />Sign out</button></Row>
      </Group>
    </>
  );
}

function Accounts({ s }: { s: State }) {
  const google = s.auth?.method === "google";
  const addr = s.auth?.address;
  const link = s.referralCode ? `${WEBAPP_URL}/signin?ref=${s.referralCode}` : "";
  const copy = (text: string, what: string) => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast({ text: `${what} copied` }), () => toast({ text: "Couldn't copy. Long-press to copy instead." }));
  };
  return (
    <>
      <Group title="Signed in with">
        <div className="flex items-center gap-3 py-4">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-[var(--bg)]"><Icon name={google ? "google" : "wallet"} size={20} /></span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[15px] font-semibold text-ink">{google ? "Google or email" : "Solana wallet"}<span className="label rounded-full bg-grape px-1.5 py-0.5 text-[8px] text-white">Signed in</span></div><div className="truncate text-[13px] text-ink/55">{google ? (s.auth?.email || "Privy account") : `${addr ? shortAddr(addr) : ""} · ${s.auth?.sub || "Solana"}`}</div></div>
        </div>
        <Row title={google ? "Lexari wallet" : "Wallet"} desc={addr ? `${shortAddr(addr)} signs your check-ins, quests, ID cards and hires.` : "Your wallet is still loading."}>{addr && <button onClick={() => copy(addr, "Address")} className={smallBtn}><Icon name="copy" size={14} />Copy</button>}</Row>
      </Group>
      <EmailNameSetting agent={agentName(s)} />
      {s.referralCode && (
        <Group title="Invite friends">
          <Row title={`Your code · ${s.referralCode}`} desc="Friends who sign up with your link count toward your referral tiers in the Hub."><button onClick={() => copy(link, "Invite link")} className={smallBtn}><Icon name="copy" size={14} />Copy link</button></Row>
        </Group>
      )}
    </>
  );
}

function Billing({ s }: { s: State }) {
  return (
    <BillingSection>
      <Group title="Hires">
        <Row title="Specialists" desc={s.paid.length ? `${s.paid.length} specialist${s.paid.length === 1 ? "" : "s"} hired, a one-time ${hirePriceLabel()} each from your balance. Released ones come back for free.` : `Specialists are a one-time ${hirePriceLabel()} hire each, paid from your Lexari balance.`}><Link href="/wallets" className={smallBtn}>Wallet</Link></Row>
      </Group>
    </BillingSection>
  );
}

function About() {
  const router = useRouter();
  return (
    <>
      <Group>
        <Row title="Version" desc="Lexari web"><span className="font-mono text-[13px] text-ink/60">1.0.0</span></Row>
      </Group>
      <Group title="Legal">
        <Row title="Terms of use"><Link href={`${LANDING_URL}/legal/terms`} className={smallBtn}>Read</Link></Row>
        <Row title="Privacy policy"><Link href={`${LANDING_URL}/legal/privacy`} className={smallBtn}>Read</Link></Row>
      </Group>
      <Group>
        <Row title="Sign out" desc="You can sign back in with Google or a wallet."><button onClick={() => { void signOut().then(() => router.push("/signin")); }} className={smallBtn}><Icon name="out" size={15} />Sign out</button></Row>
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
  const body = { general: <General s={s} />, personal: <Personal s={s} />, agents: <Agents s={s} />, models: <ModelsSection s={s} />, notifications: <Notifications s={s} />, data: <Data s={s} />, security: <Security s={s} />, accounts: <Accounts s={s} />, social: <SocialLinks s={s} />, integrations: <IntegrationsSection s={s} />, billing: <Billing s={s} />, about: <About /> }[sec];

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
