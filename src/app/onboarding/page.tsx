"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { KNOW_SUGGESTIONS, LOOKS, ROLES, TONES, type ToneId } from "@/content/appData";
import { finishOnboarding, startDemo, useApp, type AgentLook } from "@/lib/store";
import FaceCreator from "@/components/app/agent/FaceCreator";
import { lookVariant } from "@/components/avatar";
import Badge from "@/components/Badge";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import Icon from "@/components/app/Icon";
import { AgentFace } from "@/components/app/faces";
import { burst } from "@/components/app/fly";
import SetupSequence from "@/components/app/agent/SetupSequence";
import MintFinish from "@/components/app/agent/MintFinish";

const STEPS = ["Name", "Look", "About you", "Meet"];
const NAMES = ["Juniper", "Nova", "Pip", "Otto", "Mika", "Sol"];

export default function Onboarding() {
  const s = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [look, setLook] = useState<AgentLook>(null);
  const [base, setBase] = useState<number | null>(null); // which starter face you picked
  const [you, setYou] = useState("");
  const [role, setRole] = useState("");
  const [tone, setTone] = useState<ToneId>("short");
  const [knows, setKnows] = useState<string[]>([KNOW_SUGGESTIONS[0]]);
  const [custom, setCustom] = useState("");
  const printer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLButtonElement>(null);
  const [finale, setFinale] = useState<"none" | "setup" | "done">("none");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("name");
    setName((q || "").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 12));
    if (s?.auth?.method === "google") setYou(s.auth.label.split(" ")[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.auth?.label]);

  // the badge prints out of the slot on the first step and again when you meet
  useLayoutEffect(() => {
    if (!printer.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (step !== 0 && step !== 3) return;
    const t = gsap.fromTo(printer.current, { clipPath: "inset(0 0 100% 0)", y: -120 }, { clipPath: "inset(0 0 -20% 0)", y: 0, duration: 1.3, ease: "power2.out", clearProps: "clipPath" });
    return () => { t.kill(); };
  }, [step]);
  useLayoutEffect(() => {
    if (!panel.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => gsap.from("[data-step] > *", { x: 40, opacity: 0, stagger: 0.05, duration: 0.6, ease: "back.out(1.4)", clearProps: "all" }), panel);
    return () => ctx.revert();
  }, [step]);

  const shown = name.trim() || "your agent";
  const can = step === 0 ? !!name.trim() : true;
  const next = () => setStep((v) => Math.min(3, v + 1));
  const toggleKnow = (k: string) => setKnows((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k].slice(0, 8)));
  const addCustom = () => { const t = custom.trim(); if (t && !knows.includes(t)) setKnows((l) => [...l, t].slice(0, 8)); setCustom(""); };
  const meet = () => {
    burst(cta.current, 22);
    finishOnboarding({ name: name.trim() || "Juniper", look, you: you.trim(), role, tone }, knows);
    setTimeout(() => setFinale("setup"), 380);
  };
  const v = lookVariant(look); const bg = look && typeof look === "object" ? look.bg : undefined;
  const agentName = name.trim() || "Juniper";

  if (finale !== "none" && s?.agent) return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-x-clip bg-base px-5 py-10 text-ink">
      <div className="carpet pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_50%_40%,#000,transparent_75%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[var(--glow)] blur-[130px]" />
      <div className="relative w-full max-w-[760px]">
        {finale === "setup"
          ? <SetupSequence name={agentName} v={v} bg={bg} onDone={() => setFinale("done")} tone="page" />
          : <div className="rounded-[30px] bg-card p-5 ring-1 ring-line sm:p-7"><MintFinish s={s} id="home" v={v} title={`Meet ${agentName}.`}
              sub={`Its badge is printed, its computer is on and it already knows ${knows.length + (you ? 1 : 0)} things about you. Mint its ID card on chain, or do it later from its profile.`}
              later={() => router.push("/app")} laterLabel={s.meta.home?.nft ? `Start chatting with ${agentName}` : "Later, start chatting"} /></div>}
      </div>
    </main>
  );

  if (s && !s.auth) return (
    <main className="carpet grid min-h-[100svh] place-items-center bg-base px-5 text-center text-ink">
      <div className="max-w-md"><h1 className="display text-[44px]">Sign in first.</h1><p className="mt-3 text-ink/75">Your agent needs to know who it works for.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center"><Link href="/signin" className="btn btn-brand">Sign in →</Link><button onClick={() => { startDemo(); router.push("/app"); }} className="btn btn-line">Try the demo</button></div></div>
    </main>
  );

  return (
    <main className="relative min-h-[100svh] overflow-x-clip bg-base text-ink">
      <div className="carpet pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,#000,transparent_80%)]" />
      <div className="pointer-events-none absolute -left-40 top-1/3 h-[480px] w-[480px] rounded-full bg-[var(--glow)] blur-[130px]" />
      <header className="relative z-10 mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Lexari home"><Logo /></Link>
        <ol className="hidden items-center gap-2 md:flex" aria-label="Steps">
          {STEPS.map((l, i) => (
            <li key={l} className="flex items-center gap-2">
              <button onClick={() => i < step && setStep(i)} disabled={i > step} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-bold transition ${i === step ? "bg-grape text-white shadow-[0_4px_0_#3514b0]" : i < step ? "bg-tint text-ink hover:bg-grape/20" : "text-ink/55"}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${i === step ? "bg-white text-grape" : i < step ? "bg-grape text-white" : "ring-1 ring-ink/30"}`}>{i < step ? <Icon name="check" size={12} stroke={3} /> : i + 1}</span>{l}
              </button>
              {i < 3 && <span className={`h-0.5 w-6 rounded-full ${i < step ? "bg-grape" : "bg-line"}`} />}
            </li>
          ))}
        </ol>
        <ThemeToggle />
      </header>
      <div className="relative z-10 mx-auto h-1.5 max-w-[1320px] px-5 sm:px-8 md:hidden"><div className="h-full overflow-hidden rounded-full bg-tint"><div className="h-full rounded-full bg-grape transition-all duration-700" style={{ width: `${((step + 1) / 4) * 100}%` }} /></div></div>

      <div className="relative z-10 mx-auto grid max-w-[1320px] gap-8 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-14 lg:pt-6">
        {/* the badge */}
        <div className="flex flex-col items-center lg:sticky lg:top-6 lg:self-start">
          <div className="relative z-10 flex h-5 w-[270px] items-center justify-center rounded-full bg-frame shadow-[0_8px_20px_-8px_rgba(0,0,0,.5)] sm:w-[330px]">
            <span className="h-1.5 w-[80%] rounded-full bg-black/60" />
            <span className="label absolute -top-5 text-[8.5px] text-ink/55">badge printer · desk 01</span>
          </div>
          <div ref={printer} className="-mt-2.5">
            <Badge name={name} setName={setName} look={look} />
          </div>
          <p className="label mt-5 text-center text-[10px] text-ink/65">Type on the badge · tap it to flip · drag to swing</p>
        </div>

        {/* the step panel */}
        <div ref={panel} className="lg:pt-10">
          {step === 0 && (
            <div data-step>
              <p className="label text-brand-ink">Step 1 of 4 · name</p>
              <h1 className="display mt-3 text-[48px] sm:text-[76px]">What should we call your agent?</h1>
              <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink/75">Type a name on its badge, or here. It sits at desk one on your team and keeps this name.</p>
              <input value={name} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 12))} placeholder="Name your agent" aria-label="Agent name" className="field mt-7 !h-16 max-w-md !rounded-2xl !text-[22px] display !font-extrabold" />
              <div className="mt-4 flex flex-wrap gap-2">{NAMES.map((n) => <button key={n} onClick={() => setName(n)} aria-pressed={name === n} className="chip">{n}</button>)}</div>
            </div>
          )}
          {step === 1 && (
            <div data-step>
              <p className="label text-brand-ink">Step 2 of 4 · look</p>
              <h1 className="display mt-3 text-[48px] sm:text-[76px]">Pick a face for {shown}.</h1>
              <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink/75">Every face is generated. The badge updates as you pick.</p>
              <div className="mt-7 grid max-w-[560px] grid-cols-4 gap-2.5 sm:grid-cols-6">
                {LOOKS.map((l) => {
                  const on = base === l;
                  return (
                    <button key={String(l)} onClick={() => { setBase(l); setLook(l); }} aria-pressed={on} aria-label={l === null ? "House face" : `Face ${l}`} className={`group relative grid aspect-square place-items-center rounded-[22px] transition-all duration-300 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] ${on ? "scale-105 bg-grape shadow-[0_6px_0_#3514b0]" : "bg-tint hover:-translate-y-1 hover:bg-grape/25"}`}>
                      <span className="transition group-hover:scale-110"><AgentFace look={l} size={64} /></span>
                      {on && <span className="pop absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-[var(--bg)]"><Icon name="check" size={13} stroke={3} /></span>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 max-w-[560px]">
                <p className="label text-[10px] text-ink/70">Make it yours · states, brows, extras, memory dots and a card background</p>
                <div className="mt-3"><FaceCreator value={lookVariant(look)} onChange={setLook} name={shown} wide /></div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div data-step>
              <p className="label text-brand-ink">Step 3 of 4 · about you</p>
              <h1 className="display mt-3 text-[48px] sm:text-[72px]">What should {shown} know?</h1>
              <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink/75">These become its first memories. You can edit or forget any of them later in its brain.</p>
              <div className="mt-7 grid max-w-[560px] gap-6">
                <label className="block"><span className="label text-[10px] text-ink/70">Your first name</span><input value={you} onChange={(e) => setYou(e.target.value.slice(0, 20))} placeholder="Ada" className="field mt-2" /></label>
                <div><span className="label text-[10px] text-ink/70">What you do</span><div className="mt-2 flex flex-wrap gap-2">{ROLES.map((r) => <button key={r} onClick={() => setRole(role === r ? "" : r)} aria-pressed={role === r} className="chip">{r}</button>)}</div></div>
                <div><span className="label text-[10px] text-ink/70">How it should talk</span><div className="mt-2 flex flex-wrap gap-2">{TONES.map((t) => <button key={t.id} onClick={() => setTone(t.id)} aria-pressed={tone === t.id} className="chip">{t.label}</button>)}</div></div>
                <div>
                  <span className="label text-[10px] text-ink/70">Things to remember · {knows.length}/8</span>
                  <div className="mt-2 flex flex-wrap gap-2">{[...KNOW_SUGGESTIONS, ...knows.filter((k) => !KNOW_SUGGESTIONS.includes(k))].map((k) => <button key={k} onClick={() => toggleKnow(k)} aria-pressed={knows.includes(k)} className="chip">{knows.includes(k) && <Icon name="check" size={14} stroke={3} />}{k}</button>)}</div>
                  <form onSubmit={(e) => { e.preventDefault(); addCustom(); }} className="mt-3 flex gap-2"><input value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 80))} placeholder="Add your own, like: I work from Lagos" className="field" aria-label="Add a memory" /><button className="btn btn-ghost btn-sm shrink-0 !h-auto" disabled={!custom.trim()}>Add</button></form>
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div data-step>
              <p className="label text-brand-ink">Step 4 of 4 · first day</p>
              <h1 className="display mt-3 text-[56px] sm:text-[96px]">Meet {shown}.</h1>
              <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink/75">Its badge is printed, its computer is on and it already knows {knows.length + (you ? 1 : 0)} things about you. Say hi and start chatting.</p>
              <ul className="mt-7 grid max-w-[520px] gap-2.5">
                {[["desk", "Its own computer", "A terminal, a browser and a folder of files"], ["memory", "A brain that keeps", `${knows.length + (you ? 1 : 0)} memories filed on day one`], ["team", "Seats for specialists", "Hire from the marketplace when the work grows"]].map(([i, h, t]) => (
                  <li key={h} className="flex items-center gap-4 rounded-[20px] bg-card p-3.5 ring-1 ring-line"><span className="grid h-11 w-11 place-items-center rounded-xl bg-grape text-white"><Icon name={i} size={21} /></span><span><b className="block text-ink">{h}</b><span className="text-[14px] text-ink/70">{t}</span></span></li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10 flex items-center gap-3">
            {step > 0 && <button onClick={() => setStep((v) => v - 1)} className="btn btn-line text-ink" aria-label="Back"><Icon name="back" size={18} /></button>}
            {step < 3 ? (
              <button onClick={next} disabled={!can} className="btn btn-brand disabled:opacity-40">{step === 0 ? `Continue with ${shown}` : "Continue"} <Icon name="arrow" size={18} /></button>
            ) : (
              <button ref={cta} onClick={meet} className="btn btn-brand !h-16 !px-9 !text-[18px]">Meet {shown} <Icon name="arrow" size={20} /></button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
