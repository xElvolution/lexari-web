"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import { toast } from "@/lib/store";
import { PageHead } from "@/components/ui";
import Icon from "@/components/Icon";
import { Copyable, Pill, Section, input, primary, secondary, usd, when } from "@/components/developer/parts";

type Key = { id: string; name: string; prefix: string; scopes: string[]; createdAt: number; lastUsedAt: number | null; revokedAt: number | null };
type Version = { id: string; version: string; name: string | null; status: string; notes: string; checks: { name: string; ok: boolean; detail?: string }[]; createdAt: number; reviewedAt: number | null };
type Listing = { id: string; slug: string; status: string; hires: number; earnedMicros: number; versions: Version[] };
type Dev = { handle: string; name: string; bio: string; url: string; verified: boolean; status: string; since: number };
type Me = { developer: Dev | null; keys?: Key[]; listings?: Listing[]; admin: boolean };
const SCOPES = [{ id: "publish", label: "Publish", body: "Submit new versions for review." }, { id: "read", label: "Read", body: "See your listings, review results and stats." }] as const;

function Join({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ invite: "", handle: "", name: "", terms: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    try { await api("/api/developer", { body: f }); toast({ text: "Welcome to the developer alpha", face: "home" }); onDone(); }
    catch (e) { setErr(friendly(e, "That didn't work. Check the invite code.")); }
    setBusy(false);
  };
  return (
    <Section title="Invite-only alpha">
      <p className="text-[14.5px] text-ink/70">Build your own agents with the Lexari SDK and publish them to the Marketplace. The alpha is invite-only and runs on testnet. Have an invite code? Join below.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="mb-1 block text-[13px] font-semibold text-ink/70">Invite code</span><input data-dev-invite className={input} placeholder="LXDEV-XXXX-XXXX" value={f.invite} onChange={(e) => setF({ ...f, invite: e.target.value })} /></label>
        <label><span className="mb-1 block text-[13px] font-semibold text-ink/70">Handle</span><input className={input} placeholder="acme-agents" value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value.toLowerCase() })} /></label>
        <label><span className="mb-1 block text-[13px] font-semibold text-ink/70">Name people see</span><input className={input} placeholder="Acme Agents" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      </div>
      <label className="mt-4 flex items-start gap-3 text-[13.5px] text-ink/75">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--grape)]" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} />
        <span>I agree to the developer rules: my agents run on testnet, never ask for keys or recovery phrases, and only move money through intents that the person confirms on a Confirm card. Lexari reviews every version before it is listed.</span>
      </label>
      {err && <p className="mt-3 text-[13px] text-[#e5484d]">{err}</p>}
      <button data-dev-join disabled={busy || !f.invite || !f.handle || !f.name || !f.terms} onClick={() => void go()} className={`${primary} mt-4`}>{busy ? "Joining…" : "Join the alpha"}</button>
    </Section>
  );
}

function Keys({ keys, reload }: { keys: Key[]; reload: () => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["publish", "read"]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const make = async () => {
    setBusy(true); setErr("");
    try { const r = await api<{ key: string }>("/api/developer/keys", { body: { name: name.trim() || "My key", scopes } }); setFresh(r.key); setName(""); reload(); }
    catch (e) { setErr(friendly(e, "Couldn't make a key.")); }
    setBusy(false);
  };
  const revoke = async (k: Key) => {
    if (!window.confirm(`Revoke ${k.name}? Anything using it stops working at once.`)) return;
    try { await api(`/api/developer/keys/${k.id}`, { method: "DELETE" }); reload(); toast({ text: "Key revoked", face: "home" }); }
    catch (e) { toast({ text: friendly(e, "Couldn't revoke it."), face: "home" }); }
  };
  const live = keys.filter((k) => !k.revokedAt);
  return (
    <Section title="Developer keys">
      <p className="text-[13.5px] text-ink/65">Keys let the CLI publish for you. Each key is shown once, stored only as a hash, and you can revoke it any time. Making one asks you to confirm it&apos;s you. The easiest way is <code className="rounded bg-tint px-1 font-mono text-[12px]">lexari login</code>, which makes a key for the CLI after you approve it here.</p>
      {fresh && (
        <div data-dev-fresh-key className="mt-4 rounded-2xl bg-grape/10 p-4 ring-1 ring-grape/30">
          <p className="text-[14px] font-bold text-ink">Your new key. Copy it now: you won&apos;t see it again.</p>
          <div className="mt-2"><Copyable value={fresh} /></div>
          <button onClick={() => setFresh(null)} className={`${secondary} mt-3`}>I saved it</button>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label><span className="mb-1 block text-[13px] font-semibold text-ink/70">Key name</span><input className={input} placeholder="Laptop" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button data-dev-new-key disabled={busy || !scopes.length} onClick={() => void make()} className={primary}><Icon name="key" size={16} />{busy ? "Making…" : "New key"}</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ${scopes.includes(s.id) ? "bg-tint text-ink ring-grape/50" : "text-ink/60 ring-line"}`} title={s.body}>
            <input type="checkbox" className="accent-[var(--grape)]" checked={scopes.includes(s.id)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s.id] : scopes.filter((x) => x !== s.id))} />{s.label}
          </label>
        ))}
      </div>
      {err && <p className="mt-2 text-[13px] text-[#e5484d]">{err}</p>}
      {keys.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {keys.map((k) => (
            <li key={k.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-3 ${k.revokedAt ? "opacity-50" : ""}`}>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold text-ink">{k.name}</span>
                <span className="block text-[12.5px] text-ink/60"><code className="font-mono">{k.prefix}…</code> · {k.scopes.join(", ")} · made {when(k.createdAt)} · last used {when(k.lastUsedAt)}</span>
              </span>
              {k.revokedAt ? <span className="text-[12.5px] font-semibold text-ink/60">Revoked {when(k.revokedAt)}</span> : <button onClick={() => void revoke(k)} className={secondary}><Icon name="trash" size={14} />Revoke</button>}
            </li>
          ))}
        </ul>
      )}
      {!live.length && !fresh && <p className="mt-3 text-[13px] text-ink/55">No active keys yet.</p>}
    </Section>
  );
}

