"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { shortAddr } from "@/content/appData";
import { agentName, mediaUrl, planOf, setMedia, setPrefs, signOut, toast, updateProfile, useApp, type State } from "@/lib/store";
import { applyTheme, onTheme, savedTheme } from "@shared/components/theme";
import ImageCrop from "@/components/ImageCrop";
import { openAgent } from "@/components/overlays";
import Icon from "@/components/Icon";
import { AgentTile } from "@/components/faces";
import { myAgents } from "@/components/agents";

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
        <div className="mt-4 flex items-center gap-4"><Avatar p={p} name={name} size="h-16 w-16 text-[22px]" /><span className="text-[13.5px] text-ink/55">Change your picture and cover from the camera buttons on your profile.</span></div>
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

function Avatar({ p, name, size }: { p: State["profile"] & object; name?: string; size: string }) {
  const src = mediaUrl("avatar", p.avatar);
  return src
    ? <img data-avatar src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    : <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-ink font-bold text-[var(--bg)]`}>{initials(name ?? p.name)}</span>;
}

type Tab = "account" | "security" | "prefs";
const TABS: [Tab, string][] = [["account", "Account"], ["security", "Security"], ["prefs", "Preferences"]];

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return <section data-rise className="rounded-[26px] bg-card p-5 ring-1 ring-line sm:p-6"><div className="flex items-center justify-between"><h2 className="text-[17px] font-bold text-ink">{title}</h2>{right}</div>{children}</section>;
}
function Rows({ rows }: { rows: [string, string, React.ReactNode][] }) {
  return (
    <dl className="mt-2 divide-y divide-[var(--line)]">
      {rows.map(([ic, k, v]) => (
        <div key={k} className="flex items-center gap-3 py-3 text-[14.5px]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-ink/70"><Icon name={ic} size={16} /></span>
          <dt className="shrink-0 text-ink/60">{k}</dt><dd className={`ml-auto min-w-0 truncate text-right font-semibold text-ink ${k === "User ID" || k === "Wallet" || k === "Invite code" ? "font-mono text-[13px]" : ""}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
const pill = "inline-flex h-10 items-center gap-2 rounded-full bg-tint px-4 text-[14px] font-semibold text-ink hover:bg-grape hover:text-white";

export default function ProfilePage() {
  const s = useApp()!;
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState<Tab>("account");
  const [crop, setCrop] = useState<{ kind: "avatar" | "cover"; file: File } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  const pick = useRef<HTMLInputElement>(null);
  const pickKind = useRef<"avatar" | "cover">("avatar");
  useEffect(() => { if (!s.profile) updateProfile({}); }, [s.profile]);
  useEffect(() => { setTheme(savedTheme()); return onTheme(setTheme); }, []);
  useEffect(() => { const h = location.hash.slice(1); if (h === "security" || h === "prefs") setTab(h); }, []);
  if (!s.profile) return null;
  const p = s.profile;
  const plan = planOf(s);
  const team = myAgents(s);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const uid = `lx_${(p.username + "0000").slice(0, 4)}${String(p.since).slice(-6)}`;
  const cover = mediaUrl("cover", p.cover);
  const choose = (kind: "avatar" | "cover") => { pickKind.current = kind; pick.current?.click(); };
  const remove = async (kind: "avatar" | "cover") => { try { await setMedia(kind, null); toast({ text: kind === "avatar" ? "Picture removed" : "Cover removed" }); } catch (e) { toast({ text: (e as Error).message }); } };

  return (
    <>
      <input ref={pick} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" hidden data-media-input onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCrop({ kind: pickKind.current, file: f }); }} />
      <section data-rise className="overflow-hidden rounded-[30px] bg-card ring-1 ring-line">
        <div className="grain relative h-28 bg-[linear-gradient(120deg,#2a0f9a,#5b2bff_55%,#8f6bff)] sm:h-44">
          {cover && <img data-cover src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute right-3 top-3 flex gap-1.5">
            {cover && <button onClick={() => remove("cover")} aria-label="Remove cover" className="grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60"><Icon name="trash" size={15} /></button>}
            <button data-cover-btn onClick={() => choose("cover")} className="flex h-9 items-center gap-1.5 rounded-full bg-black/45 px-3 text-[13px] font-semibold text-white backdrop-blur hover:bg-black/60"><Icon name="camera" size={15} />{cover ? "Change cover" : "Add cover"}</button>
          </div>
        </div>
        <div className="px-5 pb-5 sm:px-8">
          <div className="relative z-10 -mt-10 flex flex-wrap items-end gap-3 sm:-mt-14 sm:gap-4">
            <span className="relative rounded-full ring-[5px] ring-[var(--card)]">
              <Avatar p={p} size="h-20 w-20 text-[28px] sm:h-28 sm:w-28 sm:text-[34px]" />
              <button data-avatar-btn onClick={() => choose("avatar")} aria-label="Change profile picture" className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full bg-grape text-white ring-[3px] ring-[var(--card)]"><Icon name="camera" size={14} /></button>
            </span>
            <div className="flex w-full gap-1.5 pb-1 sm:ml-auto sm:w-auto sm:gap-2">
              <button onClick={() => setEdit(true)} className="btn btn-ghost btn-sm !h-10 flex-1 whitespace-nowrap max-sm:!px-2 max-sm:!text-[13px] sm:flex-none"><Icon name="edit" size={15} />Edit profile</button>
              <button onClick={() => { void signOut().then(() => router.push("/signin")); }} className="btn btn-line btn-sm !h-10 flex-1 whitespace-nowrap text-ink max-sm:!px-2 max-sm:!text-[13px] sm:flex-none"><Icon name="out" size={15} />Sign out</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <h1 className="display text-[40px] leading-none text-ink sm:text-[48px]">{p.name}</h1>
            <span className="label rounded-full bg-grape px-2.5 py-1 text-[9px] text-white">{plan.name}</span>
          </div>
          {p.username ? <p className="mt-1.5 text-[15px] font-semibold text-ink/55">@{p.username}</p> : <button type="button" onClick={() => setEdit(true)} className="mt-1.5 text-[14px] font-semibold text-brand-ink">Add a username</button>}
          {p.bio && <p className="mt-3 max-w-[40rem] text-[15.5px] text-ink/75">{p.bio}</p>}
          {p.avatar && <button onClick={() => remove("avatar")} className="mt-2 block text-[12.5px] font-semibold text-ink/50 hover:text-ink">Remove picture</button>}
          <div className="mt-4 flex flex-wrap gap-6 text-[14px]">
            <span><b className="text-ink">{team.length}</b> <span className="text-ink/60">agents</span></span>
            <span><b className="text-ink">{s.groups.length}</b> <span className="text-ink/60">groups</span></span>
            <span><b className="text-ink">{s.memory.length}</b> <span className="text-ink/60">memories</span></span>
          </div>
        </div>
        <div role="tablist" aria-label="Profile" className="flex border-t border-[var(--line)] px-2 sm:px-5">
          {TABS.map(([id, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} data-tab={id} onClick={() => { setTab(id); history.replaceState(null, "", `#${id}`); }} className={`relative flex-1 py-3.5 text-[14.5px] font-bold transition sm:flex-none sm:px-5 ${tab === id ? "text-ink" : "text-ink/50 hover:text-ink"}`}>
              {l}{tab === id && <i className="absolute inset-x-4 bottom-0 h-[3px] rounded-full bg-grape" />}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5" role="tabpanel">
        {tab === "account" && <>
          <Card title="Account">
            <Rows rows={[
              ...(s.auth?.email ? [["google", "Email", s.auth.email] as [string, string, string]] : []),
              ["wallet", "Wallet", s.auth?.address ? shortAddr(s.auth.address) : "Loading"],
              ["star", "Plan", `${plan.name} · ${plan.seats} seat${plan.seats === 1 ? "" : "s"}`],
              ...(s.referralCode ? [["star", "Invite code", s.referralCode] as [string, string, string]] : []),
              ["spark", "Member since", new Date(p.since).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
              ["list", "User ID", uid],
            ]} />
            <div className="mt-4 flex flex-wrap gap-2"><Link href="/app/settings#billing" className={pill}>Plan and billing</Link><Link href="/app/wallets" className={pill}>Wallet</Link></div>
          </Card>
          <Card title="Your agents" right={<Link href="/app/team" className="text-[13.5px] font-bold text-brand-ink hover:underline">Team</Link>}>
            <div className="mt-3 flex flex-wrap gap-2">
              {team.map((t) => <button key={t.id} onClick={() => openAgent(t.id)} title={`${t.name}'s ID card`} className="flex items-center gap-2 rounded-full bg-tint py-1 pl-1 pr-3.5 text-[13.5px] font-semibold text-ink transition hover:bg-grape hover:text-white"><AgentTile id={t.id} look={s.agent?.look} size={30} radius={15} />{t.name}</button>)}
            </div>
          </Card>
        </>}
        {tab === "security" && <>
          <Card title="Sign-in">
            <Rows rows={[
              ["user", "Signed in with", s.auth?.method === "wallet" ? (s.auth.sub || "Solana wallet") : "Google or email"],
              ...(s.auth?.email ? [["google", "Email", s.auth.email] as [string, string, string]] : []),
              ["wallet", "Wallet", s.auth?.address ? shortAddr(s.auth.address) : "Loading"],
            ]} />
          </Card>
          <Card title="App lock">
            <p className="mt-1 text-[14px] text-ink/65">{s.lockOn ? `On. Lexari asks for your PIN${s.biometric ? " or fingerprint" : ""} when you open it.` : "Off. Add a PIN so nobody can open Lexari on this phone without it."}</p>
            <div className="mt-3"><Link href="/app/settings#security" data-lock-link className={pill}><Icon name="lock" size={15} />{s.lockOn ? "Manage app lock" : "Set up app lock"}</Link></div>
          </Card>
          <Card title="Session">
            <p className="mt-1 text-[14px] text-ink/65">Signing out keeps your agents, chats and Brain saved for next time.</p>
            <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => { void signOut().then(() => router.push("/signin")); }} className={pill}><Icon name="out" size={15} />Sign out</button><Link href="/app/settings#data" className={pill}>Privacy and data</Link></div>
          </Card>
        </>}
        {tab === "prefs" && <>
          <Card title="Look">
            <div className="mt-3 inline-flex rounded-full bg-tint p-1" role="radiogroup" aria-label="Theme">
              {([["light", "Light", "sun"], ["dark", "Dark", "moon"], ["system", "Device", "laptop"]] as const).map(([id, l, ic]) => (
                <button key={id} role="radio" aria-checked={theme === id} onClick={() => { applyTheme(id); setPrefs({ theme: id }); }} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-bold transition ${theme === id ? "bg-card text-ink shadow-sm" : "text-ink/60 hover:text-ink"}`}><Icon name={ic} size={14} />{l}</button>
              ))}
            </div>
            <Rows rows={[["globe", "Time zone", tz || "Not set"]]} />
          </Card>
          <Card title="Voices">
            <p className="mt-1 text-[14px] text-ink/65">Each agent has its own voice on calls and when reading messages aloud.</p>
            <div className="mt-3 flex flex-wrap gap-2">{team.slice(0, 6).map((t) => <button key={t.id} onClick={() => openAgent(t.id)} className={pill}><Icon name="speaker" size={14} />{t.name}</button>)}</div>
          </Card>
          <Card title="More settings">
            <div className="mt-3 flex flex-wrap gap-2"><Link href="/app/settings#notifications" className={pill}>Notifications</Link><Link href="/app/settings" className={pill}>All settings</Link><Link href="/app/memory" className={pill}>{agentName(s)}&apos;s Brain</Link></div>
          </Card>
        </>}
      </div>
      {edit && <EditDialog s={s} onClose={() => setEdit(false)} />}
      {crop && <ImageCrop file={crop.file} aspect={crop.kind === "avatar" ? 1 : 3} out={crop.kind === "avatar" ? [512, 512] : [1500, 500]} round={crop.kind === "avatar"} title={crop.kind === "avatar" ? "Profile picture" : "Cover photo"}
        onCancel={() => setCrop(null)}
        onDone={async (url) => { await setMedia(crop.kind, url); setCrop(null); toast({ text: crop.kind === "avatar" ? "Picture updated" : "Cover updated" }); }} />}
    </>
  );
}
