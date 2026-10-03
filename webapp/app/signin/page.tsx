"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletAdapter } from "@solana/wallet-adapter-base";

type SigningAdapter = WalletAdapter & { signMessage?: (message: Uint8Array) => Promise<Uint8Array> };
import { DEMO_GOOGLE, WALLETS, shortAddr, type WalletId } from "@/content/appData";
import { get, signIn } from "@/lib/store";
import { LANDING_URL } from "@shared/sites";
import Logo from "@shared/components/Logo";
import ThemeToggle from "@shared/components/ThemeToggle";
import Face from "@shared/components/Face";
import Icon from "@/components/Icon";
import { SpecFace } from "@/components/faces";

type Flow = null | { method: "google" } | { method: "wallet"; wallet: WalletId };
type Phase = "connect" | "sign" | "signing" | "done" | "error";

const DOWNLOAD: Record<WalletId, string> = {
  phantom: "https://phantom.app/download",
  solflare: "https://solflare.com/download",
  backpack: "https://backpack.app/download",
};

function WalletGlyph({ id }: { id: WalletId }) {
  if (id === "phantom") return (
    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#ab9ff2] text-[#2d1b69]">
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M12 2.5c2.6 2.7 3.8 5.2 3.8 7.6 0 1.3-.4 2.5-.9 3.4 1.8.3 3.1.9 4 1.8-2.4 1.6-5.5 2.5-8.9 2.5s-6.5-.9-8.9-2.5c.9-.9 2.2-1.5 4-1.8-.5-.9-.9-2.1-.9-3.4 0-2.4 1.2-4.9 3.8-7.6.6.8 1.5 1.3 2.5 1.3s1.9-.5 2.5-1.3zM9.6 10.2a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3zm4.8 0a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3z" /></svg>
    </span>
  );
  if (id === "solflare") return (
    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#ffef46] text-[#c2410c]">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M12 2.2 14.2 8l6.1.5-4.7 3.9 1.5 5.9L12 15.4 6.9 18.3l1.5-5.9L3.7 8.5 9.8 8 12 2.2z" /></svg>
    </span>
  );
  return (
    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e33e3f] text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M7 8.5V7a5 5 0 0 1 10 0v1.5h1.2A1.8 1.8 0 0 1 20 10.3v8.4a2.3 2.3 0 0 1-2.3 2.3H6.3A2.3 2.3 0 0 1 4 18.7v-8.4A1.8 1.8 0 0 1 5.8 8.5H7zm2 0h6V7a3 3 0 0 0-6 0v1.5z" /></svg>
    </span>
  );
}

