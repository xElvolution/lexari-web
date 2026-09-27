import Link from "next/link";
import { DEMO_LABEL } from "@/content/appData";
import Icon from "./Icon";

export function DemoTag({ className = "" }: { className?: string }) {
  return (
    <span title="Sample data for the demo. Nothing here is live yet." className={`demo-tag label ${/\bhidden\b/.test(className) ? "" : "inline-flex"} items-center gap-1.5 rounded-full border border-dashed border-ink/35 px-2 py-1 text-[9px] text-ink/70 ${className}`}>
      <i className="h-1.5 w-1.5 rounded-full bg-brand-ink" />{DEMO_LABEL}
    </span>
  );
}

export function PageHead({ kicker, title, body, right, demo = false }: { kicker: string; title: React.ReactNode; body?: string; right?: React.ReactNode; demo?: boolean }) {
  return (
    <div data-rise className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5"><span className="label text-brand-ink">{kicker}</span>{demo && <DemoTag />}</div>
        <h1 className="display mt-3 text-[44px] text-ink sm:text-[64px]">{title}</h1>
        {body && <p className="mt-3 max-w-[40rem] text-[16px] leading-relaxed text-ink/75 sm:text-[17px]">{body}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Empty({ icon = "spark", title, body, cta }: { icon?: string; title: string; body: string; cta?: { href?: string; label: string; onClick?: () => void } }) {
  return (
    <div className="carpet relative grid place-items-center rounded-[28px] border-2 border-dashed border-line px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-tint text-brand-ink"><Icon name={icon} size={26} /></span>
      <h3 className="display mt-4 text-[30px] text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-[15px] text-ink/70">{body}</p>
      {cta && (cta.href ? <Link href={cta.href} className="btn btn-brand btn-sm mt-6">{cta.label}</Link> : <button onClick={cta.onClick} className="btn btn-brand btn-sm mt-6">{cta.label}</button>)}
    </div>
  );
}

export function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={14} className={i <= Math.round(value) ? "text-brand-ink" : "text-ink/20"} />)}
    </span>
  );
}

export function StatusPill({ status }: { status: "running" | "done" | "needs-you" }) {
  const m = {
    running: { t: "Working", c: "bg-grape text-white", dot: "bg-white live-dot" },
    done: { t: "Done", c: "bg-tint text-ink", dot: "bg-brand-ink" },
    "needs-you": { t: "Needs you", c: "bg-ink text-[var(--bg)]", dot: "bg-lilac" },
  }[status];
  return <span className={`label inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9.5px] ${m.c}`}><i className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.t}</span>;
}

export function ago(ms: number, now: number) {
  const d = Math.max(0, now - ms), m = Math.round(d / 6e4);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24); return days === 1 ? "yesterday" : `${days} days ago`;
}
