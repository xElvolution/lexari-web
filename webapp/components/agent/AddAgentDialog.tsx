"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import Face from "@shared/components/Face";
import { PALETTE } from "@shared/components/avatar";
import { AGENT_TEMPLATES, SPECIALISTS, STORE_CATS, compact, storeMeta, type StoreCat, type ToneId } from "@/content/appData";
import { createAgent, planOf, seatsLeft, useApp } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { HireBtn, StarRow } from "../market/parts";
import { closeAdd, useOverlays } from "../overlays";
import SetupSequence from "./SetupSequence";
import MintFinish from "./MintFinish";
import { AvatarPicker, Field, SkillPicker, TonePicker, areaCls, inputCls, variant, type Look } from "./fields";

const STEPS = ["Basics", "Look", "Personality"];

/** Two ways to add an agent: make your own, or get a quick recommendation from the marketplace. */
export default function AddAgentDialog() {
  const { add } = useOverlays();
  if (!add) return null;
  return <Dialog key={`${add.mode}-${add.cat ?? ""}`} mode={add.mode} cat={add.cat} />;
}

function Dialog({ mode: start, cat: startCat }: { mode: "choose" | "create" | "hire"; cat?: string }) {
  const [mode, setMode] = useState(start);
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(card.current, { y: 26, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.38, ease: "power3.out" }); }, []);
  useLayoutEffect(() => { if (mode !== start && card.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(card.current.querySelector("[data-body]"), { x: 18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: "power2.out" }); }, [mode, start]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") closeAdd(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const wide = mode === "create";
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAdd(); }}>
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby="add-title" data-tour="add-dialog" className={`pb-safe-dlg flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-card ring-1 ring-line sm:rounded-[30px] ${wide ? "max-w-[720px]" : "max-w-[560px]"}`}>
        <div className="flex shrink-0 items-center gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
          {mode !== "choose" && start === "choose" && <button onClick={() => setMode("choose")} aria-label="Back" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="back" size={19} /></button>}
          <div className="min-w-0 flex-1">
            <h2 id="add-title" className="display text-[30px] leading-none text-ink sm:text-[34px]">{mode === "choose" ? "Add an agent." : mode === "create" ? "Create an agent." : "Hire an agent."}</h2>
            <p className="mt-1.5 text-[14px] text-ink/60">{mode === "choose" ? "Make your own from scratch, or hire a specialist someone else built." : mode === "create" ? "Give it a name, a job and a face. It gets its own computer and memory." : "Tell us what you need. We'll suggest three agents from the marketplace."}</p>
          </div>
          <button onClick={closeAdd} aria-label="Close" data-tour="add-close" className="grid h-10 w-10 shrink-0 place-items-center self-start rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button>
        </div>
        <div data-body className="no-bar min-h-0 flex-1 overflow-y-auto px-5 pb-1 pt-5 sm:px-7">
          {mode === "choose" && <Choose onPick={setMode} />}
          {mode === "create" && <Create />}
          {mode === "hire" && <Hire startCat={startCat} />}
        </div>
      </div>
    </div>
  );
}

