"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { dismiss, useApp, useToasts, type Toast } from "@/lib/store";
import { AgentFace } from "./faces";
import Face from "../Face";
import type { ColorKey } from "../avatar";
import Icon from "./Icon";

function Item({ t }: { t: Toast }) {
  const el = useRef<HTMLDivElement>(null);
  const s = useApp();
  useEffect(() => { if (el.current) gsap.fromTo(el.current, { y: 30, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.8)" }); }, []);
  return (
    <div ref={el} role="status" className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-ink py-2.5 pl-2.5 pr-3 text-[var(--bg)] shadow-[0_18px_40px_-12px_rgba(20,0,80,.6)]">
      {t.face !== undefined && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0a0a0a]">{t.face === "home" ? <AgentFace look={s?.agent?.look} size={30} /> : t.face === null ? <Face size={30} /> : <Face seed={t.face} variant={t.color ? { color: t.color as ColorKey } : undefined} size={30} />}</span>}
      <span className="text-[14px] font-semibold leading-snug">{t.text}</span>
      {t.action && <button onClick={() => { t.action!.run(); dismiss(t.id); }} className="ml-1 rounded-full bg-grape px-3 py-1.5 text-[13px] font-bold text-white transition hover:scale-105">{t.action.label}</button>}
      <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--bg)]/60 hover:text-base"><Icon name="x" size={14} /></button>
    </div>
  );
}

export default function Toaster() {
  const list = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[92px] z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end lg:bottom-6">
      {list.map((t) => <div key={t.id} className="w-full max-w-[420px]"><Item t={t} /></div>)}
    </div>
  );
}
