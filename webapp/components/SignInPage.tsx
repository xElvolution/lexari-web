"use client";

import SignInLoader from "@/components/SignInLoader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletAdapter } from "@solana/wallet-adapter-base";

type SigningAdapter = WalletAdapter & { signMessage?: (message: Uint8Array) => Promise<Uint8Array> };
import { WALLETS, shortAddr, type WalletId } from "@/content/appData";
import { get, signIn } from "@/lib/store";
import { usePrivy } from "@privy-io/react-auth";
import { signInWithWallet } from "@/lib/session";
import { friendly } from "@/lib/api";
import { useWalletBridge } from "@/lib/walletBridge";
import { LANDING_URL } from "@shared/sites";
import Logo from "@shared/components/Logo";
import ThemeToggle from "@shared/components/ThemeToggle";
import Face from "@shared/components/Face";
import Icon from "@/components/Icon";
import { SpecFace } from "@/components/faces";

type Flow = null | { method: "wallet"; wallet: WalletId };
type Phase = "connect" | "sign" | "signing" | "done" | "error";

const PRIVY_ON = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const isMobile = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
/** Opens this page inside the wallet app's own browser, where the wallet can connect. */
function walletBrowse(id: WalletId) {
  const here = encodeURIComponent(window.location.href);
  const ref = encodeURIComponent(window.location.origin);
  if (id === "phantom") return `https://phantom.app/ul/browse/${here}?ref=${ref}`;
  if (id === "solflare") return `https://solflare.com/ul/v1/browse/${here}?ref=${ref}`;
  return `https://backpack.app/ul/v1/browse/${here}?ref=${ref}`;
}

const DOWNLOAD: Record<WalletId, string> = {
  phantom: "https://phantom.app/download",
  solflare: "https://solflare.com/download",
  backpack: "https://backpack.app/download",
};

