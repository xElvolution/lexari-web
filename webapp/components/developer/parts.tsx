"use client";
/** Small shared pieces for the Developer and Review pages. */
import { useState } from "react";
import Icon from "../Icon";

export const card = "rounded-[22px] bg-card p-5 ring-1 ring-line max-[430px]:p-4";
export const input = "h-11 w-full rounded-2xl bg-tint px-4 text-[15px] text-ink outline-none ring-grape placeholder:text-ink/45 focus:ring-2";
export const primary = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-grape px-5 text-[14.5px] font-bold text-white transition hover:bg-grape-deep disabled:opacity-50";
export const secondary = "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-tint px-4 text-[13.5px] font-bold text-ink transition hover:bg-grape hover:text-white disabled:opacity-50";

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-1 flex items-end justify-between gap-3"><h3 className="label text-[9.5px] text-ink/50">{title}</h3>{right}</div>
      <div className={card}>{children}</div>
    </section>
  );
}

export function Copyable({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-tint p-2 pl-3">
      <code className="min-w-0 flex-1 break-all font-mono text-[12.5px] text-ink">{value}</code>
      <button onClick={() => { void navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }} className={secondary}><Icon name={done ? "check" : "copy"} size={14} />{done ? "Copied" : label}</button>
    </div>
  );
}

const PILL: Record<string, string> = {
  approved: "bg-[#34d399]/20 text-[#047857]", listed: "bg-[#34d399]/20 text-[#047857]",
  pending: "bg-[#fcd34d]/30 text-[#92400e]", in_review: "bg-[#fcd34d]/30 text-[#92400e]",
  rejected: "bg-[#f45b5b]/15 text-[#b42318]", delisted: "bg-[#f45b5b]/15 text-[#b42318]",
  superseded: "bg-tint text-ink/60", draft: "bg-tint text-ink/60",
};
const PILL_LABEL: Record<string, string> = { in_review: "In review", pending: "In review", approved: "Approved", listed: "Listed", rejected: "Changes needed", delisted: "Delisted", superseded: "Replaced", draft: "Draft" };
export function Pill({ s }: { s: string }) {
  return <span className={`label inline-flex rounded-full px-2 py-0.5 text-[9px] ${PILL[s] ?? "bg-tint text-ink/60"}`}>{PILL_LABEL[s] ?? s}</span>;
}

export const when = (t: number | null) => (t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Never");
export const usd = (micros: number) => `$${(micros / 1e6).toFixed(2)}`;
