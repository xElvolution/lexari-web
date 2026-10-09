"use client";

import { PALETTE } from "@shared/components/avatar";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { compact, storeMeta, type Specialist } from "@/content/appData";
import { hirePriceLabel } from "@/lib/prices";
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
  if (hired) return <Link href={`/agents/${a.slug}`} onClick={(e) => e.stopPropagation()} className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-tint font-bold text-brand-ink transition hover:bg-grape hover:text-white ${cls}`}>Open</Link>;
  return (
    <button ref={me} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void hireWithFx(a.slug, faceEl?.() ?? me.current, () => router.push("/team")); }} className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-grape font-bold text-white transition hover:bg-grape-deep ${cls}`}>
      {a.free ? "Hire · Free" : s.paid?.includes(a.slug) ? "Hire again · free" : <>Hire · {hirePriceLabel()}</>}
    </button>
  );
}

export function StarRow({ v, size = 12 }: { v: number; size?: number }) {
  return <span className="inline-flex items-center gap-0.5 text-brand-ink" aria-label={`${v} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} className={i <= Math.round(v) ? "" : "opacity-25"} />)}</span>;
}

/** Small decorative flip chip in the card's top-right corner; the whole picture is the button. */
const FlipChip = () => <span aria-hidden data-flip-chip className="pointer-events-none absolute right-2.5 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white/90 ring-1 ring-white/15 backdrop-blur-sm"><Icon name="flip" size={13} /></span>;

/**
 * Store tile: tap the picture to flip it (back: rating, hires, skills, price, speed, Open listing).
 * The name and Open link go to the listing. Trending tiles are ~2 per screen on phones.
 * `fill` = take the grid cell's width instead of a fixed shelf width.
 */
export function AppCard({ a, wide = false, fill = false }: { a: Specialist; wide?: boolean; fill?: boolean }) {
  const m = storeMeta(a);
  const face = useRef<HTMLSpanElement>(null);
  const [flipped, setFlipped] = useState(false);
  const href = `/marketplace/${a.slug}`;
  const size = wide ? "w-[300px] sm:w-[320px]" : fill ? "w-full" : "w-[44vw] min-w-[176px] max-w-[290px] sm:w-[272px] lg:w-[248px]";
  const h = wide ? "h-[236px]" : "aspect-[4/5.3]";
  const toggle = () => setFlipped((v) => !v);
  const skills = a.skills.slice(0, wide ? 2 : 3);
  const more = a.skills.length - skills.length;
  return (
    <div data-app-card className={`group flex shrink-0 snap-start flex-col ${size}`}>
      <div role="button" tabIndex={0} data-flip aria-pressed={flipped} aria-label={flipped ? `${a.name} details. Tap to flip back.` : `${a.name}. Tap to flip for details.`}
        onClick={toggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        className={`flip relative block w-full cursor-pointer select-none rounded-[22px] outline-none focus-visible:ring-4 focus-visible:ring-grape/50 ${h} ${flipped ? "is-flipped" : ""}`}>
        <div className="flip-inner">
          <div className="flip-face overflow-hidden rounded-[22px]">
            {wide ? (
              <span data-banner className="relative flex h-full flex-col justify-between overflow-hidden rounded-[22px] p-4 text-white ring-1 ring-white/10" style={{ background: `radial-gradient(80% 110% at 88% 18%, color-mix(in oklab, ${PALETTE[a.color].fill} 78%, transparent) 0%, transparent 62%), radial-gradient(60% 70% at 0% 100%, color-mix(in oklab, ${PALETTE[a.color].shade} 55%, transparent) 0%, transparent 70%), linear-gradient(125deg, #0a0a0a 0%, #1d0f5c 58%, color-mix(in oklab, ${PALETTE[a.color].fill} 45%, #5b2bff) 100%)` }}>
                <span className="grain pointer-events-none absolute inset-0" />
                <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full border-[18px] opacity-25" style={{ borderColor: PALETTE[a.color].fill }} />
                <span aria-hidden className="pointer-events-none absolute right-16 top-6 h-3 w-3 rounded-full opacity-70" style={{ background: PALETTE[a.color].fill }} />
                <span className="relative flex items-center justify-between gap-2 pr-9">
                  <span className="label rounded-full bg-white px-2 py-1 text-[8.5px] text-[#0a0a0a]">New</span>
                  <span className="label truncate text-[8.5px] text-white/70">{a.job}</span>
                </span>
                <span className="relative flex items-end gap-3">
                  <span ref={face} className="shrink-0 drop-shadow-[0_10px_24px_rgba(0,0,0,.45)] transition duration-300 group-hover:scale-105"><AgentTile id={a.slug} look={null} size={84} radius={24} /></span>
                  <span data-quote className="min-w-0 flex-1 pb-1 text-right text-[14px] font-semibold leading-snug text-white/90">&ldquo;{a.quip}&rdquo;</span>
                </span>
              </span>
            ) : (
              <span ref={face} className="block h-full"><AgentTile id={a.slug} look={null} size={176} radius={22} className="!h-full !w-full" face={136} /></span>
            )}
            <FlipChip />
          </div>
          <div data-back className={`flip-face flip-back flex flex-col overflow-hidden rounded-[22px] bg-[#0a0a0a] text-white ring-1 ring-white/10 ${wide ? "p-4" : "p-3.5"}`}>
            <span className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex items-center gap-1 font-bold">{a.rating}<Icon name="star" size={12} className="text-lilac" /></span>
              <span className="whitespace-nowrap text-white/65">{compact(m.hires)} hires</span>
            </span>
            <span className="label mt-2.5 text-[8.5px] text-lilac">Skills</span>
            <ul className="mt-1 space-y-1 text-[12px] leading-[1.3] text-white/85">
              {skills.map(([k]) => <li key={k} className="line-clamp-2">· {k}</li>)}
              {more > 0 && <li className="text-white/45">+{more} more</li>}
            </ul>
            {!wide && <p className="mt-3 line-clamp-3 border-l-2 border-lilac/60 pl-2 text-[12px] italic leading-[1.35] text-white/70 max-[420px]:hidden">&ldquo;{a.quip}&rdquo;</p>}
            <span className="mt-auto flex flex-col gap-1 pt-2 text-[11.5px]">
              <span className="flex items-center gap-2">
                <span className="shrink-0 whitespace-nowrap rounded-full bg-white/15 px-2.5 py-0.5 font-bold">{m.free ? "Free" : "Paid add-ons"}</span>
              </span>
              <span className="text-white/60">{a.speed}</span>
            </span>
            <Link href={href} tabIndex={flipped ? 0 : -1} aria-label={`Open ${a.name}'s listing`} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="mt-2.5 flex h-8 shrink-0 items-center justify-center rounded-full bg-white text-[12.5px] font-bold text-[#0a0a0a] transition hover:bg-lilac">Open listing →</Link>
          </div>
        </div>
      </div>
      <span className="mt-2.5 flex items-start gap-2">
        <Link href={href} className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-ink hover:text-brand-ink">{a.name}</span>
          <span className="line-clamp-2 block text-[12.5px] leading-snug text-ink/55 sm:truncate">{m.maker} · {m.cat}</span>
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
      <div ref={row} onScroll={measure} className="no-bar -mx-4 mt-3 flex snap-x scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-2 pt-1 sm:-mx-8 sm:scroll-px-8 sm:px-8">{children}</div>
    </section>
  );
}
