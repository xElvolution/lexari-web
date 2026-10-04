"use client";

import Link from "next/link";
import { openAdd } from "../overlays";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { SPECIALISTS, type MemoryTag } from "@/content/appData";
import { eraseMemory } from "@/lib/chain";
import { friendly } from "@/lib/api";
import { bridgeFor } from "@/lib/walletBridge";
import { addNote, agentName, downloadFile, editNote, forgetNote, get, toast, unlockMemories, useApp, type Note, type State } from "@/lib/store";
import Icon from "../Icon";
import { SpecFace } from "../faces";
import { ago } from "../ui";
import { BrainScene, CATS } from "./scene";

const EDITABLE = new Set(["About you", "Preferences", "People", "Tools", "Habits"]);
const BLURB: Record<string, string> = {
  "About you": "Who you are and how you like to be addressed.",
  Preferences: "How you like work done and delivered.",
  People: "Who is on your team and what they own.",
  Tools: "The apps and formats you use.",
  Habits: "Your routines and deadlines.",
  Files: "Outputs your agent saved from finished jobs.",
  "Hired agents": "Specialists working in your seats.",
};

function countFor(s: State, id: string) {
  if (id === "Files") return s.jobs.filter((j) => j.status !== "running").reduce((a, j) => a + j.files.length, 0);
  if (id === "Hired agents") return s.hired.length;
  return s.memory.filter((m) => m.tag === id).length;
}

function NoteRow({ n, now }: { n: Note; now: number }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(n.text);
  const [busy, setBusy] = useState(false);
  const row = useRef<HTMLLIElement>(null);
  const signer = () => bridgeFor(get().auth?.address);
  const save = () => {
    const t = text.trim();
    if (t && t !== n.text) {
      const oldHash = n.chainHash;
      const asset = n.chainAsset;
      editNote(n.id, { text: t, chainHash: undefined, chainAsset: undefined, pendingChain: true });
      const b = signer();
      if (oldHash && asset && b) {
        eraseMemory({ bridge: b, asset, hashHex: oldHash }).catch(() => toast({ text: "The new note is saved. The old onchain record could not be removed.", face: "home" }));
      }
      toast({ text: "Memory updated", face: "home" });
    }
    setEdit(false);
  };
  const forget = async () => {
    const el = row.current; if (!el || busy) return;
    const onchain = !!(n.chainHash && n.chainAsset);
    if (onchain) {
      const b = signer();
      if (!b) { toast({ text: "Connect the wallet that owns this memory to delete it on Solana.", face: "home" }); return; }
      setBusy(true);
      try { await eraseMemory({ bridge: b, asset: n.chainAsset!, hashHex: n.chainHash! }); }
      catch (e) {
        toast({ text: `Still remembered. ${friendly(e)}`, face: "home" });
        setBusy(false);
        return;
      }
      editNote(n.id, { chainHash: undefined, chainAsset: undefined, pendingChain: false });
    }
    gsap.to(el, { x: 40, opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, duration: 0.4, ease: "power2.in", onComplete: () => {
      const undo = forgetNote(n.id);
      toast({ text: onchain ? "Deleted on Solana. Undo saves it again, off-chain." : "Forgotten", face: "home", action: { label: "Undo", run: undo } });
    } });
  };
  return (
    <li ref={row} className="group overflow-hidden rounded-2xl bg-alt p-3.5 ring-1 ring-line">
      {edit ? (
        <div>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === "Escape") setEdit(false); }} rows={2} className="field !rounded-xl !p-2.5 !text-[15px]" aria-label="Edit memory" />
          <div className="mt-2 flex justify-end gap-2"><button onClick={() => setEdit(false)} className="rounded-full px-3 py-1.5 text-[13px] font-bold text-ink/70 hover:text-ink">Cancel</button><button onClick={save} className="rounded-full bg-grape px-3.5 py-1.5 text-[13px] font-bold text-white">Save</button></div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-snug text-ink">{n.locked ? <span className="text-ink/45">Encrypted. Open your memories to read it.</span> : n.text}</p>
            <p className="label mt-1.5 text-[9px] text-ink/60">{n.source} · {ago(n.at, now)}{n.chainHash ? " · on Solana" : ""}</p>
          </div>
          <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-60 sm:group-hover:opacity-100">
            <button onClick={() => setEdit(true)} aria-label="Edit memory" className="grid h-8 w-8 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-brand-ink"><Icon name="edit" size={15} /></button>
            <button onClick={forget} disabled={busy} aria-label="Forget memory" className="grid h-8 w-8 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-brand-ink disabled:opacity-40"><Icon name="trash" size={15} /></button>
          </div>
        </div>
      )}
    </li>
  );
}

