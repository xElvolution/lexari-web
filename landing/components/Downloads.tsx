"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { platforms, statusLabel, androidNote, DOCS_ANDROID, type Platform, type PlatformId } from "@/content/downloads";

/* ---------- OS detection ---------- */
function detectOS(): PlatformId | null {
  if (typeof navigator === "undefined") return null;
  const forced = new URLSearchParams(window.location.search).get("os");
  if (forced && platforms.some((p) => p.id === forced)) return forced as PlatformId;
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/macintosh|mac os x/i.test(ua)) return navigator.maxTouchPoints > 1 ? "ios" : "macos";
  if (/windows/i.test(ua)) return "windows";
  if (/linux|x11|cros/i.test(ua)) return "linux";
  return null;
}

/* ---------- brand mark (rounded square with a dot, brand purple) ---------- */
function Mark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id="lx-dl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f6bff" />
          <stop offset="1" stopColor="#5b2bff" />
        </linearGradient>
      </defs>
      <rect width="72" height="72" rx="22" fill="url(#lx-dl)" />
      <circle cx="36" cy="36" r="12" fill="#fff" />
    </svg>
  );
}

/* ---------- platform glyphs ---------- */
function Glyph({ id, className = "h-6 w-6" }: { id: PlatformId; className?: string }) {
  const c = { className, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;
  switch (id) {
    case "android":
      return (<svg {...c}><path d="M17.6 9.48l1.84-3.18a.38.38 0 00-.66-.38l-1.86 3.22a11.4 11.4 0 00-9.84 0L5.22 5.92a.38.38 0 00-.66.38L6.4 9.48A10.8 10.8 0 001 18h22a10.8 10.8 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" /></svg>);
    case "ios":
    case "macos":
      return (<svg {...c}><path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.88 1.15 9.13.76 1.1 1.67 2.33 2.86 2.29 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.22.87-1.27 1.23-2.5 1.25-2.57-.03-.01-2.4-.92-2.42-3.66zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28z" /></svg>);
    case "windows":
      return (<svg {...c}><path d="M3 5.1l7.4-1v7.1H3V5.1zm0 13.8l7.4 1v-7H3v6zm8.3 1.1L21 21.4V12.9h-9.7V20zm0-15.9v7.1H21V2.6l-9.7 1.5z" /></svg>);
    case "linux":
      return (<svg {...c}><path d="M12 2c-2.2 0-3.6 1.9-3.6 4.6 0 1.4.3 2.3-.5 3.6-1 1.6-2.9 3.9-2.9 6.6 0 .9.2 1.6.6 2.2-.9.3-1.6.9-1.6 1.6 0 1 1.6 1.4 3.4 1.4 1.3 0 2.2-.4 2.8-.9.6.1 1.2.1 1.8 0 .6.5 1.5.9 2.8.9 1.8 0 3.4-.4 3.4-1.4 0-.7-.7-1.3-1.6-1.6.4-.6.6-1.3.6-2.2 0-2.7-1.9-5-2.9-6.6-.8-1.3-.5-2.2-.5-3.6C15.6 3.9 14.2 2 12 2zm-1.4 4.1c.4 0 .7.5.7 1.1s-.3 1.1-.7 1.1-.7-.5-.7-1.1.3-1.1.7-1.1zm2.8 0c.4 0 .7.5.7 1.1s-.3 1.1-.7 1.1-.7-.5-.7-1.1.3-1.1.7-1.1zM12 9.3c.9 0 2 .5 2 .9s-1.1 1-2 1-2-.6-2-1 1.1-.9 2-.9z" /></svg>);
  }
}

/* ---------- the little Lexari screen shown inside every device ---------- */
function Screen({ compact = false, live = true }: { compact?: boolean; live?: boolean }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0b0915] text-white">
      <div className="carpet-w pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#5b2bff]/60 blur-2xl" />
      <div className={`relative flex items-center gap-1.5 ${compact ? "px-2.5 pt-5" : "px-3.5 pt-3.5"}`}>
        <Mark size={compact ? 12 : 16} />
        <span className={`display ${compact ? "text-[11px]" : "text-[14px]"} leading-none`}>lexari</span>
      </div>
      <div className={`relative mt-auto grid gap-1.5 ${compact ? "p-2.5" : "p-3.5"}`}>
        <span className={`dl-bubble ml-auto max-w-[80%] rounded-[10px] rounded-br-[3px] bg-[#5b2bff] ${compact ? "px-2 py-1 text-[7px]" : "px-2.5 py-1.5 text-[9px]"} font-semibold leading-tight`}>Find me a flight to Lisbon</span>
        <span className={`dl-bubble max-w-[85%] rounded-[10px] rounded-bl-[3px] bg-white/12 ${compact ? "px-2 py-1 text-[7px]" : "px-2.5 py-1.5 text-[9px]"} leading-tight text-white/90`} style={{ animationDelay: ".6s" }}>On it. Three options in your inbox.</span>
        {live ? null : <span className="label mt-1 text-center text-[7px] text-lilac">soon</span>}
      </div>
    </div>
  );
}

