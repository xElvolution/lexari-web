"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PALETTE } from "@shared/components/avatar";
import { SPECIALISTS, STORE_CATS, compact, storeMeta, type StoreCat } from "@/content/appData";
import { planOf, seatsLeft, useApp } from "@/lib/store";
import Icon from "@/components/Icon";
import { AgentTile } from "@/components/faces";
import { Empty } from "@/components/ui";
import { AppCard, HireBtn, ShelfRow } from "@/components/market/parts";

const FEATURED = ["scout", "frame", "atlas"];
const byHires = [...SPECIALISTS].sort((a, b) => storeMeta(b).hires - storeMeta(a).hires);

function Hero() {
  const list = FEATURED.map((f) => SPECIALISTS.find((x) => x.slug === f)!);
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const go = (n: number) => { const k = (n + list.length) % list.length; setI(k); const el = track.current; if (el) el.scrollTo({ left: k * el.clientWidth, behavior: "smooth" }); };
  useEffect(() => { const t = setInterval(() => { if (!paused.current && !document.hidden) go(i + 1); }, 6500); return () => clearInterval(t); }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section data-rise className="relative mt-6" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)} aria-roledescription="carousel" aria-label="Agent of the week">
      <div ref={track} onScroll={(e) => { const el = e.currentTarget; const k = Math.round(el.scrollLeft / el.clientWidth); if (k !== i) setI(k); }} className="no-bar flex snap-x snap-mandatory overflow-x-auto rounded-[30px]">
        {list.map((a, k) => {
          const m = storeMeta(a); const col = PALETTE[a.color].fill;
          return (
            <article key={a.slug} aria-roledescription="slide" aria-label={`${k + 1} of ${list.length}`} className="relative flex min-h-[300px] w-full shrink-0 snap-start overflow-hidden text-white sm:min-h-[340px]" style={{ background: `radial-gradient(90% 120% at 85% 30%, color-mix(in oklab, ${col} 70%, transparent) 0%, transparent 60%), linear-gradient(120deg, #0a0a0a 0%, #1d0f5c 55%, #5b2bff 100%)` }}>
              <div className="grain pointer-events-none absolute inset-0" />
              <div className="relative z-10 flex max-w-[560px] flex-col justify-end p-6 sm:p-9">
                <span className="label w-fit rounded-full bg-white/15 px-2.5 py-1 text-[9px] backdrop-blur">{k === 0 ? "Agent of the week" : k === 1 ? "Editors' choice" : "Staff favourite"}</span>
                <h2 className="display mt-4 text-[56px] leading-[.9] sm:text-[80px]">{a.name}</h2>
                <p className="mt-2 text-[17px] font-semibold text-white/90 sm:text-[19px]">{a.quip}</p>
                <p className="mt-2 max-w-[440px] text-[14.5px] text-white/70">{a.back}</p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <HireBtn a={a} size="lg" />
                  <Link href={`/app/marketplace/${a.slug}`} className="inline-flex h-12 items-center rounded-full bg-white/15 px-6 text-[15px] font-bold backdrop-blur transition hover:bg-white/25">View listing</Link>
                  <span className="flex items-center gap-2 text-[13.5px] text-white/80"><span className="flex items-center gap-1 font-bold text-white">{a.rating}<Icon name="star" size={13} /></span>· {compact(m.hires)} hires · {m.cat}</span>
                </div>
              </div>
              <div className="pointer-events-none absolute -right-6 bottom-[-30px] hidden sm:block md:right-8 md:bottom-[-10px]"><AgentTile id={a.slug} look={null} size={300} radius={80} face={250} className="rotate-[-6deg] shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]" /></div>
              <div className="pointer-events-none absolute -right-8 -top-8 sm:hidden"><AgentTile id={a.slug} look={null} size={150} radius={44} className="rotate-[-8deg] opacity-90" /></div>
            </article>
          );
        })}
      </div>
      <div className="absolute bottom-5 right-6 z-10 flex items-center gap-2">
        <button onClick={() => go(i - 1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"><Icon name="left" size={17} /></button>
        <div className="flex gap-1.5">{list.map((_, k) => <button key={k} onClick={() => go(k)} aria-label={`Slide ${k + 1}`} aria-current={k === i} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-2 bg-white/45"}`} />)}</div>
        <button onClick={() => go(i + 1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"><Icon name="right" size={17} /></button>
      </div>
    </section>
  );
}

const CHART_TABS = [{ id: "free", label: "Free" }, { id: "hired", label: "Top hired" }, { id: "rising", label: "Rising" }] as const;
function TopCharts() {
  const [tab, setTab] = useState<(typeof CHART_TABS)[number]["id"]>("hired");
  const list = useMemo(() => {
    const all = [...SPECIALISTS];
    if (tab === "free") return all.filter((a) => storeMeta(a).free).sort((a, b) => b.rating - a.rating || storeMeta(b).hires - storeMeta(a).hires);
    if (tab === "rising") return all.sort((a, b) => storeMeta(b).rising - storeMeta(a).rising);
    return byHires;
  }, [tab]).slice(0, 10);
  return (
    <section data-rise className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">Top charts</h2><p className="mt-0.5 text-[14px] text-ink/55">Updated daily</p></div>
        <div className="inline-flex rounded-full bg-tint p-1" role="tablist" aria-label="Chart">
          {CHART_TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-full px-4 py-2 text-[13.5px] font-bold transition ${tab === t.id ? "bg-card text-ink shadow-sm" : "text-ink/60 hover:text-ink"}`}>{t.label}</button>)}
        </div>
      </div>
      <ol key={tab} className="mt-4 grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3 xl:grid-flow-col xl:grid-rows-4">
        {list.map((a, k) => { const m = storeMeta(a); return (
          <li key={a.slug} className="pop" style={{ animationDelay: `${k * 30}ms` }}>
            <Link href={`/app/marketplace/${a.slug}`} className="group flex items-center gap-3.5 border-b border-line py-3">
              <span className="display tab-num w-7 shrink-0 text-center text-[26px] text-ink/35 group-hover:text-brand-ink">{k + 1}</span>
              <AgentTile id={a.slug} look={null} size={56} radius={16} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold text-ink">{a.name}</span><span className="block truncate text-[12.5px] text-ink/55">{m.cat} · {m.maker}</span><span className="flex items-center gap-1.5 text-[12px] text-ink/65"><span className="flex items-center gap-0.5 font-semibold">{a.rating}<Icon name="star" size={10} className="text-brand-ink" /></span>· {compact(m.hires)}{tab === "free" && <span className="label ml-1 rounded bg-tint px-1 text-[8px] text-brand-ink">Free</span>}{tab === "rising" && <span className="ml-1 text-brand-ink">▲ {3 + ((k * 5) % 9)}</span>}</span></span>
              <HireBtn a={a} />
            </Link>
          </li>
        ); })}
      </ol>
    </section>
  );
}

function Picks() {
  const picks = [
    { title: "A research desk in two hires", body: "Scout reads everything, Sonar watches the market. Together they turn a week of reading into a page.", who: ["scout", "sonar"], tag: "Editors' pick" },
    { title: "Ship your launch week", body: "Quill writes the post, Frame makes the cards, Pulse schedules it all. You just say go.", who: ["quill", "frame", "pulse"], tag: "Collection" },
  ];
  return (
    <section data-rise className="mt-12">
      <h2 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">Editors&apos; picks</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {picks.map((p) => (
          <article key={p.title} className="group relative overflow-hidden rounded-[26px] bg-card p-6 ring-1 ring-line">
            <span className="label text-[9px] text-brand-ink">{p.tag}</span>
            <h3 className="display mt-2 text-[32px] leading-[.95] text-ink">{p.title}</h3>
            <p className="mt-2 max-w-[28rem] text-[14.5px] text-ink/65">{p.body}</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex -space-x-3">{p.who.map((w) => <Link key={w} href={`/app/marketplace/${w}`} className="transition hover:z-10 hover:-translate-y-1"><AgentTile id={w} look={null} size={52} className="ring-4 ring-[var(--card)]" /></Link>)}</div>
              <span className="text-[13.5px] font-semibold text-ink/65">{p.who.map((w) => SPECIALISTS.find((x) => x.slug === w)!.name).join(", ")}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Marketplace() {
  const s = useApp()!;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<StoreCat | "All">("All");
  useEffect(() => { const c = new URLSearchParams(window.location.search).get("cat"); const hit = STORE_CATS.find((x) => x.id.toLowerCase() === c?.toLowerCase()); if (hit) setCat(hit.id); }, []);
  const left = seatsLeft(s);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return SPECIALISTS.filter((a) => (cat === "All" || storeMeta(a).cat === cat) && (!t || `${a.name} ${a.job} ${a.cat} ${a.back} ${storeMeta(a).maker}`.toLowerCase().includes(t)));
  }, [q, cat]);
  const browsing = !!q.trim() || cat !== "All";
  const trending = [...SPECIALISTS].sort((a, b) => b.reviews / b.jobs - a.reviews / a.jobs);
  const fresh = SPECIALISTS.filter((a) => storeMeta(a).isNew).concat(SPECIALISTS.slice(4, 6));

  return (
    <>
      <div data-rise className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2.5"><span className="label text-brand-ink">Marketplace</span></div>
          <h1 className="display mt-3 text-[44px] text-ink sm:text-[60px]">Find your next hire.</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative sm:w-[320px]">
            <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents, makers, skills" aria-label="Search the marketplace" className="h-12 w-full rounded-full bg-tint pl-11 pr-4 text-[15px] text-ink outline-none ring-grape placeholder:text-ink/45 focus:ring-2" />
          </label>
          <Link href="/app/team" className={`label flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[9.5px] ${left > 0 ? "bg-card text-ink ring-1 ring-line" : "bg-ink text-[var(--bg)]"}`}><Icon name="team" size={14} />{left > 0 ? `${left} open seat${left > 1 ? "s" : ""} · ${planOf(s).name}` : "No open seats"}</Link>
        </div>
      </div>

      <div data-rise className="no-bar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:-mx-8 sm:px-8" role="tablist" aria-label="Categories">
        {(["All", ...STORE_CATS.map((c) => c.id)] as const).map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-bold transition ${cat === c ? "bg-ink text-[var(--bg)]" : "bg-card text-ink/75 ring-1 ring-line hover:text-ink hover:ring-grape/50"}`}>
            {c !== "All" && <Icon name={STORE_CATS.find((x) => x.id === c)!.icon} size={15} />}{c}
          </button>
        ))}
      </div>

      {browsing ? (
        <section className="mt-8">
          <h2 className="text-[22px] font-bold text-ink">{q ? `Results for “${q}”` : `${cat} agents`}<span className="ml-2 text-[15px] font-semibold text-ink/45">{filtered.length}</span></h2>
          {filtered.length ? <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{filtered.map((a) => <AppCard key={a.slug} a={a} fill />)}</div>
            : <div className="mt-5"><Empty icon="search" title="No agents match." body="Try a different word or category." cta={{ label: "Clear", onClick: () => { setQ(""); setCat("All"); } }} /></div>}
        </section>
      ) : (
        <>
          <Hero />
          <ShelfRow title="Trending now" sub="What people are hiring this week">{trending.map((a) => <AppCard key={a.slug} a={a} />)}</ShelfRow>
          <TopCharts />
          <ShelfRow title="New & notable" sub="Fresh on the marketplace">{fresh.map((a) => <AppCard key={a.slug} a={a} wide />)}</ShelfRow>
          <Picks />
          <section data-rise className="mt-12">
            <h2 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">Browse categories</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STORE_CATS.map((c) => { const n = SPECIALISTS.filter((a) => storeMeta(a).cat === c.id).length; return (
                <button key={c.id} onClick={() => { setCat(c.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="group flex items-center gap-3 rounded-[20px] bg-card p-4 text-left ring-1 ring-line transition hover:ring-grape/60">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-tint text-brand-ink transition group-hover:bg-grape group-hover:text-white"><Icon name={c.icon} size={20} /></span>
                  <span><span className="block text-[15px] font-bold text-ink">{c.id}</span><span className="text-[12.5px] text-ink/55">{n} agent{n === 1 ? "" : "s"}</span></span>
                </button>
              ); })}
            </div>
          </section>
        </>
      )}
    </>
  );
}
