"use client";

import { useEffect, useState } from "react";
import type { ActionCard, ActionStatus, MarketsCard } from "@/content/integrations";
import { integrationById } from "@/content/integrations";
import { actOn, actionNow } from "@/lib/integrations";
import { friendly } from "@/lib/api";
import { moneyChanged } from "@/lib/money";
import { set, useApp, type Msg } from "@/lib/store";
import { nameOf } from "../agents";
import Icon from "../Icon";
import { IntegrationLogo } from "./Logos";

const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-5)}`;
const LIVE: ActionStatus[] = ["submitting", "submitted"];

export const STATUS_CHIP: Record<ActionStatus, [string, string]> = {
  prepared: ["Waiting for you", "bg-grape/12 text-brand-ink"],
  submitting: ["Sending", "bg-[#fff4d6] text-[#8a5a00]"],
  submitted: ["Pending", "bg-[#fff4d6] text-[#8a5a00]"],
  confirmed: ["Confirmed", "bg-[#e7f8ee] text-[#137a3d]"],
  failed: ["Failed", "bg-[#fdecec] text-[#c4292f]"],
  rejected: ["Blocked", "bg-[#fdecec] text-[#c4292f]"],
  cancelled: ["Cancelled", "bg-tint text-ink/55"],
  expired: ["Expired", "bg-tint text-ink/55"],
  done: ["Checked", "bg-tint text-ink/60"],
};

/**
 * A Confirm card for something an agent prepared with an integration (a devnet swap or transfer from its own wallet).
 * Nothing moves until you tap Confirm; the server re-checks your limits and access right then.
 */
export function ActionCardView({ convo, m }: { convo: string; m: Msg & { action: ActionCard } }) {
  const [a, setA] = useState<ActionCard>(m.action);
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [err, setErr] = useState("");
  const st = useApp();
  const who = st ? nameOf(st, a.agent) : "Your agent";
  const info = integrationById(a.connector);

  const keep = (next: ActionCard) => {
    setA(next);
    set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === m.id ? { ...mm, action: next } : mm)) } }));
  };
  // A transaction still on its way: check until the network settles it.
  useEffect(() => {
    if (!LIVE.includes(a.status)) return;
    let stop = false;
    const t = setInterval(() => {
      void actionNow(a.id).then((n) => { if (!stop && n.status !== a.status) { keep(n); if (n.status === "confirmed") moneyChanged(); } }).catch(() => {});
    }, 4000);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, a.status]);

  const run = async (op: "confirm" | "cancel") => {
    setErr(""); setBusy(op);
    if (op === "confirm") setA((x) => ({ ...x, status: "submitting" }));
    try {
      const n = await actOn(a.id, op);
      keep(n);
      if (n.status === "confirmed") moneyChanged();
    } catch (e) {
      setErr(friendly(e, "That didn't go through. Nothing was sent."));
      void actionNow(a.id).then(keep).catch(() => setA((x) => ({ ...x, status: x.status === "submitting" ? "prepared" : x.status })));
    } finally { setBusy(null); }
  };

  const [label, chip] = STATUS_CHIP[a.status];
  return (
    <div data-action-card={a.id} data-action-status={a.status} className="row-in mt-2 w-[min(320px,100%)] overflow-hidden rounded-2xl bg-card ring-1 ring-line">
      <div className="flex items-center gap-2.5 bg-tint/70 px-3.5 py-3">
        <IntegrationLogo id={a.connector} size={32} />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[14px] font-bold leading-tight text-ink">{a.title}</div>
          <div className="truncate text-[11.5px] text-ink/55">{info?.name} · {who}</div>
        </div>
        <span data-action-chip className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${chip}`}>{label}</span>
      </div>
      <dl className="space-y-1.5 px-3.5 pt-3 text-[13px]">
        {a.rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3"><dt className="shrink-0 text-ink/55">{k}</dt><dd className="tab-num min-w-0 break-words text-right font-semibold text-ink">{v}</dd></div>
        ))}
        {a.usd > 0 && <div className="flex justify-between gap-3"><dt className="text-ink/55">Counts toward limits</dt><dd className="tab-num font-semibold text-ink">${a.usd.toFixed(2)}</dd></div>}
      </dl>
      <div className="px-3.5 pb-3.5 pt-2.5">
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/50"><span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />{a.network} · test funds only</p>
        {a.status === "prepared" && (
          <div className="mt-3 flex gap-2">
            <button data-action-cancel onClick={() => void run("cancel")} disabled={!!busy} className="btn btn-line btn-sm !h-10 flex-1 text-ink disabled:opacity-50">{busy === "cancel" ? "Cancelling…" : "Cancel"}</button>
            <button data-action-confirm onClick={() => void run("confirm")} disabled={!!busy} className="btn btn-brand btn-sm !h-10 flex-[1.4] disabled:opacity-60">Confirm</button>
          </div>
        )}
        {LIVE.includes(a.status) && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#fff8e6] px-3 py-2.5 text-[13px] font-semibold text-[#8a5a00]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {a.status === "submitting" ? "Sending from the agent's wallet…" : "Waiting for the network…"}
            {a.explorer && <a href={a.explorer} target="_blank" rel="noreferrer" className="ml-auto underline">View</a>}
          </div>
        )}
        {a.status === "confirmed" && a.sig && (
          <a data-action-sig={a.sig} href={a.explorer} target="_blank" rel="noreferrer" className="pop mt-3 flex items-center gap-2 rounded-xl bg-[#e7f8ee] px-3 py-2.5 text-[13px] font-bold text-[#137a3d]">
            <Icon name="check" size={15} stroke={2.6} />Done · {short(a.sig)}<span className="ml-auto inline-flex items-center gap-1 text-[12px]">Explorer<Icon name="arrow" size={13} /></span>
          </a>
        )}
        {(a.status === "failed" || a.status === "rejected") && <p data-action-error role="alert" className="mt-3 rounded-xl bg-[#fdecec] px-3 py-2.5 text-[12.5px] font-semibold leading-snug text-[#c4292f]">{a.error || "That didn't go through. Nothing was sent."}{a.explorer && <> <a href={a.explorer} target="_blank" rel="noreferrer" className="underline">View</a></>}</p>}
        {a.status === "cancelled" && <p className="mt-3 text-[12.5px] font-semibold text-ink/55">Cancelled. Nothing was sent.</p>}
        {a.status === "expired" && <p className="mt-3 text-[12.5px] font-semibold text-ink/55">This expired before it was confirmed. Ask again for a fresh quote.</p>}
        {err && a.status === "prepared" && <p role="alert" className="mt-2 text-[12.5px] text-[#e5484d]">{err}</p>}
      </div>
    </div>
  );
}