/* Official wallet icons, as shipped in each wallet's @solana/wallet-adapter package. */
const WALLET_ICON: Record<WalletId, string> = { phantom: "/wallets/phantom.svg", solflare: "/wallets/solflare.svg", backpack: "/wallets/backpack.png" };
function WalletGlyph({ id }: { id: WalletId }) {
  return (
    <span className={`relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl ${id === "backpack" ? "bg-white ring-1 ring-black/10" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={WALLET_ICON[id]} alt="" width={44} height={44} className={id === "backpack" ? "h-8 w-8" : "h-11 w-11"} />
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
  const wallet = WALLETS.find((w) => w.id === flow.wallet)!;

  useEffect(() => {
    if (card.current) gsap.fromTo(card.current, { y: 40, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)" });
  }, [flow]);

  useEffect(() => {
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
      let adapter: SigningAdapter | undefined = entry?.adapter;
      const injected = adapter ? await ready(adapter) : false;
      if (cancel) return;
      if (!injected) {
        // Phones have no browser extensions. Android: the Mobile Wallet Adapter talks to the installed wallet app.
        // iPhone (and Android without it): reopen this page inside the wallet app's browser.
        const mwa = isAndroid() ? walletsRef.current.find((w) => /mobile wallet adapter/i.test(w.adapter.name))?.adapter : undefined;
        if (mwa && (await ready(mwa))) adapter = mwa;
        else if (isMobile()) { window.location.href = walletBrowse(wanted.id); return; }
        else {
          setErr(adapter ? `${wanted.name} is not installed.` : `${wanted.name} is not available in this browser.`);
          setPhase("error");
          return;
        }
      }
      if (!adapter) return;
      try {
        if (!adapter.connected) await adapter.connect();
        if (cancel) return;
        // Remember the wallet so it reconnects by itself after a reload (wallet-adapter autoConnect).
        try { localStorage.setItem("lexari-wallet", JSON.stringify(adapter.name)); } catch { /* private mode */ }
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
    const pk = adapter?.publicKey;
    if (!adapter || !pk || !adapter.signMessage) { setErr("This wallet cannot sign a message."); setPhase("error"); return; }
    setPhase("signing"); setErr("");
    try {
      await signInWithWallet({ source: "adapter", name: adapter.name, publicKey: pk, signMessage: (m) => adapter.signMessage!(m), signTransaction: (tx) => Promise.reject(new Error(`unused ${tx ? "" : ""}`)) });
      setAddress(pk.toBase58());
      setPhase("done");
    } catch (e) {
      setErr(friendly(e, "Sign-in was rejected."));
      setPhase("sign");
    }
  };

  useEffect(() => {
    if (phase !== "done" || !address) return;
    let cancel = false;
    const name = new URLSearchParams(window.location.search).get("name");
    const started = Date.now();
    void signIn().then(() => {
      if (cancel) return;
      const wait = Math.max(0, 1100 - (Date.now() - started));
      setTimeout(() => { if (!cancel) router.push(get().onboarded ? "/agents" : `/onboarding${name ? `?name=${encodeURIComponent(name)}` : ""}`); }, wait);
    });
    return () => { cancel = true; };
  }, [phase, router, address]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={phase === "done" ? undefined : onClose}>
      {phase === "done" && <SignInLoader sub="Your wallet signed. Setting up your session…" />}
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
              <WalletGlyph id={flow.wallet} />
            </>
          )}
        </div>
        <h2 className="display mt-6 text-[34px]">
          {phase === "done" ? "You're in." : phase === "error" ? "That didn't connect." : phase === "connect" ? `Opening ${wallet!.name}…` : "Sign to prove it's you"}
        </h2>
        <p className="mt-2 text-[15px] text-ink/75">
          {phase === "error" ? err
            : phase === "done"
              ? `Signed in as ${shortAddr(address || "")}. Taking you to your agent.`
              : phase === "connect" ? "Approve the connection in your wallet." : "One signature, no transaction. It just proves the wallet is yours."}
        </p>
        {(phase === "sign" || phase === "signing") && wallet && address && (
          <div className="mt-5 rounded-2xl bg-alt p-4 text-left ring-1 ring-line">
            <div className="label text-[9px] text-ink/60">Signing in as</div>
            <p className="mt-1.5 break-all font-mono text-[12px] leading-relaxed text-ink">{address}</p>
            <p className="mt-1 text-[12.5px] text-ink/65">Your wallet shows the exact message. It names this site and expires in 10 minutes.</p>
            {err && <p className="mt-2 text-[13px] text-[#e5484d]">{err}</p>}
            <button onClick={sign} disabled={phase === "signing"} className="btn btn-brand mt-4 w-full !h-12 !text-[15px] disabled:opacity-60">{phase === "signing" ? "Waiting for wallet…" : "Sign message"}</button>
          </div>
        )}
        {phase === "error" && isMobile() && (
          <a href={walletBrowse(flow.wallet)} className="btn btn-brand mt-5 w-full !h-12 !text-[15px]">Open in the {wallet!.name} app</a>
        )}
        {phase === "error" && !isMobile() && /not installed|not available/i.test(err) && (
          <a href={DOWNLOAD[flow.wallet]} target="_blank" rel="noreferrer" className="btn btn-brand mt-5 w-full !h-12 !text-[15px]">Get {wallet!.name}</a>
        )}
        <p className="label mt-5 text-[9px] text-ink/55">Solana wallet. One signature, no transaction.</p>
      </div>
    </div>
  );
}

export default function SignIn() {
  const [flow, setFlow] = useState<Flow>(null);
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const bridge = useWalletBridge();
  const entered = useRef(false);
  const [slow, setSlow] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [privyStep, setPrivyStep] = useState<"" | "wallet" | "sign" | "error">("");
  const [privyErr, setPrivyErr] = useState("");
  useEffect(() => { setMobile(isMobile()); if (ready || !PRIVY_ON) return; const t = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(t); }, [ready]);
  const googleNote = !PRIVY_ON ? "Sign-in by Google or email is not set up here yet. Use a wallet." : ready ? "" : slow ? "Sign-in could not load. Check your connection and reload." : "Loading sign-in…";
  // After Google or email: the Privy wallet signs the same sign-in message a Phantom user would.
  useEffect(() => {
    if (!ready || !authenticated || !user || entered.current) return;
    // A Privy session left over from confirming a wallet to link social accounts is not a Google or email sign-in.
    if (user.linkedAccounts.some((a) => a.type === "wallet" && a.chainType === "solana" && a.walletClientType !== "privy")) { void logout().catch(() => {}); return; }
    if (!bridge || bridge.source !== "privy") { setPrivyStep("wallet"); return; }
    entered.current = true;
    setPrivyStep("sign");
    const email = user.google?.email || user.email?.address || "";
    const first = (user.google?.name || (email ? email.split("@")[0] : "")).split(" ")[0] || "";
    (async () => {
      try {
        const privyToken = (await getAccessToken()) || undefined;
        await signInWithWallet(bridge, { privyToken, ...(email ? { email } : {}) });
        await signIn();
        router.push(get().onboarded ? "/agents" : `/onboarding${first ? `?name=${encodeURIComponent(first)}` : ""}`);
      } catch (e) {
        entered.current = false;
        setPrivyErr(friendly(e, "Sign-in did not finish."));
        setPrivyStep("error");
      }
    })();
  }, [ready, authenticated, user, bridge, router, getAccessToken, logout]);
  const privyBusy = authenticated && (privyStep === "wallet" || privyStep === "sign");
  const loader = privyBusy ? <SignInLoader sub={privyStep === "wallet" ? "Getting your Lexari wallet ready…" : "Confirming your account…"} /> : null;
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
      {loader}
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
        <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
          <span className="hidden lg:block"><ThemeToggle /></span>
        </div>
        <div className="w-full max-w-[440px]">
          <h2 data-in className="display text-[40px] sm:text-[52px]">Welcome in.</h2>
          <p data-in className="mt-2 text-[16px] text-ink/75">Pick how you want to sign in. No new password to remember.</p>

          <button data-in disabled={!PRIVY_ON || !ready || privyBusy} onClick={() => { setPrivyErr(""); setPrivyStep(""); if (authenticated) { entered.current = false; void logout().then(() => login()); } else login(); }} className="group mt-8 flex w-full items-center gap-4 rounded-[22px] bg-ink p-2 pr-5 text-left text-[var(--bg)] shadow-[0_6px_0_#5b2bff] transition hover:-translate-y-1 hover:shadow-[0_9px_0_#5b2bff] active:scale-[.98] disabled:opacity-60">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--bg)] text-ink"><Icon name="google" size={24} /></span>
            <span className="flex-1"><span className="block text-[17px] font-bold">Continue with Google or email</span>{(() => { const t = privyStep === "wallet" && authenticated ? "Setting up your wallet…" : privyStep === "sign" ? "Signing you in…" : googleNote; return t ? <span className="block text-[13px] opacity-70">{t}</span> : null; })()}</span>
            <Icon name="arrow" size={20} className="transition group-hover:translate-x-1" />
          </button>

          {privyStep === "error" && <p role="alert" className="mt-3 text-[13.5px] text-[#e5484d]">{privyErr} Tap the button to try again.</p>}

          <div data-in className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="label text-[10px] text-ink/60">or a Solana wallet</span><span className="h-px flex-1 bg-line" /></div>

          <ul className="grid gap-2.5">
            {WALLETS.map((w) => (
              <li data-in key={w.id}>
                <button onClick={() => setFlow({ method: "wallet", wallet: w.id })} className="group flex w-full items-center gap-4 rounded-[22px] bg-card p-2 pr-4 text-left ring-2 ring-line transition hover:-translate-y-0.5 hover:ring-grape active:scale-[.98]">
                  <WalletGlyph id={w.id} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[16px] font-bold text-ink">{w.name}</span>
                    <span className="block truncate text-[13px] text-ink/70">{mobile ? `Opens in the ${w.name} app.` : w.note}</span>
                  </span>
                  <Icon name="arrow" size={18} className="text-ink/60 transition group-hover:translate-x-1 group-hover:text-brand-ink" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {flow && <Sheet flow={flow} onClose={() => setFlow(null)} />}
    </main>
  );
}