function Choose({ onPick }: { onPick: (m: "create" | "hire") => void }) {
  const faces = [{ seed: 16, color: "blue" }, { seed: 27, color: "yellow" }, { seed: 49, color: "pink" }] as const;
  return (
    <div className="grid gap-3 pb-4 sm:grid-cols-2">
      <button onClick={() => onPick("create")} className="group relative overflow-hidden rounded-[26px] bg-grape p-5 text-left text-white shadow-[0_18px_40px_-20px_rgba(91,43,255,.9)] transition hover:-translate-y-0.5">
        <span className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full border border-white/15" />
        <span className="relative grid h-[88px] w-[88px] place-items-center rounded-[26px] bg-white/15 transition duration-300 group-hover:rotate-[-4deg] group-hover:scale-105"><Face variant={{ shape: "blob", color: "lilac", eyes: "happy", mouth: "grin", extra: "none", blush: true }} size={70} /></span>
        <span className="relative mt-4 block text-[20px] font-bold">Create an agent</span>
        <span className="relative mt-1 block text-[14px] leading-snug text-white/80">Name it, tell it what to do, pick its face and personality.</span>
        <span className="relative mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold">Start building <Icon name="arrow" size={16} className="transition group-hover:translate-x-1" /></span>
      </button>
      <button onClick={() => onPick("hire")} className="group relative overflow-hidden rounded-[26px] bg-tint p-5 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-grape/50">
        <span className="relative flex h-[88px] items-center">
          {faces.map((f, i) => <span key={i} className="-ml-3 grid h-[64px] w-[64px] place-items-center rounded-[20px] ring-4 ring-[var(--tint)] transition duration-300 first:ml-0 group-hover:-translate-y-1" style={{ background: `color-mix(in oklab, ${PALETTE[f.color].fill} 30%, var(--card))`, transitionDelay: `${i * 50}ms` }}><Face seed={f.seed} variant={{ color: f.color }} size={50} /></span>)}
        </span>
        <span className="mt-4 block text-[20px] font-bold text-ink">Hire an agent</span>
        <span className="mt-1 block text-[14px] leading-snug text-ink/65">Tell us what you need and get three picks from the marketplace.</span>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-brand-ink">Get recommendations <Icon name="arrow" size={16} className="transition group-hover:translate-x-1" /></span>
      </button>
    </div>
  );
}