function Sheet({ flow, onClose }: { flow: NonNullable<Flow>; onClose: () => void }) {
  const router = useRouter();
  const { wallets } = useWallet();
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const adapterRef = useRef<SigningAdapter | null>(null);
  const [phase, setPhase] = useState<Phase>("connect");
  const [address, setAddress] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const card = useRef<HTMLDivElement>(null);
  const wallet = flow.method === "wallet" ? WALLETS.find((w) => w.id === flow.wallet)! : null;

  useEffect(() => {
    if (card.current) gsap.fromTo(card.current, { y: 40, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)" });
  }, [flow]);

  useEffect(() => {
    if (flow.method === "google") {
      const t = setTimeout(() => setPhase("done"), 1500);
      return () => clearTimeout(t);
    }
    const wanted = WALLETS.find((w) => w.id === flow.wallet)!;
    let cancel = false;
    const ready = async (adapter: SigningAdapter) => {
      for (let i = 0; i < 20; i++) {
        const state = adapter.readyState;
        if (state === WalletReadyState.Installed || state === WalletReadyState.Loadable) return true;
        if (state === WalletReadyState.NotDetected || state === WalletReadyState.Unsupported) return false;
        await new Promise((r) => setTimeout(r, 100));
      }
      return adapter.readyState === WalletReadyState.Installed || adapter.readyState === WalletReadyState.Loadable;
    };
    (async () => {
      const entry = walletsRef.current.find((w) => w.adapter.name === wanted.name);
      const adapter = entry?.adapter;
      if (!adapter) { setErr(`${wanted.name} is not available in this browser.`); setPhase("error"); return; }
      if (!(await ready(adapter))) {
        if (cancel) return;
        setErr(`${wanted.name} is not installed.`);
        setPhase("error");
        return;
      }
      try {
        if (!adapter.connected) await adapter.connect();
        if (cancel) return;
        adapterRef.current = adapter;
        setAddress(adapter.publicKey?.toBase58() ?? null);
        setPhase("sign");
      } catch (e) {
        if (cancel) return;
        const m = (e as Error)?.message || "The wallet did not connect.";
        setErr(/reject|denied|cancel/i.test(m) ? "You cancelled the connection." : m.split("\n")[0].slice(0, 160));
        setPhase("error");
      }
    })();
    return () => { cancel = true; };
  }, [flow]);

  const sign = async () => {
    const adapter = adapterRef.current;
    const pk = adapter?.publicKey?.toBase58();
    if (!adapter || !pk || !adapter.signMessage) { setErr("This wallet cannot sign a message."); setPhase("error"); return; }
    setPhase("signing"); setErr("");
    try {
      await adapter.signMessage(new TextEncoder().encode(`Sign in to Lexari\n${pk}`));
      setAddress(pk);
      setPhase("done");
    } catch (e) {
      const m = (e as Error)?.message || "The signature failed.";
      setErr(/reject|denied|cancel/i.test(m) ? "You cancelled the signature." : m.split("\n")[0].slice(0, 160));
      setPhase("sign");
    }
  };

  useEffect(() => {
    if (phase !== "done") return;
    if (flow.method === "wallet") {
      if (!address) return;
      signIn("wallet", flow.wallet, address);
    } else signIn("google");
    const name = new URLSearchParams(window.location.search).get("name");
    const t = setTimeout(() => router.push(get().onboarded ? "/app" : `/onboarding${name ? `?name=${encodeURIComponent(name)}` : ""}`), 1300);
    return () => clearTimeout(t);
  }, [phase, flow, router, address]);

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
          {phase === "done" ? "You're in." : phase === "error" ? "That didn't connect." : flow.method === "google" ? "Preview only" : phase === "connect" ? `Opening ${wallet!.name}…` : "Sign to prove it's you"}
        </h2>
        <p className="mt-2 text-[15px] text-ink/75">
          {phase === "error" ? err
            : phase === "done"
              ? `Signed in as ${flow.method === "google" ? DEMO_GOOGLE.email : shortAddr(address || "")}. Taking you to your agent.`
              : flow.method === "google" ? "Google sign-in is a preview. Nothing is sent to Google." : phase === "connect" ? "Approve the connection in your wallet." : "One signature, no transaction. It just proves the wallet is yours."}
        </p>
        {(phase === "sign" || phase === "signing") && wallet && address && (
          <div className="mt-5 rounded-2xl bg-alt p-4 text-left ring-1 ring-line">
            <div className="label text-[9px] text-ink/60">Message to sign</div>
            <p className="mt-1.5 break-all font-mono text-[12px] leading-relaxed text-ink">Sign in to Lexari<br />{address}</p>
            {err && <p className="mt-2 text-[13px] text-[#e5484d]">{err}</p>}
            <button onClick={sign} disabled={phase === "signing"} className="btn btn-brand mt-4 w-full !h-12 !text-[15px] disabled:opacity-60">{phase === "signing" ? "Waiting for wallet…" : "Sign message"}</button>
          </div>
        )}
        {phase === "error" && flow.method === "wallet" && (
          <a href={DOWNLOAD[flow.wallet]} target="_blank" rel="noreferrer" className="btn btn-brand mt-5 w-full !h-12 !text-[15px]">Get {wallet!.name}</a>
        )}
        <p className="label mt-5 text-[9px] text-ink/55">{flow.method === "google" ? "Preview. Nothing is sent to Google." : "Solana wallet. One signature, no transaction."}</p>
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
      <section className="grain carpet-w relative flex flex-col overflow-hidden bg-grape px-6 pb-10 pt-6 text-white sm:px-10 lg:min-h-[100svh] lg:pb-14">
        <div className="relative z-10 flex items-center justify-between">
          <Link href={LANDING_URL} aria-label="Lexari home" style={{ "--ink": "#fff", "--bg": "#5b2bff" } as React.CSSProperties}><Logo /></Link>
          <span className="lg:hidden"><ThemeToggle /></span>
        </div>
        <div className="relative z-10 mt-8 lg:mt-auto">
          <p data-in className="label text-white/80">Day one · getting in</p>
          <h1 data-in className="display mt-4 text-[48px] sm:text-[72px] lg:text-[88px]">Sign in.<br />Meet your agent.</h1>
          <p data-in className="mt-5 max-w-md text-[16px] leading-relaxed text-white/90 sm:text-[18px]">Use a Solana wallet. Then you name your agent and it clocks in on its own computer.</p>
        </div>
        <div className="pointer-events-none absolute right-[-30px] top-[64px] hidden sm:block lg:right-10 lg:top-[14%]">
          <div data-float className="bob grid h-36 w-36 place-items-center rounded-[34px] bg-[#0a0a0a] shadow-[0_20px_40px_-12px_rgba(0,0,0,.5)] lg:h-44 lg:w-44"><Face size={130} track /></div>
        </div>
        <div className="pointer-events-none relative z-10 mt-8 flex gap-2 lg:mt-10">
          {["scout", "quill", "tally", "frame", "patch"].map((s, i) => <span key={s} data-float className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm" style={{ animationDelay: `${i * 0.3}s` }}><SpecFace slug={s} size={40} /></span>)}
          <span data-float className="label grid h-12 place-items-center rounded-2xl px-3 text-[9px] text-white/80 border border-dashed border-white/40">hire more later</span>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="absolute right-6 top-6 hidden lg:block"><ThemeToggle /></div>
        <div className="w-full max-w-[440px]">
          <h2 data-in className="display text-[40px] sm:text-[52px]">Welcome in.</h2>
          <p data-in className="mt-2 text-[16px] text-ink/75">Pick how you want to sign in. No new password to remember.</p>

          <button data-in onClick={() => setFlow({ method: "google" })} className="group mt-8 flex w-full items-center gap-4 rounded-[22px] bg-ink p-2 pr-5 text-left text-[var(--bg)] shadow-[0_6px_0_#5b2bff] transition hover:-translate-y-1 hover:shadow-[0_9px_0_#5b2bff] active:scale-[.98]">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--bg)] text-ink"><Icon name="google" size={24} /></span>
            <span className="flex-1"><span className="block text-[17px] font-bold">Continue with Google</span><span className="block text-[13px] opacity-70">Preview. This does not contact Google.</span></span>
            <Icon name="arrow" size={20} className="transition group-hover:translate-x-1" />
          </button>

          <div data-in className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="label text-[10px] text-ink/60">or a Solana wallet</span><span className="h-px flex-1 bg-line" /></div>

          <ul className="grid gap-2.5">
            {WALLETS.map((w) => (
              <li data-in key={w.id}>
                <button onClick={() => setFlow({ method: "wallet", wallet: w.id })} className="group flex w-full items-center gap-4 rounded-[22px] bg-card p-2 pr-4 text-left ring-2 ring-line transition hover:-translate-y-0.5 hover:ring-grape active:scale-[.98]">
                  <WalletGlyph id={w.id} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[16px] font-bold text-ink">{w.name}</span>
                    <span className="block truncate text-[13px] text-ink/70">{w.note}</span>
                  </span>
                  <Icon name="arrow" size={18} className="text-ink/60 transition group-hover:translate-x-1 group-hover:text-brand-ink" />
                </button>
              </li>
            ))}
          </ul>
          <p data-in className="mt-7 text-[13px] leading-relaxed text-ink/65">Wallet sign-in asks Phantom, Solflare or Backpack for one signature. Google stays a preview in this browser.</p>
        </div>
      </section>
      {flow && <Sheet flow={flow} onClose={() => setFlow(null)} />}
    </main>
  );
}
