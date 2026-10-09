"use client";

import { useEffect, useRef, useState } from "react";
import { burst } from "@/components/fly";
import { createPortal } from "react-dom";
import { toast, type State } from "@/lib/store";
import { coinsOf } from "@/lib/hub";
import { CHAT_BG, MY_BUBBLE, STORE_CATEGORIES, STORE_ITEMS, type Cosmetic } from "@/lib/cosmetics";
import Icon from "@/components/Icon";
import { Coin } from "./coin";

/** The Store button that sits on the Hub heading line. */
export function StoreButton({ onOpen }: { onOpen: () => void }) {
  return <button type="button" data-store-open onClick={onOpen} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-bold text-ink ring-1 ring-line transition hover:text-brand-ink"><Icon name="box" size={15} />Store</button>;
}

function Preview({ it, small }: { it: Cosmetic; small?: boolean }) {
  if (small) return (
    <span className="relative block h-[64px] overflow-hidden rounded-[12px] bg-base ring-1 ring-line" style={it.kind === "bg" ? CHAT_BG[it.id] : undefined}>
      {it.kind === "bg" ? <><span className="absolute left-1.5 top-2 h-3 w-9 rounded-full rounded-bl-sm bg-card ring-1 ring-line" /><span className="absolute bottom-2 right-1.5 h-3 w-7 rounded-full rounded-br-sm bg-grape" /></>
        : <span className="absolute inset-0 flex flex-col items-end justify-center gap-1 px-1.5"><span className={`rounded-[10px] rounded-br-sm px-2 py-0.5 text-[9.5px] font-medium ${MY_BUBBLE[it.id]}`}>Hi!</span><span className={`rounded-[10px] rounded-br-sm px-2 py-0.5 text-[9.5px] font-medium ${MY_BUBBLE[it.id]}`}>Nice</span></span>}
    </span>
  );
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
  // Buy and Apply get one thing: a confetti burst from the item. Owned is plain state, nothing animates.
  const confetti = (id: string) => {
    burst(document.querySelector<HTMLElement>(`[data-store-item="${id}"]`), 26, ["#5b2bff", "#8f6bff", "#ffd84d", "#1fbf6a", "#ff6b9a", "#36c5ff", "#ffffff"]);
    try { navigator.vibrate?.(14); } catch {}
  };
  const buy = async (it: Cosmetic) => {
    confetti(it.id);
    const m = await import("@/lib/offHub");
    const r = await m.buyItem(it.id, it.price, it.kind); // the server wears it right away
    if (!r.ok) { toast({ text: r.error || "That didn't go through.", face: "home" }); return; }
    toast({ text: `${it.name} is yours. It's on in your chats.`, face: "home" });
  };
  const wear = async (it: Cosmetic, on: boolean) => {
    if (on) confetti(it.id);
    const m = await import("@/lib/offHub");
    const r = await m.wearItem(it.kind, on ? it.id : null);
    if (!r.ok) toast({ text: r.error || "Couldn't change that.", face: "home" });
  };
  const [full, setFull] = useState<Cosmetic["kind"] | null>(null);
  const action = (it: Cosmetic, small: boolean) => {
    const have = owned.has(it.id); const on = cos[it.kind] === it.id;
    const h = small ? "h-8 text-[12px]" : "h-9 text-[13px]";
    if (!have) return <button type="button" data-store-buy={it.id} onClick={() => void buy(it)} disabled={coins < it.price} className={`mt-1.5 flex w-full items-center justify-center gap-1 rounded-full bg-grape font-bold text-white disabled:bg-ink/15 disabled:text-ink/45 ${h}`}>{small ? <><Coin size={11} />{it.price}</> : coins < it.price ? `Need ${it.price - coins} more` : "Buy"}</button>;
    if (on) return <button type="button" data-store-off={it.id} onClick={() => void wear(it, false)} className={`mt-1.5 flex w-full items-center justify-center gap-1 rounded-full bg-card font-bold text-brand-ink ring-1 ring-grape ${h}`}><Icon name="check" size={13} stroke={3} />{small ? "On" : "Applied"}</button>;
    return <button type="button" data-store-apply={it.id} onClick={() => void wear(it, true)} className={`mt-1.5 w-full rounded-full bg-card font-bold text-ink ring-1 ring-line ${h}`}>Apply</button>;
  };
  const card = (it: Cosmetic, small: boolean) => {
    const have = owned.has(it.id); const on = cos[it.kind] === it.id;
    return (
      <li key={it.id} data-store-item={it.id} className={`store-card relative overflow-hidden ${small ? "w-[calc((100%-24px)/4.25)] shrink-0 snap-start rounded-[16px] p-1.5" : "rounded-[18px] p-2"} bg-tint ${on ? "ring-2 ring-grape" : "ring-1 ring-line"}`}>
        <Preview it={it} small={small} />
        <div className={`mt-1.5 flex items-center justify-between gap-1 px-0.5 ${small ? "" : "mt-2"}`}><span className={`truncate font-bold text-ink ${small ? "text-[12px]" : "text-[13.5px]"}`}>{it.name}</span>{!small && !have && <span className="flex items-center gap-0.5 text-[12.5px] font-bold tabular-nums text-ink/75"><Coin size={12} />{it.price}</span>}{!small && have && <span className="label text-[8px] text-brand-ink">Owned</span>}</div>
        {action(it, small)}
      </li>
    );
  };
  const cat = full ? STORE_CATEGORIES.find((c) => c.kind === full) : null;
  return createPortal(
    <div data-store-bg className="fixed inset-0 z-[85] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current(); }}>
      <div role="dialog" aria-modal="true" aria-label="Store" data-store-sheet data-hub-sheet className="pop flex max-h-[calc(100dvh-16px)] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-card ring-1 ring-line sm:max-h-[86vh] sm:rounded-[28px]">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-3">{cat ? <button type="button" data-store-back onClick={() => setFull(null)} className="flex items-center gap-1 text-[1.125rem] font-bold text-ink"><Icon name="back" size={18} />{cat.title}</button> : <h2 className="text-[1.125rem] font-bold text-ink">Store</h2>}<span className="ml-auto flex items-center gap-1 rounded-full bg-tint px-2.5 py-1 text-[12.5px] font-bold tabular-nums text-ink"><Coin size={13} /><span data-store-balance>{coins.toLocaleString("en-US")}</span></span><button type="button" data-sheet-close onClick={() => close.current()} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-tint text-ink/75"><Icon name="x" size={18} /></button></div>
        <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-1">
          {cat ? (
            <div data-store-full={cat.kind}>
              <p className="text-[12.5px] text-ink/55">{cat.sub}</p>
              <ul className="mt-2 grid grid-cols-2 gap-2">{STORE_ITEMS.filter((x) => x.kind === cat.kind).map((it) => card(it, false))}</ul>
            </div>
          ) : STORE_CATEGORIES.map((c) => (
            <section key={c.kind} data-store-cat={c.kind} className="mt-5 first:mt-2">
              <div className="flex items-center gap-2">
                <h3 className="rounded-full bg-grape/15 px-3 py-1 text-[13.5px] font-extrabold text-brand-ink ring-1 ring-grape/30">{c.title}</h3>
                <button type="button" data-store-more={c.kind} onClick={() => setFull(c.kind)} className="ml-auto flex items-center gap-0.5 text-[13px] font-bold text-brand-ink">See more<Icon name="arrow" size={14} /></button>
              </div>
              <p className="mt-1 px-0.5 text-[12px] text-ink/55">{c.sub}</p>
              <ul className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 mt-2 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 pt-0.5">{STORE_ITEMS.filter((x) => x.kind === c.kind).map((it) => card(it, true))}</ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
