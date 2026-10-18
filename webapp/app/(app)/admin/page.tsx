"use client";

import { useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import { PageHead } from "@/components/ui";
import Icon from "@/components/Icon";
import { Copyable, Section, input, primary, when } from "@/components/developer/parts";

type Invite = { id: string; note: string; used: boolean; usedAt: number | null; expiresAt: number; createdAt: number };

function Invites() {
  const [list, setList] = useState<Invite[] | null>(null);
  const [note, setNote] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const load = () => api<{ invites: Invite[] }>("/api/admin/invites").then((r) => setList(r.invites), (e) => setErr(friendly(e, "Couldn't load invites.")));
  useEffect(() => { void load(); }, []);
  const make = async () => {
    setErr("");
    try { const r = await api<{ code: string }>("/api/admin/invites", { body: { note } }); setFresh(r.code); setNote(""); void load(); }
    catch (e) { setErr(friendly(e, "Couldn't make an invite.")); }
  };
  return (
    <Section title="Developer invites">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label><span className="mb-1 block text-[13px] font-semibold text-ink/70">Who it&apos;s for</span><input className={input} placeholder="Name or team" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button onClick={() => void make()} className={primary}><Icon name="plus" size={16} />New invite</button>
      </div>
      {fresh && <div className="mt-3"><p className="mb-1 text-[13px] font-semibold text-ink">One-time code, valid 14 days. Shown once.</p><Copyable value={fresh} /></div>}
      {err && <p className="mt-2 text-[13px] text-[#e5484d]">{err}</p>}
      {!!list?.length && (
        <ul className="mt-4 divide-y divide-line">
          {list.map((i) => <li key={i.id} className="flex flex-wrap justify-between gap-2 py-2 text-[13.5px]"><span className="font-semibold text-ink">{i.note || "Invite"}</span><span className="text-ink/60">{i.used ? `Used ${when(i.usedAt)}` : i.expiresAt < Date.now() ? "Expired" : `Open until ${when(i.expiresAt)}`}</span></li>)}
        </ul>
      )}
    </Section>
  );
}

export default function AdminPage() {
  return (
    <>
      <PageHead kicker="Lexari review" title="Review queue." body="Check every new agent version before it reaches the Marketplace. Automated checks run first; approving lists the version." />
      <div className="max-w-[900px]">
        <Invites />
      </div>
    </>
  );
}