function Panel({ s, cat, onClose }: { s: State; cat: number; onClose: () => void }) {
  const c = CATS[cat]; const id = c.id;
  const el = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), [s]);
  useEffect(() => {
    if (!el.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wide = window.innerWidth >= 900;
    gsap.fromTo(el.current, wide ? { x: 50, opacity: 0 } : { y: 60, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.55, ease: "back.out(1.4)" });
    gsap.from(el.current.querySelectorAll("li"), { y: 14, opacity: 0, stagger: 0.04, duration: 0.4, delay: 0.12, ease: "power2.out", clearProps: "all" });
  }, [cat]);
  const notes = s.memory.filter((m) => m.tag === id);
  const files = s.jobs.filter((j) => j.status !== "running").flatMap((j) => j.files.map((f) => ({ ...f, job: j.id, at: j.startedAt + j.duration })));
  const hired = SPECIALISTS.filter((sp) => s.hired.includes(sp.slug));
  const teach = () => { const t = draft.trim(); if (!t) return; addNote(t, id as MemoryTag, "You", true); setDraft(""); };

  return (
    <div ref={el} role="dialog" aria-label={`${id} memories`} className="absolute inset-x-3 bottom-3 z-20 flex max-h-[64%] flex-col rounded-[26px] bg-card/90 shadow-[0_30px_80px_-30px_rgba(20,0,80,.6)] ring-1 ring-line backdrop-blur-xl min-[900px]:inset-x-auto min-[900px]:bottom-5 min-[900px]:right-5 min-[900px]:top-5 min-[900px]:max-h-none min-[900px]:w-[400px]">
      <div className="flex items-start gap-3 border-b border-line p-5 pb-4">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full ring-4 ring-tint" style={{ background: `var(--cat-${cat})` }} />
        <div className="min-w-0 flex-1">
          <h2 className="display text-[32px] leading-none text-ink">{id}</h2>
          <p className="mt-1.5 text-[14px] text-ink/70">{BLURB[id]}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-ink transition hover:rotate-90"><Icon name="x" size={16} /></button>
      </div>
      <div className="no-bar min-h-0 flex-1 overflow-y-auto p-4">
        {s.memoryLocked && EDITABLE.has(id) && notes.some((n) => n.locked) && <button onClick={() => void unlockMemories()} className="mb-2 flex w-full items-center justify-between gap-2 rounded-2xl bg-tint px-3.5 py-2.5 text-left text-[13px] text-ink/75"><span>These are encrypted on this device.</span><span className="font-bold text-brand-ink">Open</span></button>}
        {EDITABLE.has(id) && (notes.length ? <ul className="grid gap-2">{notes.map((n) => <NoteRow key={n.id} n={n} now={now} />)}</ul>
          : <p className="rounded-2xl border-2 border-dashed border-line p-5 text-center text-[14px] text-ink/70">Nothing here yet. Teach {agentName(s)} something below.</p>)}
        {id === "Files" && (files.length ? (
          <ul className="grid gap-2">
            {files.map((f) => (
              <li key={`${f.job}-${f.name}`} className="flex items-center gap-3 rounded-2xl bg-alt p-3 ring-1 ring-line">
                <span className="grid h-9 w-8 place-items-center rounded-md bg-grape text-[9px] font-bold uppercase text-white">{f.name.split(".").pop()}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-mono text-[13px] text-ink">{f.name}</p><p className="label mt-1 text-[9px] text-ink/60">Job #{String(f.job).padStart(3, "0")} · {f.size}</p></div>
                <button onClick={() => downloadFile(f.name, f.body)} aria-label={`Download ${f.name}`} className="grid h-8 w-8 place-items-center rounded-full text-ink/75 hover:bg-tint hover:text-brand-ink"><Icon name="download" size={15} /></button>
              </li>
            ))}
          </ul>) : <p className="rounded-2xl border-2 border-dashed border-line p-5 text-center text-[14px] text-ink/70">No files yet. Finished jobs save them here.</p>)}
        {id === "Hired agents" && (hired.length ? (
          <ul className="grid gap-2">
            {hired.map((h) => (
              <li key={h.slug}><Link href={`/marketplace/${h.slug}`} className="flex items-center gap-3 rounded-2xl bg-alt p-2.5 ring-1 ring-line transition hover:ring-grape/50">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-tint"><SpecFace slug={h.slug} size={36} /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold text-ink">{h.name}</span><span className="block text-[13px] text-ink/70">{h.job}</span></span>
                <Icon name="arrow" size={16} className="mr-1 text-ink/60" />
              </Link></li>
            ))}
          </ul>) : <p className="rounded-2xl border-2 border-dashed border-line p-5 text-center text-[14px] text-ink/70">No one hired yet. <button onClick={() => openAdd("hire")} className="font-bold text-brand-ink">Add an agent</button></p>)}
      </div>
      {EDITABLE.has(id) && (
        <form onSubmit={(e) => { e.preventDefault(); teach(); }} className="flex gap-2 border-t border-line p-3">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={id === "About you" ? `Tell ${agentName(s)} about you` : `Add to ${id.toLowerCase()}`} className="field !h-11 !rounded-full !py-0 !text-[15px]" aria-label="New memory" maxLength={120} />
          <button disabled={!draft.trim()} aria-label="Remember this" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-grape text-white transition hover:scale-105 disabled:opacity-40"><Icon name="plus" size={18} /></button>
        </form>
      )}
    </div>
  );
}

