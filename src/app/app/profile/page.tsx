"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_ADDRESS, DEMO_GOOGLE, shortAddr } from "@/content/appData";
import { agentName, planOf, signOut, startTour, toast, updateProfile, useApp, type State } from "@/lib/store";
import { openAgent } from "@/components/app/overlays";
import Icon from "@/components/app/Icon";
import { AgentTile } from "@/components/app/faces";
import { DemoTag } from "@/components/app/ui";
import { myAgents } from "@/components/app/agents";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "Y";

function EditDialog({ s, onClose }: { s: State; onClose: () => void }) {
  const p = s.profile!;
  const [name, setName] = useState(p.name);
  const [user, setUser] = useState(p.username);
  const [bio, setBio] = useState(p.bio);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const ok = name.trim().length > 0 && /^[a-z0-9_]{3,20}$/.test(user);
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="edit-title" className="pop pb-safe-dlg w-full max-w-[460px] rounded-t-[28px] bg-card p-5 ring-1 ring-line sm:rounded-[28px] sm:p-6">
        <div className="flex items-center justify-between"><h2 id="edit-title" className="display text-[30px] text-ink">Edit profile</h2><button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button></div>
        <div className="mt-4 flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-full bg-ink text-[22px] font-bold text-[var(--bg)]">{initials(name)}</span><button onClick={() => toast({ text: "Photo upload is coming soon (demo)" })} className="inline-flex h-10 items-center gap-2 rounded-full bg-tint px-4 text-[14px] font-semibold text-ink hover:bg-grape hover:text-white"><Icon name="edit" size={15} />Change photo</button></div>
        <label className="mt-5 block"><span className="label text-[9.5px] text-ink/60">Display name</span><input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} className="field mt-1.5 !py-2.5" /></label>
        <label className="mt-3 block"><span className="label text-[9.5px] text-ink/60">Username</span>
          <span className="relative mt-1.5 block"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-ink/45">@</span><input value={user} onChange={(e) => setUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} className="field !py-2.5 !pl-8" /></span>
          <span className="mt-1 block text-[12px] text-ink/50">3 to 20 letters, numbers or underscores.</span></label>
        <label className="mt-3 block"><span className="label text-[9.5px] text-ink/60">Bio</span><textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} rows={3} className="field mt-1.5 resize-none !py-2.5 !text-[15px] !font-medium" placeholder="A line about you" /><span className="mt-1 block text-right text-[12px] text-ink/45">{bio.length}/160</span></label>
        <div className="mt-4 flex gap-2"><button onClick={onClose} className="btn btn-line btn-sm text-ink">Cancel</button><button disabled={!ok} onClick={() => { updateProfile({ name: name.trim(), username: user, bio: bio.trim() }); toast({ text: "Profile saved" }); onClose(); }} className="btn btn-brand btn-sm flex-1 disabled:opacity-40 disabled:shadow-none">Save</button></div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const s = useApp()!;
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  useEffect(() => { if (!s.profile) updateProfile({}); }, [s.profile]);
  if (!s.profile) return null;
  const p = s.profile;
  const plan = planOf(s);
  const team = myAgents(s);
  const about = s.memory.filter((m) => m.tag === "About you").slice(0, 4);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const uid = `lx_${(p.username + "0000").slice(0, 4)}${String(p.since).slice(-6)}`;
  const info: [string, string, string][] = [
    ["google", "Email", s.links.google ? DEMO_GOOGLE.email : "Not connected"],
    ["wallet", "Wallet sign-in", s.links.wallet ? shortAddr(DEMO_ADDRESS) : "Not connected"],
    ["user", "Signed in with", s.auth?.method === "wallet" ? "Crypto wallet" : "Google"],
    ["spark", "Member since", new Date(p.since).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
    ["globe", "Time zone", tz || "Not set"],
    ["list", "User ID", uid],
  ];

  return (
    <>
      <section data-rise className="overflow-hidden rounded-[30px] bg-card ring-1 ring-line">
        <div className="grain relative h-32 bg-[linear-gradient(120deg,#2a0f9a,#5b2bff_55%,#8f6bff)] sm:h-40">
          <span className="absolute right-4 top-4"><DemoTag className="!border-white/50 !text-white" /></span>
        </div>
        <div className="px-5 pb-6 sm:px-8">
          <div className="relative z-10 -mt-12 flex flex-wrap items-end gap-4 sm:-mt-14">
            <span className="grid h-24 w-24 place-items-center rounded-full bg-ink text-[34px] font-bold text-[var(--bg)] ring-[6px] ring-[var(--card)] sm:h-28 sm:w-28">{initials(p.name)}</span>
            <div className="ml-auto flex gap-2 pb-1">
              <button onClick={() => setEdit(true)} className="btn btn-ghost btn-sm !h-10"><Icon name="edit" size={15} />Edit profile</button>
              <button onClick={() => { startTour(); router.push("/app"); }} className="btn btn-ghost btn-sm !h-10"><Icon name="play" size={14} />Replay tour</button>
              <button onClick={() => { signOut(); router.push("/signin"); }} className="btn btn-line btn-sm !h-10 text-ink"><Icon name="out" size={15} />Sign out</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <h1 className="display text-[40px] leading-none text-ink sm:text-[48px]">{p.name}</h1>
            <span className="label rounded-full bg-grape px-2.5 py-1 text-[9px] text-white">{plan.name}</span>
          </div>
          <p className="mt-1.5 text-[15px] font-semibold text-ink/55">@{p.username}</p>
          {p.bio && <p className="mt-3 max-w-[40rem] text-[15.5px] text-ink/75">{p.bio}</p>}
          <div className="mt-5 flex flex-wrap gap-6 text-[14px]">
            <span><b className="text-ink">{team.length}</b> <span className="text-ink/60">agents</span></span>
            <span><b className="text-ink">{s.groups.length}</b> <span className="text-ink/60">groups</span></span>
            <span><b className="text-ink">{s.memory.length}</b> <span className="text-ink/60">memories</span></span>
            <span><b className="text-ink">{Object.keys(s.cards).length}</b> <span className="text-ink/60">cards</span></span>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section data-rise className="rounded-[26px] bg-card p-5 ring-1 ring-line sm:p-6">
          <h2 className="text-[17px] font-bold text-ink">Account</h2>
          <dl className="mt-2 divide-y divide-[var(--line)]">
            {info.map(([ic, k, v]) => (
              <div key={k} className="flex items-center gap-3 py-3 text-[14.5px]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-ink/70"><Icon name={ic} size={16} /></span>
                <dt className="text-ink/60">{k}</dt><dd className={`ml-auto truncate font-semibold text-ink ${k === "User ID" || k === "Wallet sign-in" ? "font-mono text-[13px]" : ""}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app/settings#accounts" className="inline-flex h-10 items-center gap-2 rounded-full bg-tint px-4 text-[14px] font-semibold text-ink hover:bg-grape hover:text-white">Connected accounts</Link>
            <Link href="/app/settings#security" className="inline-flex h-10 items-center gap-2 rounded-full bg-tint px-4 text-[14px] font-semibold text-ink hover:bg-grape hover:text-white">Security</Link>
          </div>
        </section>

        <div className="grid gap-5">
          <section data-rise className="rounded-[26px] bg-card p-5 ring-1 ring-line sm:p-6">
            <div className="flex items-center justify-between"><h2 className="text-[17px] font-bold text-ink">Your agents</h2><Link href="/app/team" className="text-[13.5px] font-bold text-brand-ink hover:underline">Team</Link></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {team.map((t) => <button key={t.id} onClick={() => openAgent(t.id)} title={`${t.name}'s ID card`} className="flex items-center gap-2 rounded-full bg-tint py-1 pl-1 pr-3.5 text-[13.5px] font-semibold text-ink transition hover:bg-grape hover:text-white"><AgentTile id={t.id} look={s.agent?.look} size={30} radius={15} />{t.name}</button>)}
            </div>
          </section>
          <section data-rise className="rounded-[26px] bg-card p-5 ring-1 ring-line sm:p-6">
            <div className="flex items-center justify-between"><h2 className="text-[17px] font-bold text-ink">What they know about you</h2><Link href="/app/memory" className="text-[13.5px] font-bold text-brand-ink hover:underline">Brain</Link></div>
            <ul className="mt-3 space-y-2">{about.length ? about.map((m) => <li key={m.id} className="flex items-start gap-2.5 text-[14.5px] text-ink/80"><i className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-grape" />{m.text}</li>) : <li className="text-[14.5px] text-ink/60">Nothing yet. Tell {agentName(s)} something with “remember…”.</li>}</ul>
          </section>
          <section data-rise className="grid grid-cols-2 gap-3">
            <Link href="/app/wallets" className="rounded-[22px] bg-card p-4 ring-1 ring-line transition hover:ring-grape/60"><Icon name="wallet" size={20} className="text-brand-ink" /><div className="mt-2 text-[15px] font-bold text-ink">Wallets</div><div className="text-[13px] text-ink/55">{Object.keys(s.wallets).length} active</div></Link>
            <Link href="/app/wallets?tab=cards" className="rounded-[22px] bg-card p-4 ring-1 ring-line transition hover:ring-grape/60"><Icon name="file" size={20} className="text-brand-ink" /><div className="mt-2 text-[15px] font-bold text-ink">Cards</div><div className="text-[13px] text-ink/55">{Object.keys(s.cards).length} active</div></Link>
          </section>
        </div>
      </div>
      {edit && <EditDialog s={s} onClose={() => setEdit(false)} />}
    </>
  );
}
