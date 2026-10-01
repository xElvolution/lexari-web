"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { compact, storeMeta, type Specialist } from "@/content/appData";
import { useApp } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { hireWithFx } from "../hireAction";

/** Hire, or Open once the agent is on your team. */
export function HireBtn({ a, size = "sm", faceEl }: { a: Specialist; size?: "sm" | "lg"; faceEl?: () => HTMLElement | null }) {
  const s = useApp()!;
  const router = useRouter();
  const me = useRef<HTMLButtonElement>(null);
  const hired = s.hired.includes(a.slug);
  const cls = size === "lg" ? "h-12 px-7 text-[16px]" : "h-8 px-4 text-[13px]";
  if (hired) return <Link href={`/app?c=${a.slug}`} onClick={(e) => e.stopPropagation()} className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-tint font-bold text-brand-ink transition hover:bg-grape hover:text-white ${cls}`}>Open</Link>;
  return (
    <button ref={me} onClick={(e) => { e.preventDefault(); e.stopPropagation(); hireWithFx(a.slug, faceEl?.() ?? me.current, () => router.push("/app/team")); }} className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-grape font-bold text-white transition hover:bg-grape-deep ${cls}`}>
      Hire
    </button>
  );
}

export function StarRow({ v, size = 12 }: { v: number; size?: number }) {
  return <span className="inline-flex items-center gap-0.5 text-brand-ink" aria-label={`${v} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} className={i <= Math.round(v) ? "" : "opacity-25"} />)}</span>;
}

/** Store tile: tap the picture to flip it (back: rating, hires, skills, price); the name and Open go to the listing. */
export function AppCard({ a, wide = false }: { a: Specialist; wide?: boolean }) {
  const m = storeMeta(a);
  const face = useRef<HTMLSpanElement>(null);
  const [flipped, setFlipped] = useState(false);
  const href = `/app/marketplace/${a.slug}`;
  const h = wide ? "h-[150px]" : "h-[156px] sm:h-[168px]";
  const toggle = () => setFlipped((v) => !v);
  return (
    <div className={`group flex shrink-0 snap-start flex-col ${wide ? "w-[272px]" : "w-[156px] sm:w-[168px]"}`}>
      <div role="button" tabIndex={0} data-flip aria-pressed={flipped} aria-label={flipped ? `${a.name} details. Tap to flip back.` : `${a.name}. Tap to flip for details.`}
        onClick={toggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        className={`flip relative block w-full cursor-pointer select-none rounded-[22px] outline-none focus-visible:ring-4 focus-visible:ring-grape/50 ${h} ${flipped ? "is-flipped" : ""}`}>
        <div className="flip-inner">
          <div className="flip-face overflow-hidden rounded-[22px]">
            {wide ? (
              <span className="relative block h-full overflow-hidden rounded-[22px] ring-1 ring-line" style={{ background: `linear-gradient(135deg, color-mix(in oklab, var(--color-grape) 30%, var(--card)), var(--card))` }}>
                <span ref={face} className="absolute bottom-3 left-3 transition duration-300 group-hover:scale-105"><AgentTile id={a.slug} look={null} size={72} radius={22} /></span>
                <span className="label absolute right-3 top-3 rounded-full bg-ink px-2 py-1 text-[8.5px] text-[var(--bg)]">New</span>
                <span className="absolute bottom-4 right-4 max-w-[55%] text-right text-[13px] font-semibold leading-snug text-ink/75">&ldquo;{a.quip}&rdquo;</span>
              </span>
            ) : (
              <span ref={face} className="block h-full"><AgentTile id={a.slug} look={null} size={156} radius={22} className="!h-full !w-full" face={120} /></span>
            )}
            <span className="label pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] text-white/85">flip ↻</span>
          </div>
          <div className="flip-face flip-back flex flex-col overflow-hidden rounded-[22px] bg-[#0a0a0a] p-3 text-white ring-1 ring-white/10">
            <span className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-1 font-bold">{a.rating}<Icon name="star" size={11} className="text-lilac" /></span><span className="text-white/65">{compact(m.hires)} hires</span></span>
            <span className="label mt-2 text-[8px] text-lilac">Skills</span>
            <ul className="mt-1 space-y-0.5 text-[12px] leading-tight text-white/85">{a.skills.slice(0, wide ? 2 : 3).map(([k]) => <li key={k} className="truncate">· {k}</li>)}</ul>
            <span className="mt-auto flex items-center justify-between gap-1 text-[11px]"><span className="rounded-full bg-white/15 px-2 py-0.5 font-bold">{m.free ? "Free" : "Paid add-ons"}</span><span className="truncate text-white/55">{a.speed}</span></span>
            <Link href={href} tabIndex={flipped ? 0 : -1} aria-label={`Open ${a.name}'s listing`} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="mt-2 flex h-7 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[#0a0a0a] transition hover:bg-lilac">Open listing →</Link>
          </div>
        </div>
      </div>
      <span className="mt-2.5 flex items-start gap-2">
        <Link href={href} className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-ink hover:text-brand-ink">{a.name}</span>
          <span className="block truncate text-[12.5px] text-ink/55">{m.maker} · {m.cat}</span>
        </Link>
        <span className="pt-0.5"><HireBtn a={a} faceEl={() => face.current} /></span>
      </span>
      <span className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-ink/70"><span className="flex items-center gap-0.5 font-semibold">{a.rating}<Icon name="star" size={11} className="text-brand-ink" /></span><span className="text-ink/35">·</span>{compact(m.hires)} hires<Link href={href} aria-label={`Open ${a.name}'s listing`} className="ml-auto font-bold text-brand-ink hover:underline">Open</Link></span>
    </div>
  );
}

/** A titled row that scrolls sideways, with arrows on wide screens. */
export function ShelfRow({ title, sub, children, more }: { title: string; sub?: string; children: React.ReactNode; more?: { label: string; onClick: () => void } }) {
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: true });
  const measure = () => { const el = row.current; if (el) setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }); };
  useEffect(() => { measure(); const ro = new ResizeObserver(measure); if (row.current) ro.observe(row.current); return () => ro.disconnect(); }, []);
  const go = (d: number) => row.current?.scrollBy({ left: d * row.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section data-rise className="mt-10">
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">{title}</h2>{sub && <p className="mt-0.5 text-[14px] text-ink/55">{sub}</p>}</div>
        <div className="flex items-center gap-1.5">
          {more && <button onClick={more.onClick} className="mr-1 text-[14px] font-bold text-brand-ink hover:underline">{more.label}</button>}
          <button onClick={() => go(-1)} disabled={!edge.l} aria-label={`Scroll ${title} left`} className="hidden h-9 w-9 place-items-center rounded-full bg-tint text-ink transition hover:bg-grape hover:text-white disabled:opacity-30 disabled:hover:bg-tint disabled:hover:text-ink md:grid"><Icon name="left" size={17} /></button>
          <button onClick={() => go(1)} disabled={!edge.r} aria-label={`Scroll ${title} right`} className="hidden h-9 w-9 place-items-center rounded-full bg-tint text-ink transition hover:bg-grape hover:text-white disabled:opacity-30 disabled:hover:bg-tint disabled:hover:text-ink md:grid"><Icon name="right" size={17} /></button>
        </div>
      </div>
      <div ref={row} onScroll={measure} className="no-bar -mx-4 mt-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8">{children}</div>
    </section>
  );
}
