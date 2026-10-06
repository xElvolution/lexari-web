"use client";

import { useEffect, type ReactNode } from "react";
import { MICROS } from "@/content/billing";
import { burnVsSonnet, type ModelInfo } from "@/content/models";
import Icon from "../Icon";

/** Dollars from micro dollars: $0.42, $3.20, $20. */
export function money(micros: number, opts: { cents?: boolean } = {}) {
  const v = Math.max(0, micros) / MICROS;
  if (opts.cents || v % 1 !== 0) return `$${v < 0.01 && v > 0 ? v.toFixed(3) : v.toFixed(2)}`;
  return `$${v.toFixed(0)}`;
}
export const pct = (used: number, limit: number) => (limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100)));
export const dateShort = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const timeShort = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** The app's bottom sheet on phones and dialog on desktop (same chrome as the upgrade and pay sheets). */
export function Sheet({ title, sub, icon, onClose, children, footer, label, closable = true, wide = false }: {
  title: ReactNode; sub?: ReactNode; icon: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; label: string; closable?: boolean; wide?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && closable) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, closable]);
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget && closable) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={label} data-billing-sheet={label} className={`pop pb-safe-dlg flex max-h-[92dvh] w-full flex-col rounded-t-[26px] bg-card ring-1 ring-line sm:rounded-[26px] ${wide ? "max-w-[560px]" : "max-w-[440px]"}`}>
        <div className="flex items-start gap-3 p-5 pb-3 sm:p-6 sm:pb-3 max-[430px]:p-4 max-[430px]:pb-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-grape text-white max-[430px]:h-10 max-[430px]:w-10">{icon}</span>
          <div className="min-w-0 flex-1"><h2 className="display text-[24px] leading-[1.05] text-ink max-[430px]:text-[21px]">{title}</h2>{sub && <p className="mt-1 text-[13.5px] leading-snug text-ink/65 max-[430px]:text-[12.5px]">{sub}</p>}</div>
          <button onClick={onClose} disabled={!closable} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-tint disabled:opacity-40"><Icon name="x" size={19} /></button>
        </div>
        <div className="no-bar min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 max-[430px]:px-4 max-[430px]:pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4 sm:px-6 max-[430px]:px-4 max-[430px]:py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Lamina's mark: thin stacked layers (a lamina is a thin layer). */
export function LaminaMark({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" fill="currentColor" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".75" />
      <path d="m3.5 16 8.5 4.5 8.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".45" />
    </svg>
  );
}

const MAKER: Record<string, { bg: string; fg: string; t: string }> = {
  Anthropic: { bg: "#d97757", fg: "#fff", t: "A" },
  xAI: { bg: "#111111", fg: "#fff", t: "x" },
  Google: { bg: "#1a73e8", fg: "#fff", t: "G" },
};
/** A model's tile: Lamina's mark on grape, or the maker's initial. */
export function ModelMark({ m, size = 40 }: { m: ModelInfo; size?: number }) {
  if (m.pool === "lamina") return <span className="grid shrink-0 place-items-center rounded-[14px] bg-grape text-white" style={{ width: size, height: size }}><LaminaMark size={Math.round(size * 0.5)} /></span>;
  const k = MAKER[m.maker] ?? { bg: "var(--tint)", fg: "var(--ink)", t: m.maker[0] };
  return <span className="grid shrink-0 place-items-center rounded-[14px] font-bold" style={{ width: size, height: size, background: k.bg, color: k.fg, fontSize: Math.round(size * 0.42) }}>{k.t}</span>;
}

/** "Uses 2x" next to a premium model, against Claude Sonnet. */
export function BurnChip({ m, on = false }: { m: ModelInfo; on?: boolean }) {
  if (m.pool === "lamina") return <span className={`label rounded-full px-1.5 py-0.5 text-[8px] ${on ? "bg-white/20 text-white" : "bg-grape/12 text-brand-ink"}`}>Included</span>;
  const x = burnVsSonnet(m);
  return <span title="How fast it uses your premium usage, compared with Claude Sonnet" className={`label rounded-full px-1.5 py-0.5 text-[8px] tabular-nums ${on ? "bg-white/20 text-white" : x > 1 ? "bg-[#e5484d]/12 text-[#d13b40]" : "bg-tint text-ink/70"}`}>{x}x</span>;
}

/** A thin meter bar. tone "warn" past 80%, "out" at 100%. */
export function Meter({ value, label, right, sub }: { value: number; label: ReactNode; right: ReactNode; sub?: ReactNode }) {
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 100 ? "bg-[#e5484d]" : v >= 80 ? "bg-[#f5a524]" : "bg-grape";
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3"><span className="flex min-w-0 items-center gap-1.5 truncate text-[14px] font-semibold text-ink">{label}</span><span className="shrink-0 text-[13px] font-bold tabular-nums text-ink">{right}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-tint" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}><div className={`h-full rounded-full transition-[width] duration-700 ease-out ${tone}`} style={{ width: `${Math.max(v, v > 0 ? 2 : 0)}%` }} /></div>
      {sub && <div className="mt-1.5 text-[12px] text-ink/55">{sub}</div>}
    </div>
  );
}

export function CardGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19M6.5 15h3.5" /></svg>;
}
export function UsdcGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="10" fill="#2775ca" /><path d="M14.6 9.6c-.2-1-1.1-1.6-2.6-1.6-1.6 0-2.6.8-2.6 1.9 0 2.6 5.4 1.4 5.4 4.2 0 1.1-1.1 1.9-2.8 1.9-1.6 0-2.7-.7-2.9-1.8M12 6.5v11" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /><path d="M8.2 5.6a7.3 7.3 0 0 0 0 12.8M15.8 5.6a7.3 7.3 0 0 1 0 12.8" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".8" /></svg>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <i className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}
