"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { CATEGORIES, SPECIALISTS, type Specialist } from "@/content/appData";
import { planOf, seatsLeft, useApp } from "@/lib/store";
import Icon from "@/components/app/Icon";
import { SpecFace } from "@/components/app/faces";
import { Empty, PageHead } from "@/components/app/ui";
import { hireWithFx } from "@/components/app/hireAction";

gsap.registerPlugin(Flip);
const SORTS = [{ id: "rating", label: "Top rated" }, { id: "jobs", label: "Most jobs" }, { id: "name", label: "A to Z" }] as const;

function Card({ a, hired, i }: { a: Specialist; hired: boolean; i: number }) {
  const [flipped, setFlipped] = useState(false);
  const face = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  return (
    <div data-flip-id={a.slug} className={`flip h-[420px] ${flipped ? "is-flipped" : ""}`}>
      <div className="flip-inner">
        <div role="button" tabIndex={0} onClick={() => setFlipped(true)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setFlipped(true))} aria-label={`${a.name}, ${a.job}. Flip for details.`} className="flip-face flex cursor-pointer flex-col overflow-hidden rounded-[28px] bg-card text-ink shadow-[0_8px_0_var(--tint)] ring-1 ring-line outline-none transition-shadow focus-visible:ring-4 focus-visible:ring-grape/60">
          <div className="carpet relative grid h-[180px] place-items-center bg-tint">
            <span ref={face} className="transition-transform duration-500 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] group-hover:scale-105"><SpecFace slug={a.slug} size={138} /></span>
            <span className="display absolute left-4 top-3 text-[24px] text-ink/30">#{String(i + 1).padStart(2, "0")}</span>
            <span className="label absolute right-4 top-4 flex items-center gap-1 rounded-full bg-ink px-2 py-1 text-[9.5px] text-[var(--bg)]"><Icon name="star" size={10} />{a.rating}</span>
            {hired && <span className="label absolute bottom-3 left-4 rounded-full bg-grape px-2 py-1 text-[9px] text-white">on your team</span>}
          </div>
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-baseline justify-between gap-2"><div className="display text-[40px] text-ink">{a.name}</div><span className="label text-[9px] text-ink/60">{a.cat}</span></div>
            <div className="mt-1 text-[15px] font-semibold text-brand-ink">{a.job}</div>
            <p className="mt-3 rounded-2xl rounded-tl-sm border border-line bg-alt px-3.5 py-2.5 text-[14px] font-semibold leading-snug text-ink">&ldquo;{a.quip}&rdquo;</p>
            <div className="mt-auto flex items-center justify-between border-t-2 border-dashed border-line pt-3.5">
              <span className="text-[13px] text-ink/70"><b className="text-ink">{a.jobs.toLocaleString("en-US")}</b> jobs done</span>
              <span className="label flex items-center gap-1 rounded-full bg-grape px-2.5 py-1.5 text-[9px] text-white"><Icon name="flip" size={11} />flip</span>
            </div>
          </div>
        </div>
        <div className="flip-face flip-back flex flex-col rounded-[28px] bg-[#0a0a0a] p-5 text-white shadow-[0_8px_0_#3514b0] ring-1 ring-white/10">
          <div className="flex items-center justify-between"><span className="label text-[10px] text-lilac">what {a.name} does</span><button onClick={() => setFlipped(false)} aria-label="Flip back" className="grid h-8 w-8 place-items-center rounded-full bg-white/10 transition hover:rotate-180 hover:bg-white/20"><Icon name="flip" size={14} /></button></div>
          <p className="display mt-3 text-[24px] leading-[1.05]">{a.back}</p>
          <ul className="mt-4 grid gap-2">
            {a.skills.slice(0, 3).map(([k, v]) => <li key={k}><div className="flex justify-between text-[12px] text-white/80"><span>{k}</span><span>{v}</span></div><div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-lilac" style={{ width: `${v}%` }} /></div></li>)}
          </ul>
          <div className="mt-auto grid gap-2 pt-4">
            {hired ? <span className="btn !h-12 bg-white/10 !text-[15px] text-white">On your team</span>
              : <button onClick={() => hireWithFx(a.slug, face.current, () => router.push("/app/team"))} className="btn btn-brand !h-12 !text-[15px]">Hire into a seat</button>}
            <Link href={`/app/marketplace/${a.slug}`} className="text-center text-[14px] font-bold text-white/85 hover:text-white">View profile →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const s = useApp()!;
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("rating");
  const grid = useRef<HTMLDivElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return SPECIALISTS.filter((a) => (cat === "All" || a.cat === cat) && (!t || `${a.name} ${a.job} ${a.cat} ${a.back}`.toLowerCase().includes(t)))
      .sort((a, b) => (sort === "rating" ? b.rating - a.rating || b.jobs - a.jobs : sort === "jobs" ? b.jobs - a.jobs : a.name.localeCompare(b.name)));
  }, [cat, q, sort]);

  const capture = () => { if (grid.current) flipState.current = Flip.getState(grid.current.querySelectorAll("[data-flip-id]")); };
  useLayoutEffect(() => {
    if (!flipState.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { flipState.current = null; return; }
    Flip.from(flipState.current, { duration: 0.6, ease: "power3.inOut", absolute: true, stagger: 0.02, onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.6)" }), onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.3 }) });
    flipState.current = null;
  }, [list]);

  const left = seatsLeft(s);
  return (
    <>
      <PageHead kicker="Marketplace" demo title="Hire a specialist." body="Each agent is good at one kind of work. Flip a card to see what it does, then hire it into an open seat next to your agent."
        right={<Link href="/app/team" data-rise className={`label flex items-center gap-2 rounded-full px-3.5 py-2.5 text-[10px] ${left > 0 ? "bg-tint text-ink" : "bg-ink text-[var(--bg)]"}`}><Icon name="team" size={14} />{left > 0 ? `${left} open seat${left > 1 ? "s" : ""} on ${planOf(s).name}` : "No open seats"}</Link>} />

      <div data-rise className="sticky top-16 z-20 -mx-4 mt-7 border-b border-line bg-base/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-[22px] sm:border sm:px-3 lg:top-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
          <div className="flex gap-2 md:contents">
            <label className="relative flex-1 md:order-1 md:max-w-[340px]">
              <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/55" />
              <input value={q} onChange={(e) => { capture(); setQ(e.target.value); }} placeholder="Search agents or skills" aria-label="Search agents" className="field !h-11 !rounded-full !pl-11 !text-[15px]" />
            </label>
            <select value={sort} onChange={(e) => { capture(); setSort(e.target.value as typeof sort); }} aria-label="Sort" className="field !h-11 !w-[132px] shrink-0 !rounded-full !py-0 !text-[14px] md:order-3 md:!w-auto">
              {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className="no-bar -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 md:order-2">
            {CATEGORIES.map((c) => <button key={c} onClick={() => { capture(); setCat(c); }} aria-pressed={cat === c} className="chip !h-10 shrink-0 !px-3.5 !text-[13px]">{c}</button>)}
          </div>
        </div>
      </div>

      <p data-rise className="label mt-5 text-[10px] text-ink/60">{list.length} agent{list.length === 1 ? "" : "s"}{cat !== "All" ? ` in ${cat}` : ""}{q ? ` matching "${q}"` : ""}</p>
      {list.length ? (
        <div ref={grid} data-rise className="mt-3 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => <Card key={a.slug} a={a} i={SPECIALISTS.indexOf(a)} hired={s.hired.includes(a.slug)} />)}
        </div>
      ) : (
        <div className="mt-3"><Empty icon="search" title="No one matches that." body="Try a different word, or clear the filters to see the whole roster." cta={{ label: "Clear filters", onClick: () => { setQ(""); setCat("All"); } }} /></div>
      )}
    </>
  );
}