const vol = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const BAR = ["bg-grape", "bg-[#22c55e]", "bg-[#f59e0b]"];

/** Live Polymarket markets an agent pulled into chat. Read only. */
export function MarketsCardView({ c }: { c: MarketsCard }) {
  const at = new Date(c.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div data-markets-card className="row-in mt-2 w-[min(340px,100%)] overflow-hidden rounded-2xl bg-card ring-1 ring-line">
      <div className="flex items-center gap-2.5 bg-tint/70 px-3.5 py-3">
        <IntegrationLogo id="polymarket" size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold leading-tight text-ink">Polymarket</div>
          <div className="truncate text-[11.5px] text-ink/55">{c.query ? `Results for “${c.query}”` : "Trending now"}</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f8ee] px-2 py-0.5 text-[10.5px] font-bold text-[#137a3d]"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22c55e]" />Live</span>
      </div>
      {c.items.length === 0 ? <p className="px-3.5 py-4 text-[13px] text-ink/60">No open markets matched that.</p> : (
        <ul className="divide-y divide-[var(--line)]">
          {c.items.map((it, i) => (
            <li key={it.url + i} data-market className="row-in px-3.5 py-3" style={{ animationDelay: `${i * 60}ms` }}>
              <a href={it.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink hover:text-brand-ink">{it.title}</a>
              <div className="mt-2 space-y-1.5">
                {it.outcomes.slice(0, 3).map((o, j) => (
                  <div key={o.label + j} className="flex items-center gap-2 text-[12px]">
                    <span className="w-[42%] min-w-0 truncate text-ink/70">{o.label}</span>
                    <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-tint"><span className={`absolute inset-y-0 left-0 rounded-full ${BAR[j % 3]} transition-[width] duration-700`} style={{ width: `${Math.max(2, Math.min(100, o.pct))}%` }} /></span>
                    <span className="tab-num w-10 shrink-0 text-right font-bold text-ink">{o.pct < 1 ? "<1" : Math.round(o.pct)}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 text-[11px] text-ink/45">{vol(it.volume24h)} 24h volume{it.ends ? ` · ends ${new Date(it.ends).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line px-3.5 py-2 text-[11px] text-ink/45">Read only. Odds from Polymarket at {at}.</p>
    </div>
  );
}