function Listings({ listings }: { listings: Listing[] }) {
  if (!listings.length) return (
    <Section title="Your agents">
      <p className="text-[14px] text-ink/70">Nothing published yet. With the CLI:</p>
      <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-[12.5px] leading-relaxed text-[var(--bg)]">{`lexari login\nlexari init my-agent --template tip-jar\ncd my-agent && lexari test\nlexari publish`}</pre>
    </Section>
  );
  return (
    <Section title="Your agents">
      <ul className="divide-y divide-line">
        {listings.map((l) => { const v = l.versions[0]; return (
          <li key={l.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold text-ink">{v?.name || l.slug}</span><Pill s={l.status} />
              {l.status === "listed" && <Link href={`/marketplace/${l.slug}`} className="text-[13px] font-semibold text-brand-ink hover:underline">View listing</Link>}
              <span className="ml-auto text-[12.5px] text-ink/60">{l.hires} hire{l.hires === 1 ? "" : "s"} · {usd(l.earnedMicros)} earned (80%)</span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {l.versions.slice(0, 4).map((x) => (
                <li key={x.id} className="text-[13px] text-ink/70">
                  <span className="font-mono">v{x.version}</span> <Pill s={x.status} /> <span className="text-ink/50">submitted {when(x.createdAt)}</span>
                  {x.notes && x.status !== "approved" && <span className="mt-0.5 block rounded-xl bg-tint px-3 py-2 text-[12.5px] text-ink/75">Reviewer: {x.notes}</span>}
                </li>
              ))}
            </ul>
          </li>
        ); })}
      </ul>
    </Section>
  );
}

function Profile({ d, reload }: { d: Dev; reload: () => void }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: d.name, bio: d.bio, url: d.url });
  const [err, setErr] = useState("");
  const save = async () => {
    setErr("");
    try { await api("/api/developer", { method: "PATCH", body: f }); setEdit(false); reload(); }
    catch (e) { setErr(friendly(e, "Couldn't save that.")); }
  };
  return (
    <Section title="Developer profile" right={!edit ? <button onClick={() => setEdit(true)} className="text-[13px] font-bold text-brand-ink">Edit</button> : undefined}>
      {!edit ? (
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tint text-brand-ink"><Icon name="terminal" size={22} /></span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[16px] font-bold text-ink">{d.name}{d.verified && <Icon name="verified" size={16} className="text-brand-ink" />}</p>
            <p className="text-[13px] text-ink/60">@{d.handle} · developer since {when(d.since)}</p>
            {d.bio && <p className="mt-2 text-[14px] text-ink/75">{d.bio}</p>}
            {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] font-semibold text-brand-ink hover:underline">{d.url.replace(/^https:\/\//, "")}</a>}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <input className={input} value={f.name} maxLength={48} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Name" />
          <textarea className={`${input} h-24 py-3`} value={f.bio} maxLength={280} placeholder="What you build" onChange={(e) => setF({ ...f, bio: e.target.value })} aria-label="Bio" />
          <input className={input} value={f.url} placeholder="https://" onChange={(e) => setF({ ...f, url: e.target.value })} aria-label="Website" />
          {err && <p className="text-[13px] text-[#e5484d]">{err}</p>}
          <div className="flex gap-2"><button onClick={() => void save()} className={primary}>Save</button><button onClick={() => setEdit(false)} className={secondary}>Cancel</button></div>
        </div>
      )}
    </Section>
  );
}

export default function DeveloperPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");
  const load = () => api<Me>("/api/developer").then(setMe, (e) => setErr(friendly(e, "Couldn't load this.")));
  useEffect(() => { void load(); }, []);
  return (
    <>
      <PageHead kicker="Developer" title="Build for the Marketplace." body="Make agents with the Lexari SDK, test them locally, and publish them for review. Testnet only, invite-only alpha." right={me?.admin ? <Link href="/admin" className={secondary}><Icon name="check" size={14} />Review queue</Link> : undefined} />
      <div className="max-w-[760px]">
        {err && <p className="mt-6 text-[14px] text-[#e5484d]">{err}</p>}
        {!me && !err && <p className="mt-6 text-[14px] text-ink/60">Loading…</p>}
        {me && !me.developer && <Join onDone={() => void load()} />}
        {me?.developer && (
          <>
            <Profile d={me.developer} reload={() => void load()} />
            <Listings listings={me.listings ?? []} />
            <Keys keys={me.keys ?? []} reload={() => void load()} />
            <Section title="How it stays safe">
              <ul className="space-y-2 text-[13.5px] text-ink/70">
                <li className="flex gap-2"><Icon name="lock" size={15} className="mt-0.5 shrink-0 text-brand-ink" />Your tools run on your own server. Lexari calls them over signed HTTPS and never shares a key, a session or a wallet.</li>
                <li className="flex gap-2"><Icon name="wallet" size={15} className="mt-0.5 shrink-0 text-brand-ink" />To move money a tool returns an intent (a transfer or a swap). It becomes a Confirm card labelled with your agent and your name, inside the person&apos;s limits and lower agent caps.</li>
                <li className="flex gap-2"><Icon name="verified" size={15} className="mt-0.5 shrink-0 text-brand-ink" />Every version is checked automatically and reviewed by a person before it is listed.</li>
              </ul>
            </Section>
          </>
        )}
      </div>
    </>
  );
}
