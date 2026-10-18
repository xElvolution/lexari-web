"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { PageHead } from "@/components/ui";
import { APPLY_URL, NEW_PR_URL, PUBLIC_PROTOCOLS as PROTOCOLS, PROTOCOL_CATS, PROTOCOL_STATUS, type Protocol } from "@/content/protocols";

const TONE = {
  live: "bg-[#e6f6ec] text-[#18794e] dark:bg-[#18794e]/25 dark:text-[#7ee2a8]",
  data: "bg-tint text-grape",
  wait: "bg-[#fff4e0] text-[#a35a00] dark:bg-[#a35a00]/25 dark:text-[#ffc56b]",
};

function Status({ p }: { p: Protocol }) {
  const s = PROTOCOL_STATUS[p.status];
  return (
    <span className={`label inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] ${TONE[s.tone]}`}>
      {s.tone === "live" && <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" /></span>}
      {s.label}
    </span>
  );
}

function Card({ p, i }: { p: Protocol; i: number }) {
  const [open, setOpen] = useState(false);
  const live = p.actions.filter((a) => a.live);
  return (
    <article
      className="int-card group flex flex-col rounded-[24px] bg-card p-5 ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(91,43,255,.45)] hover:ring-grape/40 max-[430px]:p-4"
      style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
    >
      <div className="flex items-start gap-3.5">
        <span className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[16px] ring-1 ring-line ${p.logoBackground === "dark" ? "bg-[#0a0a0a] p-2.5" : "bg-white"} transition duration-300 group-hover:rotate-[-4deg] group-hover:scale-105`}>
          <img src={p.logo} alt={`${p.name} logo`} width={56} height={56} className="h-full w-full object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-bold text-ink">{p.name}</h3>
            {p.kind === "dapp" && <span className="label rounded-full bg-ink px-2 py-1 text-[9px] text-[var(--bg)]">dApp</span>}
          </div>
          <div className="mt-1.5"><Status p={p} /></div>
        </div>
      </div>
      <p className="mt-3.5 text-[14px] leading-relaxed text-ink/75">{p.description}</p>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {p.chains.map((c) => <span key={c} className="rounded-full bg-tint px-2.5 py-1 text-[12px] font-semibold text-ink/75">{c}</span>)}
      </div>
      <div className="mt-4 border-t border-line pt-3.5">
        <p className="label text-[9px] text-ink/50">What agents can do</p>
        <ul className="mt-2 space-y-1.5">
          {(open ? live : live.slice(0, 3)).map((a) => <li key={a.text} className="flex gap-2 text-[13.5px] text-ink/85"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-grape text-white"><Icon name="check" size={10} /></span>{a.text}</li>)}
        </ul>
        {live.length > 3 && (
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 text-[13px] font-semibold text-grape hover:underline">{open ? "Show less" : `Show all ${p.actions.length}`}</button>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[13px] font-semibold">
        {p.kind === "dapp" && p.status.startsWith("live") && <Link href={`/marketplace/${p.slug}`} className="text-ink hover:text-grape">Add to your team</Link>}
        <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink/60 hover:text-grape"><Icon name="globe" size={13} />Website</a>
        <a href={p.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink/60 hover:text-grape"><Icon name="list" size={13} />Docs</a>
      </div>
    </article>
  );
}

export default function IntegrationsPage() {
  const [cat, setCat] = useState<(typeof PROTOCOL_CATS)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const cats = PROTOCOL_CATS.filter((c) => c.id === "all" || PROTOCOLS.some((p) => p.category === c.id));
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return PROTOCOLS.filter((p) => (cat === "all" || p.category === cat) && (!t || `${p.name} ${p.description} ${p.chains.join(" ")}`.toLowerCase().includes(t)));
  }, [cat, q]);
  const actionCount = PROTOCOLS.reduce((n, p) => n + p.actions.length, 0);
  const chainCount = new Set(PROTOCOLS.flatMap((p) => p.chains)).size;
  return (
    <>
      <PageHead
        kicker="Integrations"
        title="Protocols your agents use."
        body="The protocols your agents can use today, what they can do with each one, and where it runs. Anything that moves money waits for your Confirm."
        right={<a href={APPLY_URL} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-grape px-6 text-[15px] font-bold text-white transition hover:bg-grape-deep hover:shadow-[0_14px_30px_-14px_rgba(91,43,255,.8)]"><Icon name="plus" size={17} />Integrate your protocol</a>}
      />

      <div data-rise className="mt-6 grid grid-cols-3 gap-3 max-[430px]:gap-2">
        {[[PROTOCOLS.length, "protocols"], [actionCount, "agent actions"], [chainCount, "networks"]].map(([n, l]) => (
          <div key={l as string} className="rounded-[20px] bg-card px-4 py-3.5 ring-1 ring-line max-[430px]:px-3">
            <p className="display text-[34px] leading-none text-ink max-[430px]:text-[28px]">{n}</p>
            <p className="mt-1 text-[13px] font-semibold text-ink/60">{l}</p>
          </div>
        ))}
      </div>

      <div data-rise className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-bar -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Category">
          {cats.map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-bold transition ${cat === c.id ? "bg-ink text-[var(--bg)]" : "bg-tint text-ink/70 hover:text-ink"}`}>{c.label}</button>
          ))}
        </div>
        <label className="relative sm:w-[260px]">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/45"><Icon name="search" size={16} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search protocols or chains" aria-label="Search protocols" className="h-10 w-full rounded-full bg-tint pl-10 pr-4 text-[14px] text-ink outline-none ring-grape placeholder:text-ink/45 focus:ring-2" />
        </label>
      </div>

      <div key={`${cat}-${q}`} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p, i) => <Card key={p.slug} p={p} i={i} />)}
      </div>
      {!list.length && <p className="mt-10 text-center text-[15px] text-ink/60">No protocols match that yet.</p>}

      <section data-rise className="relative mt-10 overflow-hidden rounded-[30px] p-7 text-white sm:p-10" style={{ background: "linear-gradient(120deg, #0a0a0a 0%, #1d0f5c 55%, #5b2bff 100%)" }}>
        <div className="grain pointer-events-none absolute inset-0" />
        <div className="relative z-10 max-w-[620px]">
          <span className="label rounded-full bg-white/15 px-2.5 py-1 text-[9px] backdrop-blur">For protocols</span>
          <h2 className="display mt-4 text-[40px] leading-[.95] sm:text-[56px]">Bring your protocol to Lexari.</h2>
          <p className="mt-3 text-[15.5px] text-white/75">Open a pull request with your protocol&apos;s entry in the integrations folder. Once it&apos;s reviewed and merged, your protocol becomes a dApp people add to their team. Your tools run on your servers, never see a key, and every payment is a Confirm card the person approves. Testnet only during the alpha.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={APPLY_URL} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-ink transition hover:scale-[1.03]">Read the apply guide</a>
            <a href={NEW_PR_URL} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center rounded-full bg-white/15 px-6 text-[15px] font-bold backdrop-blur transition hover:bg-white/25">Open a pull request</a>
          </div>
        </div>
      </section>
    </>
  );
}