export default function Brain() {
  const s = useApp()!;
  const host = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scene = useRef<BrainScene | null>(null);
  const [focus, setFocus] = useState(-1);
  const [failed, setFailed] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const total = s.memory.length;
  const counts = useMemo(() => CATS.map((c) => countFor(s, c.id)), [s]);

  useEffect(() => {
    const h = host.current; if (!h) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      const sc = new BrainScene(h, chipRefs.current, { dark: document.documentElement.getAttribute("data-theme") !== "light", reduce });
      sc.onArrive = (i) => { const el = chipRefs.current[i]; if (el) gsap.fromTo(el, { scale: 1.35 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, .4)", overwrite: "auto" }); };
      scene.current = sc;
    } catch { setFailed(true); }
    const mo = new MutationObserver(() => scene.current?.setTheme(document.documentElement.getAttribute("data-theme") !== "light"));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mo.disconnect(); scene.current?.destroy(); scene.current = null; };
  }, []);

  // a new memory anywhere in the app fires a write into its region
  useEffect(() => {
    const ids = new Set(s.memory.map((m) => m.id));
    if (seen.current) s.memory.filter((m) => !seen.current!.has(m.id)).forEach((m) => { const i = CATS.findIndex((c) => c.id === m.tag); if (i >= 0) scene.current?.write(i); });
    seen.current = ids;
  }, [s.memory]);

  const open = (i: number) => { const next = focus === i ? -1 : i; setFocus(next); scene.current?.setFocus(next, { panel: true }); };
  const close = () => { setFocus(-1); scene.current?.setFocus(-1); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); });

  return (
    <section className="brain-stage relative h-[calc(100svh-132px-env(safe-area-inset-bottom))] min-h-[480px] overflow-hidden lg:h-[100svh]" style={Object.fromEntries(CATS.map((c, i) => [`--cat-${i}`, `var(--cat-${i}-v)`])) as React.CSSProperties}>
      <style>{`:root,[data-theme="light"]{${CATS.map((c, i) => `--cat-${i}-v:${c.light}`).join(";")}}[data-theme="dark"]{${CATS.map((c, i) => `--cat-${i}-v:${c.dark}`).join(";")}}`}</style>
      <div ref={host} className="absolute inset-0" aria-label={`${agentName(s)}'s brain. Drag to turn it.`} role="img">
        {CATS.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => { chipRefs.current[i] = el; }}
            onClick={() => open(i)}
            onMouseEnter={() => scene.current?.setHover(i)}
            onMouseLeave={() => scene.current?.setHover(-1)}
            onFocus={() => scene.current?.setHover(i)}
            onBlur={() => scene.current?.setHover(-1)}
            aria-pressed={focus === i}
            className={`brain-chip label flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-[10px] ring-1 backdrop-blur-md sm:text-[10.5px] ${focus === i ? "bg-grape text-white ring-grape shadow-[0_0_0_6px_rgba(91,43,255,.25)]" : "bg-card/75 text-ink ring-line hover:bg-card hover:ring-grape/60"}`}
            style={{ opacity: 0 }}
          >
            <i className="h-2 w-2 rounded-full" style={{ background: focus === i ? "#fff" : `var(--cat-${i})`, boxShadow: `0 0 10px var(--cat-${i})` }} />
            {c.id}<span className={`tab-num ${focus === i ? "text-white/80" : "text-ink/60"}`}>{counts[i]}</span>
          </button>
        ))}
      </div>

      <div className="pointer-events-none absolute left-5 top-5 z-10 sm:left-8 sm:top-8">
        <p className="label flex items-center gap-2 text-brand-ink"><i className="live-dot h-2 w-2 rounded-full bg-grape" />Memory</p>
        <h1 className="display mt-2 text-[40px] text-ink sm:text-[60px]">{agentName(s)}&apos;s brain</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-ink/70"><span className="tab-num font-bold text-ink">{total}</span> memories in {CATS.length} areas</p>
      </div>
      <p className={`label pointer-events-none absolute inset-x-0 bottom-4 z-10 mx-auto w-max max-w-[calc(100%-2rem)] rounded-full bg-card/85 px-3.5 py-2 text-center text-[9.5px] text-ink/75 shadow-[0_8px_24px_-12px_rgba(20,0,80,.35)] ring-1 ring-line backdrop-blur-md transition-opacity sm:inset-x-auto sm:left-8 sm:mx-0 ${focus >= 0 ? "opacity-0 min-[900px]:opacity-100" : ""}`}>Drag to turn · tap a label to open it</p>
      {failed && <p className="absolute inset-x-5 top-1/2 z-10 text-center text-[15px] text-ink/70">Your browser could not draw the 3D brain. Tap a label above to open that memory area.</p>}
      {focus >= 0 && <Panel s={s} cat={focus} onClose={close} />}
    </section>
  );
}