/* ---------- device mockups ---------- */
function Phone({ live, className = "" }: { live?: boolean; className?: string }) {
  return (
    <div className={`relative aspect-[9/18.5] rounded-[22px] bg-[#1c1730] p-[5px] shadow-[0_24px_50px_-18px_rgba(53,20,176,.55),inset_0_0_0_1px_rgba(255,255,255,.12)] ${className}`}>
      <div className="relative h-full overflow-hidden rounded-[18px]">
        <Screen compact live={live} />
        <span className="absolute left-1/2 top-1.5 h-1.5 w-8 -translate-x-1/2 rounded-full bg-black/80" />
      </div>
    </div>
  );
}
function Laptop({ live, className = "" }: { live?: boolean; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative mx-[7%] aspect-[16/10] rounded-t-[14px] bg-[#1c1730] p-[6px] pb-[8px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]">
        <div className="h-full overflow-hidden rounded-[8px]"><Screen live={live} /></div>
      </div>
      <div className="relative h-[10px] rounded-b-[14px] rounded-t-[3px] bg-gradient-to-b from-[#3a3256] to-[#1c1730] shadow-[0_24px_40px_-18px_rgba(53,20,176,.6)]">
        <span className="absolute left-1/2 top-0 h-[4px] w-[18%] -translate-x-1/2 rounded-b-[4px] bg-black/40" />
      </div>
    </div>
  );
}
function Monitor({ live, className = "" }: { live?: boolean; className?: string }) {
  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div className="w-full rounded-[12px] bg-[#1c1730] p-[6px] shadow-[0_24px_40px_-20px_rgba(53,20,176,.6),inset_0_0_0_1px_rgba(255,255,255,.12)]">
        <div className="aspect-[16/9.4] overflow-hidden rounded-[7px]"><Screen live={live} /></div>
      </div>
      <span className="h-5 w-[16%] bg-gradient-to-b from-[#2a2342] to-[#1c1730]" />
      <span className="h-[6px] w-[34%] rounded-full bg-[#1c1730]" />
    </div>
  );
}
function Device({ p, className }: { p: Platform; className?: string }) {
  const live = p.status === "live";
  if (p.device === "phone") return <Phone live={live} className={className} />;
  if (p.device === "laptop") return <Laptop live={live} className={className} />;
  return <Monitor live={live} className={className} />;
}

