"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { isCreated, primaryOf, setPrimary, toast, type State } from "@/lib/store";
import Icon from "../Icon";
import { openAgent } from "../overlays";

/** Long-press (phone), right-click or hover-hold (desktop) on an agent: quick actions, including Make primary for agents you made. */
export function useAgentMenu() {
  const [at, setAt] = useState<{ id: string; x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fired = useRef(false);
  const bind = (id: string) => ({
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setAt({ id, x: e.clientX, y: e.clientY }); },
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      if (e.pointerType === "mouse") return;
      const { clientX: x, clientY: y } = e;
      timer.current = setTimeout(() => { fired.current = true; navigator.vibrate?.(12); setAt({ id, x, y }); }, 480);
    },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerLeave: () => clearTimeout(timer.current),
    onPointerMove: (e: React.PointerEvent) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(timer.current); },
    onClickCapture: (e: React.MouseEvent) => { if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false; } },
  });
  return { at, close: () => setAt(null), bind };
}

export function AgentMenu({ s, at, close, onChat, name }: { s: State; at: { id: string; x: number; y: number } | null; close: () => void; onChat: (id: string) => void; name: (id: string) => string }) {
  useEffect(() => {
    if (!at) return;
    const off = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest("[data-agent-menu]")) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    setTimeout(() => window.addEventListener("pointerdown", off), 0);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", off); window.removeEventListener("keydown", esc); };
  }, [at, close]);
  if (!at) return null;
  const created = isCreated(s, at.id);
  const primary = primaryOf(s) === at.id;
  const left = Math.min(Math.max(8, at.x - 100), (typeof window !== "undefined" ? innerWidth : 400) - 216);
  const top = Math.min(at.y + 8, (typeof window !== "undefined" ? innerHeight : 800) - 220);
  const item = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-ink hover:bg-tint";
  return (
    <div data-agent-menu role="menu" aria-label={`${name(at.id)} actions`} className="pop fixed z-[95] w-[208px] rounded-2xl bg-card p-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,.5)] ring-1 ring-line" style={{ left, top }}>
      <div className="px-3 pb-1 pt-1.5 text-[12px] font-bold text-ink/50">{name(at.id)}{primary ? " · primary" : ""}</div>
      <button role="menuitem" className={item} onClick={() => { onChat(at.id); close(); }}><Icon name="chat" size={16} />Open chat</button>
      <button role="menuitem" className={item} onClick={() => { openAgent(at.id); close(); }}><Icon name="idcard" size={16} />Profile and ID card</button>
      {created && !primary && <button role="menuitem" data-make-primary={at.id} className={item} onClick={() => { setPrimary(at.id); toast({ text: `${name(at.id)} is now your primary agent` }); close(); }}><Icon name="crown" size={16} className="text-[#d9a514]" />Make primary</button>}
      {!created && <div className="px-3 py-2 text-[12px] leading-snug text-ink/50">Hired specialists can&apos;t be primary.</div>}
    </div>
  );
}
