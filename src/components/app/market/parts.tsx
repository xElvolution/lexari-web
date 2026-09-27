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

/** Store tile: square avatar, name, maker, category and rating. */
export function AppCard({ a, wide = false }: { a: Specialist; wide?: boolean }) {
  const m = storeMeta(a);
  const face = useRef<HTMLSpanElement>(null);
  return (
    <Link href={`/app/marketplace/${a.slug}`} className={`group flex shrink-0 snap-start flex-col ${wide ? "w-[272px]" : "w-[156px] sm:w-[168px]"}`}>
      {wide ? (
        <span className="relative block h-[150px] overflow-hidden rounded-[22px] ring-1 ring-line" style={{ background: `linear-gradient(135deg, color-mix(in oklab, var(--color-grape) 30%, var(--card)), var(--card))` }}>
          <span ref={face} className="absolute bottom-3 left-3 transition duration-300 group-hover:scale-105"><AgentTile id={a.slug} look={null} size={72} radius={22} /></span>
          <span className="label absolute right-3 top-3 rounded-full bg-ink px-2 py-1 text-[8.5px] text-[var(--bg)]">New</span>
          <span className="absolute bottom-4 right-4 max-w-[55%] text-right text-[13px] font-semibold leading-snug text-ink/75">&ldquo;{a.quip}&rdquo;</span>
        </span>
      ) : (
        <span ref={face} className="block transition duration-300 group-hover:-translate-y-1"><AgentTile id={a.slug} look={null} size={156} radius={36} className="!h-[156px] !w-full sm:!h-[168px]" face={120} /></span>
      )}
      <span className="mt-2.5 flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-ink">{a.name}</span>
          <span className="block truncate text-[12.5px] text-ink/55">{m.maker} · {m.cat}</span>
        </span>
        <span className="pt-0.5"><HireBtn a={a} faceEl={() => face.current} /></span>
      </span>
      <span className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-ink/70"><span className="flex items-center gap-0.5 font-semibold">{a.rating}<Icon name="star" size={11} className="text-brand-ink" /></span><span className="text-ink/35">·</span>{compact(m.hires)} hires</span>
    </Link>
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
