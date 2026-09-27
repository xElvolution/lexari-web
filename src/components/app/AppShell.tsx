"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { PLANS } from "@/content/appData";
import { agentName, planOf, startDemo, tick, useApp, type State } from "@/lib/store";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import Face from "../Face";
import Icon from "./Icon";
import { AgentFace, SpecFace } from "./faces";
import { DemoTag } from "./ui";
import Toaster from "./Toaster";

export const NAV = [
  { href: "/app", label: "Home", icon: "home" },
  { href: "/app/chat", label: "Chats", icon: "chat" },
  { href: "/app/memory", label: "Brain", icon: "memory" },
  { href: "/app/marketplace", label: "Market", icon: "market" },
  { href: "/app/team", label: "Team", icon: "team" },
  { href: "/app/jobs", label: "Jobs", icon: "jobs" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];
const isOn = (path: string, href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

function SeatMeter({ s }: { s: State }) {
  const p = planOf(s); const shown = Math.min(p.seats, 20);
  return (
    <Link href="/app/team" data-seat-target className="block rounded-[20px] bg-card p-3.5 ring-1 ring-line transition hover:ring-grape/50">
      <div className="flex items-center justify-between"><span className="label text-[9.5px] text-ink/65">Seats · {p.name}</span><span className="label tab-num text-[10px] text-brand-ink">{1 + s.hired.length}/{p.seats}</span></div>
      <div className="mt-2.5 grid grid-cols-10 gap-1">
        {Array.from({ length: shown }).map((_, i) => (
          <span key={i} className={`aspect-square rounded-[4px] ${i === 0 ? "bg-grape" : i <= s.hired.length ? "bg-lilac" : "border border-dashed border-ink/30"}`} />
        ))}
      </div>
    </Link>
  );
}

function Sidebar({ s, path }: { s: State; path: string }) {
  const running = s.jobs.filter((j) => j.status === "running");
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line bg-alt px-4 pb-4 pt-5 lg:flex">
      <Link href="/" aria-label="Lexari home" className="px-2"><Logo /></Link>
      <Link href="/app/settings" className="grain carpet-w relative mt-6 flex items-center gap-3 overflow-hidden rounded-[22px] bg-grape p-3 text-white shadow-[0_6px_0_#3514b0] transition hover:-translate-y-0.5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#0a0a0a]"><AgentFace look={s.agent?.look} size={46} track /></span>
        <span className="relative min-w-0">
          <span className="display block truncate text-[26px] leading-none">{agentName(s)}</span>
          <span className="label mt-1.5 flex items-center gap-1.5 text-[9px] text-white/85"><i className={`h-1.5 w-1.5 rounded-full bg-white ${running.length ? "live-dot" : ""}`} />{running.length ? `working · ${running.length} job${running.length > 1 ? "s" : ""}` : "online"}</span>
        </span>
      </Link>
      <nav className="mt-5 grid gap-1" aria-label="App">
        {NAV.map((n) => {
          const on = isOn(path, n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={`group relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-semibold transition ${on ? "bg-card text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink/75 hover:bg-tint hover:text-ink"}`}>
              {on && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-grape" />}
              <Icon name={n.icon} size={20} className={on ? "text-brand-ink" : "transition group-hover:scale-110"} />
              {n.label}
              {n.href === "/app/jobs" && running.length > 0 && <span className="label ml-auto rounded-full bg-grape px-1.5 py-0.5 text-[9px] text-white">{running.length}</span>}
            </Link>
          );
        })}
      </nav>
      {s.hired.length > 0 && (
        <div className="mt-5 px-1">
          <span className="label text-[9.5px] text-ink/60">Hired</span>
          <div className="mt-2 flex -space-x-2">
            {s.hired.slice(0, 7).map((h) => <Link key={h} href={`/app/chat/${h}`} title={`Chat with ${h}`} className="grid h-9 w-9 place-items-center rounded-full bg-tint ring-2 ring-alt transition hover:z-10 hover:-translate-y-1"><SpecFace slug={h} size={30} /></Link>)}
          </div>
        </div>
      )}
      <div className="mt-auto grid gap-3">
        <SeatMeter s={s} />
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 px-1">
            <div className="truncate text-[13px] font-bold text-ink">{s.auth?.label}</div>
            <div className="flex items-center gap-1 text-[12px] text-ink/65"><Icon name={s.auth?.method === "wallet" ? "wallet" : "google"} size={12} />{s.auth?.method === "wallet" ? s.auth.sub : "Google"}</div>
          </div>
          <ThemeToggle />
        </div>
        <DemoTag className="self-start" />
      </div>
    </aside>
  );
}

function MobileBars({ s, path }: { s: State; path: string }) {
  const items = NAV.slice(0, 6);
  const idx = Math.max(0, items.findIndex((n) => isOn(path, n.href)));
  const onSettings = path.startsWith("/app/settings");
  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-base/85 px-4 backdrop-blur-md lg:hidden">
        <Link href="/app" aria-label="Home"><span className="inline-block origin-left scale-90"><Logo /></span></Link>
        <div className="flex items-center gap-2">
          <DemoTag className="hidden min-[400px]:inline-flex" />
          <ThemeToggle />
          <Link href="/app/settings" aria-label="Settings and profile" className={`grid h-11 w-11 place-items-center rounded-full bg-grape ring-2 transition ${onSettings ? "ring-ink" : "ring-transparent"}`}><AgentFace look={s.agent?.look} size={34} /></Link>
        </div>
      </header>
      <nav aria-label="App" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-base/92 backdrop-blur-md lg:hidden">
        <div className="relative mx-auto grid h-[68px] max-w-[560px] grid-cols-6">
          {!onSettings && <span aria-hidden className="absolute top-2 h-9 w-12 rounded-full bg-grape transition-transform duration-500 [transition-timing-function:cubic-bezier(.3,1.5,.5,1)]" style={{ left: `calc(100% / 12 - 24px)`, transform: `translateX(calc(${idx} * (min(100vw, 560px) / 6)))` }} />}
          {items.map((n, i) => {
            const on = !onSettings && i === idx;
            return (
              <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} {...(n.href === "/app/team" ? { "data-seat-target": true } : {})} className="relative flex flex-col items-center justify-start gap-1 pt-2.5">
                <span className={`grid h-8 place-items-center transition ${on ? "text-white" : "text-ink/70"}`}><Icon name={n.icon} size={21} /></span>
                <span className={`text-[11px] font-bold ${on ? "text-ink" : "text-ink/65"}`}>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function Loading() {
  return (
    <div className="min-h-screen bg-base lg:pl-[264px]" aria-busy="true" aria-label="Loading">
      <div className="fixed inset-y-0 left-0 hidden w-[264px] border-r border-line bg-alt p-5 lg:block">
        <div className="skel h-7 w-28" /><div className="skel mt-6 h-20" />
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel mt-3 h-11" />)}
      </div>
      <div className="mx-auto max-w-[1180px] px-5 pt-8 sm:px-8">
        <div className="skel h-4 w-32" /><div className="skel mt-4 h-14 w-2/3 max-w-[520px]" />
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]"><div className="skel h-[380px]" /><div className="skel h-[380px]" /></div>
      </div>
    </div>
  );
}

function Gate({ s }: { s: State }) {
  const signedIn = !!s.auth;
  return (
    <main className="carpet relative grid min-h-screen place-items-center overflow-hidden bg-base px-5 py-16">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[var(--glow)] blur-[130px]" />
      <div className="relative w-full max-w-[460px] rounded-[32px] bg-card p-7 text-center shadow-[0_14px_0_#5b2bff] ring-1 ring-line sm:p-9">
        <div className="bob mx-auto grid h-24 w-24 place-items-center rounded-[26px] bg-[#0a0a0a]"><Face size={80} track /></div>
        <h1 className="display mt-6 text-[40px] text-ink sm:text-[48px]">{signedIn ? "Almost there." : "Your agent is waiting."}</h1>
        <p className="mt-3 text-[16px] text-ink/75">{signedIn ? "You are signed in. Name your agent and it clocks in." : "Sign in with Google or a crypto wallet to meet your agent. Or look around a demo first."}</p>
        <div className="mt-7 grid gap-3">
          {signedIn ? <Link href="/onboarding" className="btn btn-brand">Name your agent →</Link> : <Link href="/signin" className="btn btn-brand">Sign in →</Link>}
          <button onClick={startDemo} className="btn btn-line text-ink">Try the demo</button>
        </div>
        <Link href="/" className="mt-6 inline-block text-[14px] font-semibold text-ink/65 hover:text-brand-ink">Back to lexari</Link>
      </div>
    </main>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const s = useApp();
  const path = usePathname();
  const main = useRef<HTMLDivElement>(null);
  const ready = !!(s && s.auth && s.onboarded && s.agent);

  useEffect(() => { if (!ready) return; tick(); const id = setInterval(() => tick(), 1000); return () => clearInterval(id); }, [ready]);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  useLayoutEffect(() => {
    if (!ready || !main.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-rise]", { y: 28, opacity: 0, duration: 0.75, stagger: 0.06, ease: "back.out(1.5)", clearProps: "transform,opacity" });
    }, main);
    return () => ctx.revert();
  }, [path, ready]);

  if (!s) return <Loading />;
  if (!ready) return <Gate s={s} />;
  const inThread = /^\/app\/chat\/.+/.test(path);
  const bleed = path === "/app/memory" || path.startsWith("/app/chat");
  return (
    <div className="min-h-screen bg-base text-ink">
      <Sidebar s={s} path={path} />
      {!inThread && <MobileBars s={s} path={path} />}
      <div className="lg:pl-[264px]">
        {bleed ? <div key={path}>{children}</div> : <div ref={main} key={path} className="mx-auto max-w-[1240px] px-4 pb-32 pt-6 sm:px-8 sm:pt-9 lg:pb-16">{children}</div>}
      </div>
      <Toaster />
    </div>
  );
}

export const plansList = PLANS;
