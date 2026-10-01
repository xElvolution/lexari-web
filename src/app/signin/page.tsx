"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { DEMO_ADDRESS, DEMO_GOOGLE, WALLETS, shortAddr, type WalletId } from "@/content/appData";
import { get, signIn } from "@/lib/store";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import Face from "@/components/Face";
import Icon from "@/components/app/Icon";
import { SpecFace } from "@/components/app/faces";

type Flow = null | { method: "google" } | { method: "wallet"; wallet: WalletId };
type Phase = "connect" | "sign" | "done";

function WalletGlyph({ id }: { id: WalletId }) {
  if (id === "okx") return <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0a0a0a] text-[11px] font-black tracking-tight text-white ring-1 ring-white/15">OKX</span>;
  return <span className="grid h-11 w-11 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name={id === "phone" ? "phone" : "wallet"} size={22} /></span>;
}

function Sheet({ flow, onClose }: { flow: NonNullable<Flow>; onClose: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("connect");
  const card = useRef<HTMLDivElement>(null);
  const wallet = flow.method === "wallet" ? WALLETS.find((w) => w.id === flow.wallet)! : null;
  useEffect(() => {
    if (card.current) gsap.fromTo(card.current, { y: 40, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)" });
    const t: ReturnType<typeof setTimeout>[] = [];
    if (flow.method === "google") t.push(setTimeout(() => setPhase("done"), 1500));
    else t.push(setTimeout(() => setPhase("sign"), 1300));
    return () => t.forEach(clearTimeout);
  }, [flow]);
  useEffect(() => {
    if (phase !== "done") return;
    signIn(flow.method, flow.method === "wallet" ? flow.wallet : undefined);
    const name = new URLSearchParams(window.location.search).get("name");
    const t = setTimeout(() => router.push(get().onboarded ? "/app" : `/onboarding${name ? `?name=${encodeURIComponent(name)}` : ""}`), 1300);
    return () => clearTimeout(t);
  }, [phase, flow, router]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={phase === "done" ? undefined : onClose}>
      <div ref={card} role="dialog" aria-live="polite" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[400px] rounded-[30px] bg-card p-7 text-center text-ink shadow-[0_14px_0_#5b2bff] ring-1 ring-line">
        {phase !== "done" && <button onClick={onClose} aria-label="Cancel" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-tint text-ink transition hover:rotate-90"><Icon name="x" size={16} /></button>}
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          {phase === "done" ? (
            <span className="pop grid h-24 w-24 place-items-center rounded-full bg-grape text-white shadow-[0_0_0_10px_var(--glow)]">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path className="draw" d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            </span>
          ) : (
            <>
              <span className="absolute inset-0 rounded-full bg-tint" /><span className="ring-out absolute inset-0 rounded-full border-2 border-grape" /><span className="ring-out absolute inset-0 rounded-full border-2 border-grape [animation-delay:1.1s]" />
              {flow.method === "google" ? <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-[var(--bg)]"><Icon name="google" size={28} /></span> : <WalletGlyph id={flow.wallet} />}
            </>
          )}
        </div>
        <h2 className="display mt-6 text-[34px]">
          {phase === "done" ? "You're in." : flow.method === "google" ? "Talking to Google…" : phase === "connect" ? `Opening ${wallet!.name}…` : "Sign to prove it's you"}
        </h2>
        <p className="mt-2 text-[15px] text-ink/75">
          {phase === "done"
            ? `Signed in as ${flow.method === "google" ? DEMO_GOOGLE.email : shortAddr(DEMO_ADDRESS)}. Taking you to your agent.`
            : flow.method === "google" ? "Pick your account in the Google window." : phase === "connect" ? "Approve the connection in your wallet." : "One signature, no transaction. It just proves the wallet is yours."}
        </p>
        {phase === "sign" && wallet && (
          <div className="mt-5 rounded-2xl bg-alt p-4 text-left ring-1 ring-line">
            <div className="label text-[9px] text-ink/60">Message to sign</div>
            <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-ink">Sign in to Lexari<br />Wallet {shortAddr(DEMO_ADDRESS)}<br />Nonce 58a1-demo</p>
            <button onClick={() => setPhase("done")} className="btn btn-brand mt-4 w-full !h-12 !text-[15px]">Sign message</button>
          </div>
        )}
        <p className="label mt-5 text-[9px] text-ink/55">Demo sign-in · nothing leaves this browser</p>
      </div>
    </div>
  );
}

export default function SignIn() {
  const [flow, setFlow] = useState<Flow>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-in]", { y: 30, opacity: 0, stagger: 0.07, duration: 0.8, ease: "back.out(1.5)", clearProps: "all" });
      gsap.from("[data-float]", { scale: 0, rotate: -20, stagger: 0.08, duration: 0.8, delay: 0.2, ease: "back.out(2)" });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <main ref={root} className="grid min-h-[100svh] bg-base text-ink lg:grid-cols-[1fr_1fr]">
      {/* the purple side */}
      <section className="grain carpet-w relative flex flex-col overflow-hidden bg-grape px-6 pb-10 pt-6 text-white sm:px-10 lg:min-h-[100svh] lg:pb-14">
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" aria-label="Lexari home" style={{ "--ink": "#fff", "--bg": "#5b2bff" } as React.CSSProperties}><Logo /></Link>
          <span className="lg:hidden"><ThemeToggle /></span>
        </div>
        <div className="relative z-10 mt-8 lg:mt-auto">
          <p data-in className="label text-white/80">Day one · getting in</p>
          <h1 data-in className="display mt-4 text-[48px] sm:text-[72px] lg:text-[88px]">Sign in.<br />Meet your agent.</h1>
          <p data-in className="mt-5 max-w-md text-[16px] leading-relaxed text-white/90 sm:text-[18px]">Use Google or a crypto wallet. Then you name your agent and it clocks in on its own computer.</p>
        </div>
        {/* a little welcome committee */}
        <div className="pointer-events-none absolute right-[-30px] top-[64px] hidden sm:block lg:right-10 lg:top-[14%]">
          <div data-float className="bob grid h-36 w-36 place-items-center rounded-[34px] bg-[#0a0a0a] shadow-[0_20px_40px_-12px_rgba(0,0,0,.5)] lg:h-44 lg:w-44"><Face size={130} track /></div>
        </div>
        <div className="pointer-events-none relative z-10 mt-8 flex gap-2 lg:mt-10">
          {["scout", "quill", "tally", "frame", "patch"].map((s, i) => <span key={s} data-float className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm" style={{ animationDelay: `${i * 0.3}s` }}><SpecFace slug={s} size={40} /></span>)}
          <span data-float className="label grid h-12 place-items-center rounded-2xl px-3 text-[9px] text-white/80 border border-dashed border-white/40">hire more later</span>
        </div>
      </section>

      {/* the form side */}
      <section className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="absolute right-6 top-6 hidden lg:block"><ThemeToggle /></div>
        <div className="w-full max-w-[440px]">
          <h2 data-in className="display text-[40px] sm:text-[52px]">Welcome in.</h2>
          <p data-in className="mt-2 text-[16px] text-ink/75">Pick how you want to sign in. No new password to remember.</p>

          <button data-in onClick={() => setFlow({ method: "google" })} className="group mt-8 flex w-full items-center gap-4 rounded-[22px] bg-ink p-2 pr-5 text-left text-[var(--bg)] shadow-[0_6px_0_#5b2bff] transition hover:-translate-y-1 hover:shadow-[0_9px_0_#5b2bff] active:scale-[.98]">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--bg)] text-ink"><Icon name="google" size={24} /></span>
            <span className="flex-1"><span className="block text-[17px] font-bold">Continue with Google</span><span className="block text-[13px] opacity-70">Use the account you already have</span></span>
            <Icon name="arrow" size={20} className="transition group-hover:translate-x-1" />
          </button>

          <div data-in className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="label text-[10px] text-ink/60">or a crypto wallet</span><span className="h-px flex-1 bg-line" /></div>

          <ul className="grid gap-2.5">
            {WALLETS.map((w) => (
              <li data-in key={w.id}>
                <button onClick={() => setFlow({ method: "wallet", wallet: w.id })} className="group flex w-full items-center gap-4 rounded-[22px] bg-card p-2 pr-4 text-left ring-2 ring-line transition hover:-translate-y-0.5 hover:ring-grape active:scale-[.98]">
                  <WalletGlyph id={w.id} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[16px] font-bold text-ink">{w.name}{w.tag && <span className="label rounded-full border border-dashed border-brand-ink px-1.5 py-0.5 text-[8.5px] text-brand-ink">{w.tag}</span>}</span>
                    <span className="block truncate text-[13px] text-ink/70">{w.note}</span>
                  </span>
                  <Icon name="arrow" size={18} className="text-ink/60 transition group-hover:translate-x-1 group-hover:text-brand-ink" />
                </button>
              </li>
            ))}
          </ul>
          <p data-in className="mt-7 text-[13px] leading-relaxed text-ink/65">This is a demo: sign-in is simulated and nothing is sent anywhere. The wallet list is a placeholder until the supported wallets are confirmed.</p>
        </div>
      </section>
      {flow && <Sheet flow={flow} onClose={() => setFlow(null)} />}
    </main>
  );
}
