"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { endTour, setTourStep, type State } from "@/lib/store";
import Icon from "./Icon";
import { AgentTile } from "./faces";
import { myAgents, nameOf } from "./agents";

type Ctx = { me: string; you: string; spec: string; specName: string };
type Step = {
  id: string; action: "next" | "click";
  target?: (c: Ctx) => string; // data-tour value to spotlight. None: a centred card
  click?: string; // data-tour value whose click moves on (defaults to target)
  gone?: boolean; // also move on if the click target disappears (closed with Esc, swiped away)
  only?: "desktop" | "mobile"; home?: boolean; title?: (c: Ctx) => string; text: (c: Ctx) => string; praise?: string; cta?: string;
};

const STEPS: Step[] = [
  { id: "hi", action: "next", home: true, title: (c) => `Hi${c.you ? ` ${c.you}` : ""}, I'm ${c.me}.`, text: () => "Five short stops. You'll tap the real buttons.", cta: "Let's go" },
  { id: "tile", action: "click", home: true, target: (c) => `tile-${c.spec}`, text: (c) => `This row is your team. Tap ${c.specName} to open their chat.` },
  { id: "composer", action: "next", target: () => "composer", text: () => "This is where you talk. Type a message, or use the mic, the clip, or the phone." },
  { id: "brain", action: "click", target: () => "nav-brain", text: (c) => `Tap Brain. That's what I remember about you${c.you ? `, ${c.you}` : ""}, and you can edit or delete any of it.` },
  { id: "done", action: "next", title: (c) => `That's the tour${c.you ? `, ${c.you}` : ""}.`, text: () => "Bond, Market, Team and Wallets are in the menu. Replay this any time from Settings.", cta: "Finish" },
];
const PRAISE = ["Nice, you're getting the hang of it!", "Perfect.", "That's it.", "Great, keep going.", "Exactly like that."];