function Create() {
  const s = useApp()!;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tpl, setTpl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [about, setAbout] = useState("");
  const [look, setLook] = useState<Look>({ shape: "blob", color: "purple", eyes: "happy", mouth: "smile" });
  const [tone, setTone] = useState<ToneId>("warm");
  const [skills, setSkills] = useState<string[]>(["web", "files"]);
  const [memory, setMemory] = useState(true);
  const [phase, setPhase] = useState<"form" | "setup" | "done">("form");
  const [made, setMade] = useState<string | null>(null);
  const nameOk = name.trim().length > 0;

  const applyTpl = (id: string | null) => {
    setTpl(id);
    const t = AGENT_TEMPLATES.find((x) => x.id === id);
    if (!t) { setRole(""); setAbout(""); setSkills([]); return; }
    setRole(t.role); setAbout(t.about); setSkills([...t.skills]); setLook((l) => ({ ...l, shape: t.shape, color: t.color }));
  };
  const make = () => { if (nameOk && phase === "form") setPhase("setup"); };
  const ready = () => {
    const id = createAgent({ name: name.trim(), role: role.trim() || "Custom agent", about: about.trim(), template: tpl, ...look, tone, skills, memory });
    setMade(id); setPhase("done");
  };
  const open = () => { closeAdd(); if (made) router.push(`/app?c=${made}`); };

  if (phase === "setup") return <SetupSequence name={name.trim()} v={variant(look)} bg={look.bg} onDone={ready} />;
  if (phase === "done" && made && s.custom.some((c) => c.id === made)) return (
    <MintFinish s={s} id={made} v={variant(look)} title={`Say hi to ${name.trim()}.`}
      sub="Its computer is on and its memory is ready. Mint its ID card on chain now, or do it later from its profile."
      later={open} laterLabel={s.meta[made]?.nft ? `Open chat with ${name.trim()}` : "Later, open chat"} />
  );

  return (
    <div className="pb-4">
      <ol className="mb-5 flex items-center gap-2" aria-label="Steps">
        {STEPS.map((l, i) => (
          <li key={l} className="flex flex-1 items-center gap-2">
            <button type="button" onClick={() => (i < step || nameOk) && setStep(i)} className={`flex items-center gap-2 text-[13px] font-bold ${i === step ? "text-ink" : i < step ? "text-brand-ink" : "text-ink/45"}`} aria-current={i === step ? "step" : undefined}>
              <span className={`grid h-7 w-7 place-items-center rounded-full text-[12.5px] transition ${i < step ? "bg-grape text-white" : i === step ? "bg-ink text-[var(--bg)]" : "bg-tint text-ink/50"}`}>{i < step ? <Icon name="check" size={14} stroke={3} /> : i + 1}</span>
              <span className="hidden sm:inline">{l}</span>
            </button>
            {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded-full ${i < step ? "bg-grape" : "bg-line"}`} />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-5">
          <div>
            <span className="label text-[9.5px] text-ink/60">Start from a role, or blank</span>
            <div className="no-bar -mx-1 mt-2 flex flex-wrap gap-2 px-1">
              <button type="button" onClick={() => applyTpl(null)} aria-pressed={tpl === null} className={`flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-bold transition ${tpl === null ? "bg-ink text-[var(--bg)]" : "text-ink/75 ring-1 ring-line hover:ring-grape/50"}`}><Icon name="plus" size={15} />Blank</button>
              {AGENT_TEMPLATES.map((t) => <button type="button" key={t.id} onClick={() => applyTpl(t.id)} aria-pressed={tpl === t.id} className={`flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-bold transition ${tpl === t.id ? "bg-grape text-white" : "text-ink/75 ring-1 ring-line hover:ring-grape/50"}`}><Icon name={t.icon} size={15} />{t.label}</button>)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" hint={`${name.length}/16`}><input autoFocus value={name} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 16))} onKeyDown={(e) => { if (e.key === "Enter" && nameOk) setStep(1); }} placeholder="Nova" className={inputCls} /></Field>
            <Field label="Role"><input value={role} onChange={(e) => setRole(e.target.value.slice(0, 28))} placeholder="Research, writing, planning…" className={inputCls} /></Field>
          </div>
          <Field label="What should it do?" hint="Instructions it always follows"><textarea value={about} onChange={(e) => setAbout(e.target.value.slice(0, 400))} placeholder="Every Monday, read my inbox and tell me the three things that need me. Keep it short." className={areaCls} /></Field>
        </div>
      )}
      {step === 1 && <AvatarPicker v={look} onChange={setLook} name={name.trim() || undefined} />}
      {step === 2 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-5">
            <Field label="Personality"><TonePicker tone={tone} onChange={setTone} /></Field>
            <div className="flex items-center gap-3 rounded-2xl bg-tint p-3.5">
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold text-ink">Memory</span><span className="block text-[12.5px] text-ink/60">Remembers what you tell it, in its own brain.</span></span>
              <button type="button" role="switch" aria-checked={memory} aria-label="Memory" onClick={() => setMemory(!memory)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${memory ? "bg-grape" : "bg-ink/20"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${memory ? "left-6" : "left-1"}`} /></button>
            </div>
            <div className="flex items-center gap-3 rounded-2xl p-3.5 ring-1 ring-line">
              <AgentPreview name={name} role={role} look={look} />
            </div>
          </div>
          <div><span className="label text-[9.5px] text-ink/60">Skills · optional</span><div className="mt-1.5"><SkillPicker skills={skills} onChange={setSkills} /></div></div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 mt-6 flex items-center gap-2 bg-card px-1 pt-2">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="btn btn-line btn-sm text-ink">Back</button>}
        <span className="flex-1 text-[12.5px] text-ink/50">{planOf(s).name} plan · agents you make don&apos;t use a seat (demo)</span>
        {step < 2
          ? <button type="button" disabled={!nameOk} onClick={() => setStep(step + 1)} className="btn btn-brand btn-sm disabled:opacity-40 disabled:shadow-none">Next</button>
          : <button type="button" onClick={make} className="btn btn-brand btn-sm"><Icon name="spark" size={16} />Create {name.trim() || "agent"}</button>}
      </div>
    </div>
  );
}

function AgentPreview({ name, role, look }: { name: string; role: string; look: Look }) {
  return (
    <>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--face-tile)" }}><Face variant={variant(look)} size={40} /></span>
      <span className="min-w-0"><span className="block truncate text-[15px] font-bold text-ink">{name.trim() || "Your new agent"}</span><span className="block truncate text-[12.5px] text-ink/55">{role.trim() || "Custom agent"} · joins your strip</span></span>
    </>
  );
}

const STOP = new Set(["the", "and", "for", "with", "into", "from", "that", "this", "turn", "make", "help", "need", "want", "can", "you", "all", "any", "out", "get", "our", "your", "some", "every"]);
const NEEDS: { id: StoreCat; label: string }[] = STORE_CATS.filter((c) => ["Research", "Writing", "Finance", "Design", "Dev", "Marketing"].includes(c.id)).map((c) => ({ id: c.id, label: c.id }));

function Hire({ startCat }: { startCat?: string }) {
  const s = useApp()!;
  const [cat, setCat] = useState<StoreCat | null>((NEEDS.find((n) => n.id === startCat)?.id) ?? null);
  const [text, setText] = useState("");
  const picks = useMemo(() => {
    const t = text.toLowerCase();
    const words = t.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
    return SPECIALISTS.map((a) => {
      const m = storeMeta(a);
      let score = cat && m.cat === cat ? 10 : 0;
      words.forEach((w) => { if (a.words.some((k) => k.includes(w) || w.includes(k))) score += 4; if (`${a.job} ${a.back}`.toLowerCase().includes(w)) score += 2; });
      return { a, m, score: score + a.rating / 10 };
    }).sort((x, y) => y.score - x.score).slice(0, 3);
  }, [cat, text]);
  const asked = !!cat || text.trim().length > 2;
  const left = seatsLeft(s);

  return (
    <div className="pb-4">
      <p className="text-[17px] font-bold text-ink">What do you need help with?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {NEEDS.map((n) => <button key={n.id} onClick={() => setCat(cat === n.id ? null : n.id)} aria-pressed={cat === n.id} className={`flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-bold transition ${cat === n.id ? "bg-grape text-white" : "text-ink/75 ring-1 ring-line hover:ring-grape/50"}`}><Icon name={STORE_CATS.find((c) => c.id === n.id)!.icon} size={15} />{n.label}</button>)}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 200))} placeholder="Or describe it: “turn my meeting notes into a weekly report”" className={`${areaCls} mt-3 !min-h-[70px]`} aria-label="Describe what you need" />

      <div className="mt-5 flex items-baseline justify-between">
        <span className="label text-[9.5px] text-ink/60">{asked ? "Recommended for you" : "Popular right now"}</span>
        <span className="text-[12.5px] text-ink/50">{left > 0 ? `${left} open seat${left === 1 ? "" : "s"}` : "No open seats"}</span>
      </div>
      <ul className="mt-2 space-y-2">
        {picks.map(({ a, m }, i) => (
          <li key={a.slug} className="pop flex items-center gap-3 rounded-[20px] p-2.5 ring-1 ring-line" style={{ animationDelay: `${i * 60}ms` }}>
            <Link href={`/app/marketplace/${a.slug}`} onClick={closeAdd} className="shrink-0"><AgentTile id={a.slug} look={null} size={56} radius={18} /></Link>
            <span className="min-w-0 flex-1">
              <Link href={`/app/marketplace/${a.slug}`} onClick={closeAdd} className="block truncate text-[15.5px] font-bold text-ink hover:text-brand-ink">{a.name} <span className="font-semibold text-ink/50">· {a.job}</span></Link>
              <span className="block truncate text-[13px] text-ink/60">{a.quip}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink/60"><StarRow v={a.rating} size={11} /><span className="font-semibold">{a.rating}</span><span className="text-ink/35">·</span>{compact(m.hires)} hires<span className="text-ink/35">·</span>{m.maker}</span>
            </span>
            <HireBtn a={a} />
          </li>
        ))}
      </ul>
      <Link href={`/app/marketplace${cat ? `?cat=${cat}` : ""}`} onClick={closeAdd} className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-tint py-3.5 text-[14.5px] font-bold text-brand-ink transition hover:bg-grape hover:text-white">
        Browse the full marketplace{cat ? ` · ${cat}` : ""}<Icon name="arrow" size={16} />
      </Link>
      <p className="mt-2 text-center text-[12px] text-ink/45">Ratings and hires are demo data.</p>
    </div>
  );
}
