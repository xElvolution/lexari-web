"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { deleteCustom, isCreated, primaryOf, release, setPrefs, setPrimary, toast, type State } from "@/lib/store";
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
  const [ask, setAsk] = useState<"" | "release" | "delete">("");
  useEffect(() => { setAsk(""); }, [at]);
  if (!at) return null;
  const id = at.id;
  const created = isCreated(s, id);
  const hired = s.hired.includes(id);
  const custom = s.custom.some((c) => c.id === id);
  const primary = primaryOf(s) === id;
  const nm = name(id);
  const left = Math.min(Math.max(8, at.x - 100), (typeof window !== "undefined" ? innerWidth : 400) - 236);
  const top = Math.max(8, Math.min(at.y + 8, (typeof window !== "undefined" ? innerHeight : 800) - (ask ? 210 : 280)));
  const item = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-ink hover:bg-tint";
  const leave = () => { if (window.location.pathname === `/agents/${encodeURIComponent(id)}`) window.history.replaceState(null, "", "/agents"); };
  const doRelease = () => { release(id); leave(); toast({ text: `${nm} was released. Hire them again any time from the marketplace.` }); close(); };
  const doDelete = () => { if (primary) setPrefs({ primary: "home" }); deleteCustom(id); leave(); toast({ text: `${nm} was deleted` }); close(); };
  return (
    <div data-agent-menu role="menu" aria-label={`${nm} actions`} className="pop fixed z-[95] w-[228px] rounded-2xl bg-card p-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,.5)] ring-1 ring-line" style={{ left, top }}>
      <div className="px-3 pb-1 pt-1.5 text-[12px] font-bold text-ink/50">{nm}{primary ? " · primary" : hired ? " · hired" : created ? " · made by you" : ""}</div>
      {ask ? (
        <div data-agent-menu-confirm={ask} className="px-3 pb-2 pt-1">
          <p className="text-[14px] font-bold text-ink">{ask === "release" ? `Release ${nm}?` : `Delete ${nm}?`}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink/60">{ask === "release" ? "It leaves its seat and your groups. Its chat stays. You can hire it again for free." : `Its chat, memories and card go too. This can't be undone.${primary ? " Your personal agent becomes primary." : ""}`}</p>
          <div className="mt-2.5 flex gap-1.5">
            <button onClick={() => setAsk("")} className="h-9 flex-1 rounded-full bg-tint text-[13px] font-bold text-ink">Keep</button>
            <button data-agent-menu-yes onClick={ask === "release" ? doRelease : doDelete} className="h-9 flex-1 rounded-full bg-[#e5484d] text-[13px] font-bold text-white">{ask === "release" ? "Release" : "Delete"}</button>
          </div>
        </div>
      ) : (
        <>
          <button role="menuitem" className={item} onClick={() => { onChat(id); close(); }}><Icon name="chat" size={16} />Open chat</button>
          <button role="menuitem" className={item} onClick={() => { openAgent(id); close(); }}><Icon name="idcard" size={16} />Profile and ID card</button>
          {created && !primary && <button role="menuitem" data-make-primary={id} className={item} onClick={() => { setPrimary(id); toast({ text: `${nm} is now your primary agent` }); close(); }}><Icon name="crown" size={16} className="text-[#d9a514]" />Make primary</button>}
          {hired && <button role="menuitem" data-release={id} className={`${item} !text-[#e5484d]`} onClick={() => setAsk("release")}><Icon name="out" size={16} />Release agent</button>}
          {custom && <button role="menuitem" data-delete={id} className={`${item} !text-[#e5484d]`} onClick={() => setAsk("delete")}><Icon name="trash" size={16} />Delete agent</button>}
          {id === "home" && <div className="px-3 py-2 text-[12px] leading-snug text-ink/50">Your personal agent can&apos;t be deleted.</div>}
        </>
      )}
    </div>
  );
}