/* ---------- status pill ---------- */
function Pill({ p }: { p: Platform }) {
  const live = p.status === "live";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${live ? "bg-grape text-white" : "bg-tint text-ink/75"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "dl-ping bg-white" : "bg-brand-ink"}`} />
      {statusLabel[p.status]}
    </span>
  );
}

function Meta({ p }: { p: Platform }) {
  const items = [p.version && `Version ${p.version}`, p.size, p.requires].filter(Boolean) as string[];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink/60">
      {items.map((t) => <li key={t} className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-brand-ink" />{t}</li>)}
    </ul>
  );
}

function Action({ p, big = false }: { p: Platform; big?: boolean }) {
  if (p.status === "live" && p.url) {
    return (
      <a href={p.url} className={`btn btn-brand ${big ? "" : "!h-12 !px-5 !text-[15px]"} w-full sm:w-auto`} download={p.file}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" /></svg>
        Download for {p.name}
      </a>
    );
  }
  return (
    <span aria-disabled className={`btn btn-ghost ${big ? "" : "!h-12 !px-5 !text-[15px]"} w-full cursor-default sm:w-auto`}>
      {p.status === "testflight" ? "TestFlight soon" : "Coming soon"}
    </span>
  );
}

function AndroidNote({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`rounded-[20px] border-2 border-dashed border-line bg-base/60 p-4 ${wide ? "sm:p-5" : ""}`}>
      <p className="label text-brand-ink">{androidNote.title}</p>
      <ol className="mt-2.5 grid gap-1.5 text-[14px] leading-snug text-ink/75">
        {androidNote.steps.map((s, i) => (
          <li key={s} className="flex gap-2.5"><span className="display grid h-5 w-5 shrink-0 place-items-center rounded-full bg-tint text-[11px] text-brand-ink">{i + 1}</span>{s}</li>
        ))}
      </ol>
      <a href={DOCS_ANDROID} className="mt-3 inline-flex items-center gap-1 text-[14px] font-bold text-brand-ink underline-offset-4 hover:underline">{androidNote.link} <span aria-hidden>↗</span></a>
    </div>
  );
}

/* ---------- featured card (visitor's platform) ---------- */
function Featured({ p, detected }: { p: Platform; detected: boolean }) {
  return (
    <article className="dl-card relative grid overflow-hidden rounded-[36px] bg-card p-6 shadow-[0_0_0_2px_var(--color-grape),0_30px_80px_-40px_rgba(91,43,255,.7)] sm:p-10 lg:grid-cols-[1.15fr_.85fr] lg:gap-10">
      <div className="carpet pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_left,#000,transparent_60%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2.5">
          {detected && <span className="label rounded-full border-2 border-grape px-3 py-1 text-[10px] text-brand-ink">Your device</span>}
          <Pill p={p} />
        </div>
        <h2 className="display mt-5 flex items-center gap-3 text-[clamp(2.6rem,5vw,4.4rem)]">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-tint text-brand-ink sm:h-16 sm:w-16"><Glyph id={p.id} className="h-8 w-8 sm:h-9 sm:w-9" /></span>
          Lexari for {p.name}
        </h2>
        <p className="mt-4 max-w-[34rem] text-[17px] leading-relaxed text-ink/75">{p.blurb}</p>
        <div className="mt-5"><Meta p={p} /></div>
        <div className="mt-7"><Action p={p} big /></div>
        {p.id === "android" && <div className="mt-7 max-w-[34rem]"><AndroidNote wide /></div>}
      </div>
      <div className="relative mt-10 flex items-center justify-center lg:mt-0">
        <div className="pointer-events-none absolute h-[80%] w-[80%] rounded-full bg-[var(--glow)] blur-[70px]" />
        <div className="dl-float relative w-full max-w-[420px]">
          <Device p={p} className={p.device === "phone" ? "mx-auto w-[42%] min-w-[140px] max-w-[190px] rotate-[-4deg]" : "w-full"} />
        </div>
      </div>
    </article>
  );
}

/* ---------- small card ---------- */
function Card({ p }: { p: Platform }) {
  return (
    <article className="dl-card group relative flex w-full flex-col rounded-[30px] bg-card p-5 shadow-[0_0_0_1px_var(--line)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_0_0_2px_var(--color-grape-soft),0_24px_50px_-30px_rgba(91,43,255,.6)] sm:p-6">
      <div className="relative flex h-[170px] items-end justify-center overflow-hidden rounded-[22px] bg-tint px-6 pt-6">
        <div className="carpet pointer-events-none absolute inset-0" />
        <div className="relative w-full transition duration-500 group-hover:-translate-y-1.5">
          <Device p={p} className={p.device === "phone" ? "mx-auto -mb-10 w-[86px]" : p.device === "laptop" ? "mx-auto w-[92%]" : "mx-auto w-[78%]"} />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-tint text-brand-ink"><Glyph id={p.id} className="h-5 w-5" /></span>
        <h3 className="display text-[30px]">{p.name}</h3>
      </div>
      <div className="mt-3"><Pill p={p} /></div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{p.blurb}</p>
      <div className="mt-3"><Meta p={p} /></div>
      {p.id === "android" && <div className="mt-4"><AndroidNote /></div>}
      <div className="mt-auto pt-5"><Action p={p} /></div>
    </article>
  );
}

/* ---------- page ---------- */
export default function Downloads() {
  /* undefined until detection has run, null when the OS is unknown */
  const [os, setOs] = useState<PlatformId | null | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  useEffect(() => { setOs(detectOS()); }, []);

  const featuredId: PlatformId = os ?? "android";
  const featured = platforms.find((p) => p.id === featuredId)!;
  const rest = useMemo(() => platforms.filter((p) => p.id !== featuredId), [featuredId]);
  const android = platforms.find((p) => p.id === "android")!;

  useEffect(() => {
    if (os === undefined || played.current) return;
    played.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tl!: gsap.core.Timeline;
    gsap.context(() => {
      tl = gsap.timeline({ defaults: { ease: "back.out(1.5)" } });
      tl.from(".dl-word", { yPercent: 110, rotate: 4, duration: 0.9, stagger: 0.08 })
        .from(".dl-lede", { y: 24, opacity: 0, duration: 0.7 }, "-=0.5")
        .from(".dl-stage > *", { y: 80, opacity: 0, rotate: (i) => (i % 2 ? 8 : -8), duration: 1.1, stagger: 0.12 }, "-=0.7");
    }, root);
    return () => { tl.progress(1); };
  }, [os]);

  return (
    <div ref={root}>
      <style>{`
        @keyframes dl-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
        .dl-float { animation: dl-float 6s ease-in-out infinite; }
        .dl-float-2 { animation: dl-float 7s ease-in-out -2s infinite; }
        .dl-float-3 { animation: dl-float 5.5s ease-in-out -1s infinite; }
        @keyframes dl-ping { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,.8) } 100% { box-shadow: 0 0 0 7px rgba(255,255,255,0) } }
        .dl-ping { animation: dl-ping 1.6s ease-out infinite; }
        @keyframes dl-bubble { 0%, 8% { opacity: 0; transform: translateY(6px) scale(.9) } 16%, 86% { opacity: 1; transform: none } 96%,100% { opacity: 0 } }
        .dl-bubble { animation: dl-bubble 5s cubic-bezier(.3,1.4,.5,1) infinite both; }
        @keyframes dl-in { from { opacity: 0; transform: translateY(60px) rotate(1.2deg) } to { opacity: 1; transform: none } }
        .dl-in { animation: dl-in .9s cubic-bezier(.3,1.35,.5,1) both; }
        @keyframes dl-orbit { to { transform: rotate(360deg) } }
        .dl-orbit { animation: dl-orbit 40s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .dl-float,.dl-float-2,.dl-float-3,.dl-ping,.dl-bubble,.dl-orbit,.dl-in { animation: none } }
      `}</style>

      {/* hero */}
      <section id="top" className="relative overflow-hidden bg-base pb-28 pt-28 text-ink sm:pb-36 sm:pt-36">
        <div className="carpet pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,#000,transparent_85%)]" />
        <div className="pointer-events-none absolute -left-40 top-1/3 h-[520px] w-[520px] rounded-full bg-[var(--glow)] blur-[120px]" />
        <div className="pointer-events-none absolute right-[-6%] top-[4%] h-[640px] w-[640px] rounded-full bg-[var(--glow)] blur-[130px]" />
        <div className="relative mx-auto grid max-w-[1320px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="label text-brand-ink">Download</p>
            <h1 className="display mt-4 text-[clamp(3.1rem,7vw,6.4rem)]">
              <span className="block overflow-hidden pb-[0.06em]"><span className="dl-word inline-block">Lexari,</span> <span className="dl-word inline-block">on</span> <span className="dl-word inline-block">every</span></span>
              <span className="block overflow-hidden pb-[0.08em] text-brand-ink"><span className="dl-word inline-block">screen</span> <span className="dl-word inline-block">you</span> <span className="dl-word inline-block">own.</span></span>
            </h1>
            <p className="dl-lede mt-6 max-w-[34rem] text-[17px] leading-[1.6] text-ink/75 sm:text-[19px]">
              One agent, one memory, every device. Android is ready today. iPhone, Mac, Windows and Linux are on the way.
            </p>
            <div className="dl-lede mt-9 flex flex-col gap-4 sm:flex-row">
              {featured.status === "live" && featured.url
                ? <a href={featured.url} download={featured.file} className="btn btn-brand">Download for {featured.name} <span aria-hidden>↓</span></a>
                : <a href={android.url} download={android.file} className="btn btn-brand">Get the Android app <span aria-hidden>↓</span></a>}
              <a href="#apps" className="btn btn-line text-ink">See all platforms</a>
            </div>
            <p className="dl-lede label mt-5 text-[10px] text-ink/55">
              {os ? <>We spotted {platforms.find((p) => p.id === os)!.name}. It is first in the list below.</> : <>Pick your platform below.</>}
            </p>
          </div>

          {/* device stage */}
          <div className="relative mx-auto aspect-[1/0.82] w-full max-w-[600px]">
            <div aria-hidden className="dl-orbit pointer-events-none absolute inset-[6%] rounded-full border-2 border-dashed border-line" />
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--glow)] blur-[60px]" />
            <div className="dl-stage absolute inset-0">
              <div className="absolute left-[4%] top-[14%] w-[74%]"><div className="dl-float-2"><Laptop live /></div></div>
              <div className="absolute right-[2%] top-[2%] w-[38%]"><div className="dl-float-3"><Monitor live /></div></div>
              <div className="absolute bottom-[0%] right-[8%] w-[22%] min-w-[96px]"><div className="dl-float"><Phone live className="rotate-[6deg]" /></div></div>
              <div className="absolute bottom-[8%] left-[0%]"><div className="dl-float-3 grid h-16 w-16 place-items-center rounded-[22px] bg-card shadow-[0_0_0_1px_var(--line),0_20px_40px_-20px_rgba(91,43,255,.6)] sm:h-20 sm:w-20"><Mark size={44} /></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* apps */}
      <section id="apps" className="sheet bg-alt pb-28 pt-16 text-ink sm:pb-36 sm:pt-24">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="reveal display text-[clamp(2.4rem,5vw,4rem)]">Pick your screen</h2>
            <p className="reveal max-w-[28rem] text-[16px] leading-relaxed text-ink/70">Sign in with the same account everywhere. Your agent, its memory and its desk follow you.</p>
          </div>
          <div className="dl-in" style={{ animationDelay: ".3s" }}><Featured p={featured} detected={os === featured.id} /></div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((p, i) => <div key={p.id} className="dl-in flex" style={{ animationDelay: `${0.45 + i * 0.09}s` }}><Card p={p} /></div>)}
          </div>
        </div>
      </section>
    </div>
  );
}