/** First element with that data-tour value that is actually on screen. */
function find(key: string | undefined): HTMLElement | null {
  if (!key) return null;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`))) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (getComputedStyle(el).visibility === "hidden" || el.closest("[aria-hidden='true']")) continue;
    return el;
  }
  return null;
}
type R = { x: number; y: number; w: number; h: number };
const same = (a: R | null, b: R | null) => !!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

function useWide() {
  const [w, setW] = useState(true);
  useEffect(() => { const mq = window.matchMedia("(min-width: 1024px)"); const on = () => setW(mq.matches); on(); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  return w;
}

/** Coach marks narrated by your own agent. Dims the app, spotlights one real control and waits for you to use it. */
export default function Tour({ s }: { s: State }) {
  const wide = useWide();
  const router = useRouter();
  const path = usePathname();
  const steps = useMemo(() => STEPS.filter((x) => !x.only || x.only === (wide ? "desktop" : "mobile")), [wide]);
  const [i, setI] = useState(() => Math.min(s.tour.step, steps.length - 1));
  const step = steps[Math.min(i, steps.length - 1)];
  const [prevClick, setPrevClick] = useState(false);
  const spec = useMemo(() => myAgents(s).find((a) => a.id !== "home" && a.id !== s.active)?.id ?? "home", [s.tour.on]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctx: Ctx = { me: nameOf(s, "home"), you: s.agent?.you || (s.profile?.name && s.profile.name !== "You" ? s.profile.name.split(" ")[0] : ""), spec, specName: nameOf(s, spec) };
  const tKey = step.target?.(ctx), cKey = step.action === "click" ? step.click ?? tKey : undefined;
  const [rect, setRect] = useState<R | null>(null);
  const [missing, setMissing] = useState(false);
  const [vp, setVp] = useState({ w: 1200, h: 800 });
  const card = useRef<HTMLDivElement>(null);
  const [ch, setCh] = useState(220);
  const moved = useRef(false);

  const go = (n: number, clicked = false) => {
    moved.current = true;
    if (n >= steps.length) { endTour(); return; }
    setPrevClick(clicked); setI(Math.max(0, n)); setTourStep(Math.max(0, n)); setRect(null); setMissing(false);
  };

  // steps that live on the Agents page bring you back there
  useEffect(() => { if (step.home && path !== "/app") router.push("/app"); }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // follow the target every frame; notice when a click target disappears
  useEffect(() => {
    let raf = 0, seen = false, goneAt = 0, lost = 0; const t0 = performance.now();
    moved.current = false;
    const loop = (t: number) => {
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      const el = find(tKey);
      if (el) {
        const r = el.getBoundingClientRect(); const n = { x: r.left, y: r.top, w: r.width, h: r.height };
        if (!seen && (r.bottom < 0 || r.top > window.innerHeight)) el.scrollIntoView({ block: "center", behavior: "smooth" });
        seen = true; lost = 0;
        setRect((p) => (same(p, n) ? p : n)); setMissing(false);
      } else if (tKey) {
        if (!lost) lost = t;
        if (t - lost > 250) setRect(null);
        if (!seen && t - t0 > 2600) setMissing(true);
      }
      if (step.gone && cKey) {
        const c = find(cKey);
        if (c) goneAt = 0; else if (seen) { if (!goneAt) goneAt = t; else if (t - goneAt > 500 && !moved.current) { go(i + 1, true); return; } }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [i, tKey, cKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // a real click on the spotlit control moves the tour on
  useEffect(() => {
    if (step.action !== "click" || !cKey) return;
    const onClick = (e: MouseEvent) => {
      const el = find(cKey);
      if (el && el.contains(e.target as Node) && !moved.current) { moved.current = true; setTimeout(() => go(i + 1, true), 380); }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [i, cKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[role=dialog]")) endTour(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  useLayoutEffect(() => { if (card.current) setCh(card.current.offsetHeight); });

  if (typeof document === "undefined") return null;
  const centred = !tKey || missing || !rect;
  const pad = 8;
  const hole = rect && !centred ? { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 } : null;
  const W = Math.min(372, vp.w - 24);
  let pos: { left: number; top: number; arrow?: { x: number; side: "top" | "bottom" } };
  if (!hole) pos = { left: (vp.w - W) / 2, top: Math.max(12, (vp.h - ch) / 2) };
  else {
    const cx = hole.x + hole.w / 2; const left = Math.max(12, Math.min(vp.w - W - 12, cx - W / 2));
    const ax = Math.max(22, Math.min(W - 22, cx - left));
    if (hole.y + hole.h + 14 + ch < vp.h - 8) pos = { left, top: hole.y + hole.h + 14, arrow: { x: ax, side: "top" } };
    else if (hole.y - 14 - ch > 8) pos = { left, top: hole.y - 14 - ch, arrow: { x: ax, side: "bottom" } };
    else if (hole.x + hole.w + 16 + W < vp.w) pos = { left: hole.x + hole.w + 16, top: Math.max(12, Math.min(vp.h - ch - 12, hole.y + 20)) };
    else if (hole.x - 16 - W > 0) pos = { left: hole.x - 16 - W, top: Math.max(12, Math.min(vp.h - ch - 12, hole.y + 20)) };
    else { // no room around it: dock away from the control you need to tap
      const c = find(cKey)?.getBoundingClientRect(); const low = c ? c.top + c.height / 2 > vp.h / 2 : false;
      pos = { left: (vp.w - W) / 2, top: low ? 12 : vp.h - ch - 12 };
    }
  }
  const praise = step.praise ?? (prevClick && i > 0 ? PRAISE[i % PRAISE.length] : null);
  const needsTap = step.action === "click" && !centred;
  const block = "pointer-events-auto absolute bg-transparent";

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[95]" aria-live="polite" data-tour-step={step.id} data-tour-click={cKey ?? ""} data-tour-missing={missing ? "1" : undefined}>
      {/* dim + spotlight */}
      {hole ? (
        <>
          <div className="pointer-events-none absolute rounded-[18px] transition-all duration-300 ease-out" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h, boxShadow: "0 0 0 9999px rgba(8,4,24,.64)" }} />
          <div className={`pointer-events-none absolute rounded-[18px] ring-[3px] ring-grape transition-all duration-300 ease-out ${needsTap ? "tour-pulse" : ""}`} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
          {/* blockers around the hole; the hole itself stays clickable only when you need to tap it */}
          <div className={block} style={{ left: 0, top: 0, width: "100%", height: Math.max(0, hole.y) }} />
          <div className={block} style={{ left: 0, top: hole.y + hole.h, width: "100%", bottom: 0 }} />
          <div className={block} style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
          <div className={block} style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} />
          {!needsTap && <div className={block} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />}
        </>
      ) : <div className="pointer-events-auto absolute inset-0 bg-[rgba(8,4,24,.64)] backdrop-blur-[2px]" />}

      {/* your agent, talking */}
      <div ref={card} role="dialog" aria-label={`Tour, step ${i + 1} of ${steps.length}`} className="pointer-events-auto absolute transition-[left,top] duration-300 ease-out" style={{ left: pos.left, top: pos.top, width: W }}>
        {pos.arrow && <span className={`absolute h-4 w-4 rotate-45 bg-card ring-1 ring-line ${pos.arrow.side === "top" ? "-top-2" : "-bottom-2"}`} style={{ left: pos.arrow.x - 8 }} />}
        <div key={step.id} className="tour-in relative rounded-[24px] bg-card p-4 text-ink shadow-[0_24px_60px_-18px_rgba(0,0,0,.6)] ring-1 ring-line">
          <div className="flex items-start gap-3">
            <span className="relative shrink-0"><AgentTile id="home" look={s.agent?.look} size={46} radius={15} /><span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#34d399] ring-2 ring-[var(--card)]" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><span className="text-[12.5px] font-bold text-brand-ink">{ctx.me}</span><button onClick={endTour} className="text-[12.5px] font-semibold text-ink/50 hover:text-ink">Skip tour</button></div>
              <div className="relative mt-1 rounded-[16px] rounded-tl-md bg-tint px-3.5 py-2.5">
                {praise && <p className="mb-1 text-[13.5px] font-bold text-brand-ink">{praise}</p>}
                {step.title && <p className="text-[17px] font-bold leading-tight">{step.title(ctx)}</p>}
                <p className={`text-[14.5px] leading-snug text-ink/85 ${step.title ? "mt-1" : ""}`}>{step.text(ctx)}</p>
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-[4px] overflow-hidden" role="img" aria-label={`Step ${i + 1} of ${steps.length}`}>
              {steps.map((x, k) => <i key={x.id} className={`h-[5px] shrink-0 rounded-full transition-all duration-300 ${k === i ? "w-3.5 bg-grape" : k < i ? "w-[5px] bg-grape/55" : "w-[5px] bg-ink/15"}`} />)}
            </div>
            {i > 0 && <button onClick={() => go(i - 1)} className="h-9 rounded-full px-3 text-[13.5px] font-bold text-ink/70 hover:bg-tint hover:text-ink">Back</button>}
            {needsTap
              ? <span className="flex h-9 items-center gap-1.5 rounded-full bg-tint px-3 text-[13px] font-bold text-brand-ink"><Icon name="hand" size={15} className="tour-tap" />Tap it</span>
              : <button onClick={() => (i === steps.length - 1 ? endTour() : go(i + 1))} className="h-9 rounded-full bg-grape px-4 text-[13.5px] font-bold text-white transition hover:bg-grape-deep">{step.cta ?? (missing ? "Skip step" : "Next")}</button>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
