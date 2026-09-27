"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_ADDRESS, DEMO_GOOGLE, LOOKS, TONES, shortAddr } from "@/content/appData";
import { agentName, linkMethod, planOf, resetAll, signOut, toast, updateAgent, useApp } from "@/lib/store";
import Icon from "@/components/app/Icon";
import { AgentFace } from "@/components/app/faces";
import { DemoTag, PageHead } from "@/components/app/ui";

function Section({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section data-rise className="grid gap-4 border-t-2 border-line py-8 lg:grid-cols-[300px_1fr] lg:gap-10">
      <div><h2 className="display text-[30px] text-ink">{title}</h2><p className="mt-1.5 text-[15px] text-ink/70">{body}</p></div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

type Theme = "light" | "dark" | "system";

export default function SettingsPage() {
  const s = useApp()!;
  const router = useRouter();
  const a = s.agent!;
  const [name, setName] = useState(a.name);
  const [you, setYou] = useState(a.you);
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => { const t = localStorage.getItem("lexari-theme"); setTheme(t === "light" || t === "dark" ? t : "system"); }, []);
  const applyTheme = (t: Theme) => {
    setTheme(t);
    const v = t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
    document.documentElement.setAttribute("data-theme", v);
    try { if (t === "system") localStorage.removeItem("lexari-theme"); else localStorage.setItem("lexari-theme", t); } catch {}
  };
  const dirty = name.trim() !== a.name || you.trim() !== a.you;
  const save = () => { if (!name.trim()) return; updateAgent({ name: name.trim(), you: you.trim() }); toast({ text: `Saved. ${name.trim()} has its new badge.`, face: "home" }); };
  const p = planOf(s);
  const methods = [
    { id: "google" as const, icon: "google", title: "Google", sub: s.links.google ? DEMO_GOOGLE.email : "Not connected" },
    { id: "wallet" as const, icon: "wallet", title: "Crypto wallet", sub: s.links.wallet ? `${shortAddr(DEMO_ADDRESS)} · ${s.auth?.method === "wallet" ? s.auth.sub : "OKX Wallet (placeholder)"}` : "Not connected. OKX Wallet is one option (placeholder)." },
  ];

  return (
    <>
      <PageHead kicker="Settings" title="Settings." body="Your profile, how you sign in, how Lexari looks and your plan." right={<DemoTag />} />

      <div className="mt-8">
        <Section title="Profile" body="What your agent is called and what it calls you.">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="grain carpet-w relative grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-[28px] bg-grape shadow-[0_6px_0_#3514b0]"><AgentFace look={a.look} size={104} track /></div>
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <label><span className="label text-[10px] text-ink/70">Agent name</span><input value={name} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 12))} className="field mt-2" /></label>
              <label><span className="label text-[10px] text-ink/70">Your first name</span><input value={you} onChange={(e) => setYou(e.target.value.slice(0, 20))} className="field mt-2" placeholder="Ada" /></label>
              <div className="sm:col-span-2"><span className="label text-[10px] text-ink/70">How {agentName(s)} talks</span>
                <div className="mt-2 flex flex-wrap gap-2">{TONES.map((t) => <button key={t.id} onClick={() => updateAgent({ tone: t.id })} aria-pressed={a.tone === t.id} className="chip">{t.label}</button>)}</div></div>
              <div className="sm:col-span-2"><button onClick={save} disabled={!dirty || !name.trim()} className="btn btn-brand btn-sm disabled:opacity-40">Save profile</button></div>
            </div>
          </div>
        </Section>

        <Section title="Look" body="Pick a different generated face. It changes everywhere at once.">
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
            {LOOKS.map((l) => { const on = a.look === l; return (
              <button key={String(l)} onClick={() => updateAgent({ look: l })} aria-pressed={on} aria-label={l === null ? "House face" : `Face ${l}`} className={`grid aspect-square place-items-center rounded-2xl transition-all duration-300 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] ${on ? "scale-105 bg-grape shadow-[0_4px_0_#3514b0]" : "bg-tint hover:-translate-y-1"}`}><AgentFace look={l} size={44} /></button>
            ); })}
          </div>
        </Section>

        <Section title="Sign-in" body="Google or a crypto wallet. Connect both if you like; either one opens the same desk.">
          <ul className="grid gap-3">
            {methods.map((m) => { const on = s.links[m.id]; const inUse = s.auth?.method === m.id; return (
              <li key={m.id} className="flex flex-wrap items-center gap-4 rounded-[22px] bg-card p-3 pr-4 ring-1 ring-line">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${on ? "bg-ink text-[var(--bg)]" : "bg-tint text-ink"}`}><Icon name={m.icon} size={22} /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-bold text-ink">{m.title}{inUse && <span className="label rounded-full bg-grape px-2 py-0.5 text-[8.5px] text-white">signed in</span>}</span><span className="block truncate text-[13px] text-ink/70">{m.sub}</span></span>
                {inUse ? <span className="text-[13px] font-semibold text-ink/60">In use</span>
                  : <button onClick={() => { linkMethod(m.id, !on); toast({ text: on ? `${m.title} disconnected` : `${m.title} connected (demo)`, face: "home" }); }} className={`btn btn-sm ${on ? "btn-line text-ink" : "btn-ghost"}`}>{on ? "Disconnect" : "Connect"}</button>}
              </li>
            ); })}
          </ul>
        </Section>

        <Section title="Theme" body="Light, dark, or follow your device.">
          <div className="inline-flex rounded-full bg-tint p-1.5" role="radiogroup" aria-label="Theme">
            {([["light", "sun", "Light"], ["dark", "moon", "Dark"], ["system", "laptop", "System"]] as const).map(([id, ic, l]) => (
              <button key={id} role="radio" aria-checked={theme === id} onClick={() => applyTheme(id)} className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-bold transition ${theme === id ? "bg-card text-ink shadow-[0_3px_0_var(--color-grape)]" : "text-ink/70 hover:text-ink"}`}><Icon name={ic} size={16} />{l}</button>
            ))}
          </div>
        </Section>

        <Section title="Plan" body="Plans differ only by how many seats you get.">
          <div className="flex flex-wrap items-center gap-5 rounded-[24px] bg-card p-5 ring-1 ring-line">
            <div><span className="label text-[10px] text-ink/60">Current plan</span><div className="display mt-1 text-[40px] leading-none text-ink">{p.name}</div></div>
            <div className="flex-1"><div className="flex flex-wrap gap-1">{Array.from({ length: Math.min(p.seats, 20) }).map((_, i) => <i key={i} className={`h-4 w-4 rounded-[5px] ${i === 0 ? "bg-grape" : i <= s.hired.length ? "bg-lilac" : "border-2 border-dashed border-ink/25"}`} />)}</div><p className="mt-2 text-[14px] text-ink/70">{1 + s.hired.length} of {p.seats} seats filled</p></div>
            <Link href="/app/team" className="btn btn-ghost btn-sm">Change plan <Icon name="arrow" size={16} /></Link>
          </div>
        </Section>

        <Section title="Demo" body="This app runs on example data saved in your browser only.">
          <div className="flex flex-wrap gap-2">
            <Link href="/onboarding" className="btn btn-ghost btn-sm"><Icon name="flip" size={15} />Replay onboarding</Link>
            <button onClick={() => { if (confirm("Reset all demo data in this browser?")) { resetAll(); router.push("/"); } }} className="btn btn-line btn-sm text-ink"><Icon name="undo" size={15} />Reset demo data</button>
            <button onClick={() => { signOut(); router.push("/signin"); }} className="btn btn-ink btn-sm"><Icon name="out" size={15} />Sign out</button>
          </div>
        </Section>
      </div>
    </>
  );
}
