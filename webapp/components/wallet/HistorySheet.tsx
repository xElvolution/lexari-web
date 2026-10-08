"use client";

import { useEffect, useRef, useState } from "react";
import { openTopUp } from "@/lib/billing";
import Icon from "../Icon";
import { money } from "../billing/parts";
import type { HistoryRow } from "./agentWallet";

const ICON: Record<string, string> = { topup_card: "plus", topup_crypto: "plus", dev_grant: "plus", refund: "check", fund_refund: "check", fund_return: "check", hire: "user", card: "file", fund: "wallet", plan: "star", usage: "spark" };
const MONEY_IN = new Set(["topup_card", "topup_crypto", "dev_grant", "refund", "fund_refund", "fund_return"]);
const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const monthOf = (t: number) => new Date(t).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const sub = (r: HistoryRow) => {
  if (r.kind === "usage") return `${day(r.at)} · AI usage that day`;
  if (r.kind === "plan" && r.paid) return `${day(r.at)} · paid ${money(r.paid, { cents: true })} by card or USDC`;
  if (r.kind === "plan") return `${day(r.at)}, ${time(r.at)} · from your balance`;
  return `${day(r.at)}, ${time(r.at)}`;
};

export function HistoryItem({ r, i = 0 }: { r: HistoryRow; i?: number }) {
  const up = r.delta > 0 || MONEY_IN.has(r.kind) && r.delta >= 0;
  return (
    <li data-history={r.kind} className="row-in flex items-center gap-3 py-3" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${up ? "bg-[#e7f8ee] text-[#137a3d]" : r.kind === "plan" ? "bg-grape/15 text-brand-ink" : "bg-tint text-ink/70"}`}><Icon name={(ICON[r.kind] || "wallet") as never} size={16} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-semibold text-ink">{r.label}</span><span className="block truncate text-[12px] text-ink/50">{sub(r)}</span></span>
      <span className={`tab-num shrink-0 text-[14.5px] font-bold ${up ? "text-[#137a3d]" : "text-ink"}`}>{r.delta === 0 ? (r.paid ? money(r.paid, { cents: true }) : "") : `${r.delta > 0 ? "+" : "\u2212"}${money(Math.abs(r.delta), { cents: true })}`}</span>
    </li>
  );
}

/**
 * Balance history: a bottom sheet on phones (drag the handle down to close) and a dialog on desktop. The list scrolls
 * inside the sheet, grouped by month: top ups, plans, hires, agent cards, fundings, refunds and daily AI usage.
 */
export default function HistorySheet({ rows, loading, onClose }: { rows: HistoryRow[]; loading: boolean; onClose: () => void }) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind stays put while the list scrolls
    panel.current?.focus();
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  const down = (e: React.PointerEvent) => { start.current = e.clientY; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current)); };
  const up = () => { if (start.current === null) return; start.current = null; if (drag > 110) onClose(); else setDrag(0); };

  const groups: { month: string; items: HistoryRow[] }[] = [];
  for (const r of rows) {
    const m = monthOf(r.at);
    if (groups[groups.length - 1]?.month !== m) groups.push({ month: m, items: [] });
    groups[groups.length - 1].items.push(r);
  }
  const added = rows.reduce((n, r) => n + (r.delta > 0 ? r.delta : 0), 0);
  const spent = rows.reduce((n, r) => n + (r.delta < 0 ? -r.delta : 0), 0);
  let idx = 0;

  return (
    <div data-history-overlay className="fixed inset-0 z-[96] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-5" style={{ opacity: drag ? Math.max(0.35, 1 - drag / 500) : undefined }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="history-title" data-history-sheet
        className="sheet-up sm:pop flex max-h-[88dvh] w-full max-w-[520px] flex-col rounded-t-[26px] bg-card outline-none ring-1 ring-line sm:max-h-[80dvh] sm:rounded-[26px]"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: start.current === null ? "transform .25s ease-out" : "none" }}>
        <div className="shrink-0 touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="flex justify-center pt-2.5 sm:hidden"><span data-drag-handle aria-hidden className="h-1.5 w-11 rounded-full bg-ink/20" /></div>
          <div className="flex items-start gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-grape text-white"><Icon name="wallet" size={20} /></span>
            <div className="min-w-0 flex-1">
              <h2 id="history-title" className="display text-[24px] leading-[1.05] text-ink">History</h2>
              <p className="mt-1 text-[13px] leading-snug text-ink/60">{rows.length ? `${rows.length} item${rows.length === 1 ? "" : "s"} on your Lexari balance` : "Everything your balance does shows here."}</p>
            </div>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close" data-history-close className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button>
          </div>
          {rows.length > 0 && (
            <div className="grid grid-cols-2 gap-2 px-5 pb-3 sm:px-6">
              <div className="min-w-0 rounded-2xl bg-[#e7f8ee] px-3.5 py-2.5 text-[#137a3d]"><div className="text-[11.5px] font-semibold opacity-80">Added</div><div className="tab-num truncate text-[16px] font-bold">+{money(added, { cents: true })}</div></div>
              <div className="min-w-0 rounded-2xl bg-tint px-3.5 py-2.5 text-ink"><div className="text-[11.5px] font-semibold text-ink/60">Spent</div><div className="tab-num truncate text-[16px] font-bold">{"\u2212"}{money(spent, { cents: true })}</div></div>
            </div>
          )}
        </div>
        <div data-history-scroll className="no-bar min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-5 sm:px-6" style={{ WebkitOverflowScrolling: "touch" }}>
          {loading ? (
            <ul aria-busy className="py-2">{[0, 1, 2, 3].map((i) => <li key={i} className="flex items-center gap-3 py-3"><span className="h-10 w-10 animate-pulse rounded-2xl bg-tint" /><span className="flex-1"><span className="block h-3.5 w-2/3 animate-pulse rounded bg-tint" /><span className="mt-2 block h-3 w-1/3 animate-pulse rounded bg-tint" /></span></li>)}</ul>
          ) : !rows.length ? (
            <div data-history-empty className="grid place-items-center px-4 py-10 text-center">
              <span className="relative grid h-16 w-16 place-items-center rounded-[22px] bg-grape/12 text-brand-ink"><Icon name="wallet" size={26} /><span aria-hidden className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-grape text-white"><Icon name="plus" size={12} /></span></span>
              <p className="mt-4 text-[16px] font-bold text-ink">Nothing here yet</p>
              <p className="mt-1 max-w-[280px] text-[13px] leading-snug text-ink/60">Top ups, plans, hires, agent funding and refunds will show up here as they happen.</p>
              <button data-history-topup onClick={() => { onClose(); openTopUp({ product: "credits" }); }} className="btn btn-brand btn-sm mt-5"><Icon name="plus" size={15} />Top up</button>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.month} aria-label={g.month}>
                <h3 className="label sticky top-0 z-10 -mx-1 bg-card px-1 pb-1 pt-4 text-[9px] text-ink/45">{g.month}</h3>
                <ul data-history-list className="divide-y divide-[var(--line)]">{g.items.map((r) => <HistoryItem key={r.id} r={r} i={idx++} />)}</ul>
              </section>
            ))
          )}
          <div className="pb-safe-dlg" />
        </div>
      </div>
    </div>
  );
}
