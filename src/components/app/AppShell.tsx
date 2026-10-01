"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { PLANS } from "@/content/appData";
import { startDemo, tick, toast, useApp, type State } from "@/lib/store";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import Face from "../Face";
import Icon from "./Icon";
import { DemoTag } from "./ui";
import Toaster from "./Toaster";
import Tour from "./Tour";
import AgentPanel from "./agent/AgentPanel";
import AddAgentDialog from "./agent/AddAgentDialog";

export const NAV = [
  { href: "/app", label: "Agents", icon: "home" },
  { href: "/app/memory", label: "Brain", icon: "memory" },
  { href: "/app/marketplace", label: "Market", icon: "market" },
  { href: "/app/team", label: "Team", icon: "team" },
  { href: "/app/wallets", label: "Wallets", icon: "wallet" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];
const isOn = (path: string, href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
const initials = (s: State) => (s.auth?.method === "wallet" ? "0x" : (s.auth?.label || "You").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase());

/** Slim rail on desktop: icons with small labels, theme and profile at the bottom. */
function Rail({ s, path }: { s: State; path: string }) {
  const onProfile = path.startsWith("/app/profile");
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col items-center border-r border-line bg-alt pb-4 pt-5 lg:flex">
      <Link href="/" aria-label="Lexari home" title="Lexari" className="grid h-10 w-10 place-items-center rounded-[12px] bg-ink transition hover:scale-105"><span className="h-3.5 w-3.5 rounded-full bg-base" /></Link>
      <nav className="mt-6 grid w-full gap-1 px-2" aria-label="App">
        {NAV.map((n) => {
          const on = isOn(path, n.href);
          return (
            <Link key={n.href} href={n.href} data-tour={`nav-${n.label.toLowerCase()}`} aria-current={on ? "page" : undefined} {...(n.href === "/app/team" ? { "data-seat-target": true } : {})} className={`group relative flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-semibold transition ${on ? "text-ink" : "text-ink/60 hover:text-ink"}`}>
              {on && <span className="absolute -left-2 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-grape" />}
              <span className={`grid h-9 w-12 place-items-center rounded-full transition ${on ? "bg-grape text-white" : "group-hover:bg-tint"}`}><Icon name={n.icon} size={20} /></span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-3">
        <ThemeToggle />
        <Link href="/app/profile" data-tour="nav-profile" aria-label="Profile" title={`${s.auth?.label ?? "Profile"}`} className={`grid h-11 w-11 place-items-center rounded-full bg-ink text-[13px] font-bold text-[var(--bg)] ring-2 ring-offset-2 ring-offset-[var(--alt)] transition hover:scale-105 ${onProfile ? "ring-grape" : "ring-transparent"}`}>{initials(s)}</Link>
      </div>
    </aside>
  );
}

type Item = { key: string; label: string; icon: string; href?: string; run?: () => void; soon?: boolean };
const MORE_PATHS = ["/app/wallets", "/app/settings", "/app/profile"];

/** Phone header and bottom nav. "More" lifts the main items away and brings up a second row. */
function MobileBars({ s, path }: { s: State; path: string }) {
  const [more, setMore] = useState(() => MORE_PATHS.some((p) => path.startsWith(p)));
  const rowA = useRef<HTMLDivElement>(null);
  const rowB = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const primary: Item[] = [...NAV.slice(0, 4).map((n) => ({ key: n.href, label: n.label, icon: n.icon, href: n.href })), { key: "more", label: "More", icon: "more", run: () => setMore(true) }];
  const secondary: Item[] = [
    { key: "/app/wallets", label: "Wallets", icon: "wallet", href: "/app/wallets" },
    { key: "/app/settings", label: "Settings", icon: "settings", href: "/app/settings" },
    { key: "/app/profile", label: "Profile", icon: "user", href: "/app/profile" },
    { key: "soon", label: "Soon", icon: "box", soon: true, run: () => toast({ text: "More is coming here soon" }) },
    { key: "close", label: "Close", icon: "x", run: () => setMore(false) },
  ];

  useLayoutEffect(() => {
    const a = rowA.current, b = rowB.current; if (!a || !b) return;
    const ai = a.querySelectorAll("[data-nav-item]"), bi = b.querySelectorAll("[data-nav-item]");
    const [show, hide, showItems, hideItems] = more ? [b, a, bi, ai] : [a, b, ai, bi];
    if (first.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      first.current = false;
      gsap.set(show, { autoAlpha: 1 }); gsap.set(hide, { autoAlpha: 0 }); gsap.set([...ai, ...bi], { y: 0, opacity: 1 });
      return;
    }
    const tl = gsap.timeline();
    // opening: the main row rises out, the new row slides up in. Closing: the new row falls away, the main row drops back in.
    const out = more ? -46 : 46, inFrom = more ? 46 : -46;
    tl.to(hideItems, { y: out, opacity: 0, duration: 0.26, stagger: 0.035, ease: "power2.in" })
      .set(hide, { autoAlpha: 0 })
      .set(show, { autoAlpha: 1 }, "<")
      .fromTo(showItems, { y: inFrom, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.045, ease: "back.out(1.6)" }, "-=0.12");
    return () => { tl.kill(); };
  }, [more]);

  const cell = (it: Item) => {
    const on = !!it.href && isOn(path, it.href);
    const inner = (
      <>
        <span className={`grid h-8 w-12 place-items-center rounded-full transition ${on ? "bg-grape text-white" : it.soon ? "text-ink/40" : "text-ink/70"}`}><Icon name={it.icon} size={21} /></span>
        <span className={`text-[11px] font-bold ${on ? "text-ink" : it.soon ? "text-ink/40" : "text-ink/65"}`}>{it.label}</span>
      </>
    );
    const cls = "flex flex-col items-center justify-start gap-1 pt-2";
    return it.href
      ? <Link key={it.key} data-nav-item data-tour={`nav-${it.label.toLowerCase()}`} href={it.href} aria-current={on ? "page" : undefined} {...(it.href === "/app/team" ? { "data-seat-target": true } : {})} className={cls}>{inner}</Link>
      : <button key={it.key} data-nav-item data-tour={`nav-${it.label.toLowerCase()}`} onClick={it.run} aria-expanded={it.key === "more" ? more : undefined} className={cls}>{inner}</button>;
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-base/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/app" aria-label="Agents"><span className="inline-block origin-left scale-90"><Logo /></span></Link>
        <div className="flex items-center gap-2">
          <DemoTag className="hidden min-[400px]:inline-flex" />
          <ThemeToggle />
          <Link href="/app/profile" aria-label="Profile" className="grid h-11 w-11 place-items-center rounded-full bg-ink text-[13px] font-bold text-[var(--bg)]">{initials(s)}</Link>
        </div>
      </header>
      <nav aria-label="App" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-base/95 backdrop-blur-md lg:hidden">
        <div className="relative mx-auto h-[66px] max-w-[560px] overflow-hidden">
          <div ref={rowA} className="absolute inset-0 grid grid-cols-5" aria-hidden={more}>{primary.map(cell)}</div>
          <div ref={rowB} data-tour="more-row" className="invisible absolute inset-0 grid grid-cols-5" aria-hidden={!more}>{secondary.map(cell)}</div>
        </div>
      </nav>
    </>
  );
}

function Loading() {
  return (
    <div className="min-h-screen bg-base lg:pl-[84px]" aria-busy="true" aria-label="Loading">
      <div className="fixed inset-y-0 left-0 hidden w-[84px] border-r border-line bg-alt px-4 py-5 lg:block">
        <div className="skel mx-auto h-10 w-10" />
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel mx-auto mt-5 h-12 w-12" />)}
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
  // preferences that change the whole app
  const demoOff = s?.prefs?.demoLabels === false, still = s?.prefs?.motion === false;
  useEffect(() => {
    const el = document.documentElement;
    if (demoOff) el.dataset.demo = "off"; else delete el.dataset.demo;
    if (still) el.dataset.motion = "off"; else delete el.dataset.motion;
    gsap.globalTimeline.timeScale(still ? 1000 : 1);
  }, [demoOff, still]);
  useLayoutEffect(() => {
    if (!ready || !main.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-rise]", { y: 14, opacity: 0, duration: 0.5, stagger: 0.05, ease: "power2.out", clearProps: "transform,opacity" });
    }, main);
    return () => ctx.revert();
  }, [path, ready]);

  if (!s) return <Loading />;
  if (!ready) return <Gate s={s} />;
  const bleed = path === "/app" || path === "/app/memory" || path.startsWith("/app/chat");
  return (
    <div className="min-h-screen bg-base text-ink">
      <Rail s={s} path={path} />
      <MobileBars s={s} path={path} />
      <div className="lg:pl-[84px]">
        {bleed ? <div key={path}>{children}</div> : <div ref={main} key={path} className="mx-auto max-w-[1240px] px-4 pb-32 pt-6 sm:px-8 sm:pt-9 lg:pb-16">{children}</div>}
      </div>
      <AgentPanel />
      <AddAgentDialog />
      {s.tour?.on && <Tour s={s} />}
      <Toaster />
    </div>
  );
}

export const plansList = PLANS;
