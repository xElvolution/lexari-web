"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast, type State } from "@/lib/store";
import { coinsOf } from "@/lib/hub";
import { CHAT_BG, MY_BUBBLE, STORE_ITEMS, type Cosmetic } from "@/lib/cosmetics";
import Icon from "@/components/Icon";
import { Coin } from "./coin";

/** The Store button that sits on the Hub heading line. */
export function StoreButton({ onOpen }: { onOpen: () => void }) {
  return <button type="button" data-store-open onClick={onOpen} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-bold text-ink ring-1 ring-line transition hover:text-brand-ink"><Icon name="box" size={15} />Store</button>;
}

function Preview({ it }: { it: Cosmetic }) {
  if (it.kind === "bg") return (
    <span className="relative block h-[88px] overflow-hidden rounded-[14px] bg-base ring-1 ring-line" style={CHAT_BG[it.id]}>
      <span className="absolute left-2 top-2.5 rounded-[12px] rounded-bl-md bg-card px-2.5 py-1 text-[10.5px] text-ink ring-1 ring-line">Morning! Ready?</span>
      <span className="absolute bottom-2.5 right-2 rounded-[12px] rounded-br-md bg-grape px-2.5 py-1 text-[10.5px] text-white">Let&apos;s go</span>
    </span>
  );
  return (
    <span className="relative flex h-[88px] flex-col items-end justify-center gap-1.5 overflow-hidden rounded-[14px] bg-base px-2.5 ring-1 ring-line">
      <span className={`rounded-[14px] rounded-br-md px-3 py-1.5 text-[11.5px] font-medium ${MY_BUBBLE[it.id]}`}>This is my style</span>
      <span className={`rounded-[14px] rounded-br-md px-3 py-1.5 text-[11.5px] font-medium ${MY_BUBBLE[it.id]}`}>Looks good?</span>
    </span>
  );
}

/** Spend coins on cosmetics: chat backgrounds and bubble styles. Buy, then wear (or take off). */
export function StoreSheet({ s, onClose }: { s: State; onClose: () => void }) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", k);
    const html = document.documentElement; const prev = html.style.overflow; html.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); html.style.overflow = prev; };
  }, []);
  const cos = s.live?.cosmetics || {};
  const owned = new Set(cos.owned || []);
  const coins = coinsOf(s);
  const buy = async (it: Cosmetic) => {
    const m = await import("@/lib/offHub");
    const r = await m.buyItem(it.id, it.price);
    if (!r.ok) { toast({ text: r.error || "That didn't go through.", face: "home" }); return; }
    await m.wearItem(it.kind, it.id);
    toast({ text: `${it.name} is yours. It's on in your chats.`, face: "home" });
  };
  const wear = async (it: Cosmetic, on: boolean) => {
    const m = await import("@/lib/offHub");
    const r = await m.wearItem(it.kind, on ? it.id : null);
    if (!r.ok) toast({ text: r.error || "Couldn't change that.", face: "home" });
  };
  const group = (kind: "bg" | "bubble", title: string, sub: string) => (
    <section className="mt-4 first:mt-1">
      <h3 className="text-[15px] font-bold text-ink">{title}</h3>
      <p className="text-[12.5px] text-ink/55">{sub}</p>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {STORE_ITEMS.filter((x) => x.kind === kind).map((it) => {
          const have = owned.has(it.id); const on = cos[kind] === it.id;
          return (
            <li key={it.id} data-store-item={it.id} className={`rounded-[18px] bg-tint p-2 ${on ? "ring-2 ring-grape" : "ring-1 ring-line"}`}>
              <Preview it={it} />
              <div className="mt-2 flex items-center justify-between gap-1 px-0.5"><span className="text-[13.5px] font-bold text-ink">{it.name}</span>{!have && <span className="flex items-center gap-0.5 text-[12.5px] font-bold tabular-nums text-ink/75"><Coin size={12} />{it.price}</span>}{have && <span className="label text-[8px] text-brand-ink">Owned</span>}</div>
              {!have ? <button type="button" data-store-buy={it.id} onClick={() => void buy(it)} disabled={coins < it.price} className="mt-1.5 h-9 w-full rounded-full bg-grape text-[13px] font-bold text-white disabled:bg-ink/15 disabled:text-ink/45">{coins < it.price ? `Need ${it.price - coins} more` : "Buy"}</button>
                : on ? <button type="button" data-store-off={it.id} onClick={() => void wear(it, false)} className="mt-1.5 flex h-9 w-full items-center justify-center gap-1 rounded-full bg-card text-[13px] font-bold text-brand-ink ring-1 ring-grape"><Icon name="check" size={14} stroke={3} />Applied</button>
                : <button type="button" data-store-apply={it.id} onClick={() => void wear(it, true)} className="mt-1.5 h-9 w-full rounded-full bg-card text-[13px] font-bold text-ink ring-1 ring-line">Apply</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
  return createPortal(
    <div data-store-bg className="fixed inset-0 z-[85] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current(); }}>
      <div role="dialog" aria-modal="true" aria-label="Store" data-store-sheet data-hub-sheet className="pop flex max-h-[calc(100dvh-16px)] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-card ring-1 ring-line sm:max-h-[86vh] sm:rounded-[28px]">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-3"><h2 className="text-[1.125rem] font-bold text-ink">Store</h2><span className="ml-auto flex items-center gap-1 rounded-full bg-tint px-2.5 py-1 text-[12.5px] font-bold tabular-nums text-ink"><Coin size={13} />{coins.toLocaleString("en-US")}</span><button type="button" data-sheet-close onClick={() => close.current()} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-tint text-ink/75"><Icon name="x" size={18} /></button></div>
        <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-1">
          {group("bg", "Chat backgrounds", "Shows behind every chat.")}
          {group("bubble", "Bubble styles", "Your own messages wear it.")}
        </div>
      </div>
    </div>,
    document.body,
  );
}
