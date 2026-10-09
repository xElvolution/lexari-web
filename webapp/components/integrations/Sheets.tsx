"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, INTEGRATIONS, LIMITS, type AddedIntegration, type IntegrationCategory, type IntegrationInfo } from "@/content/integrations";
import { addIntegration, updateIntegration, type IntegrationsState } from "@/lib/integrations";
import { friendly } from "@/lib/api";
import { toast, useApp } from "@/lib/store";
import { AgentTile } from "../faces";
import Icon from "../Icon";
import { IntegrationLogo, StatusPill } from "./Logos";

/** A bottom sheet on phones (drag the handle down to close), a centred card on bigger screens. */
export function IntSheet({ label, onClose, head, children, footer }: { label: string; onClose: () => void; head: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  const down = (e: React.PointerEvent) => { if ((e.target as HTMLElement).closest("button,input,a")) return; start.current = e.clientY; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current)); };
  const up = () => { if (start.current === null) return; start.current = null; if (drag > 110) onClose(); else setDrag(0); };
  return (
    <div data-int-overlay={label} className="fixed inset-0 z-[96] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-5" style={{ opacity: drag ? Math.max(0.35, 1 - drag / 500) : undefined }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} data-int-sheet={label}
        className="sheet-up sm:pop pb-safe-dlg flex max-h-[92dvh] w-full max-w-[520px] flex-col rounded-t-[26px] bg-card outline-none ring-1 ring-line sm:max-h-[86dvh] sm:rounded-[26px]"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: start.current === null ? "transform .25s ease-out" : "none" }}>
        <div className="shrink-0 touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="flex justify-center pt-2.5 sm:hidden"><span aria-hidden className="h-1.5 w-11 rounded-full bg-ink/20" /></div>
          {head}
        </div>
        <div className="no-bar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1 sm:px-6 max-[430px]:px-4" style={{ WebkitOverflowScrolling: "touch" }}>{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 py-4 sm:px-6 max-[430px]:px-4 max-[430px]:py-3">{footer}</div>}
      </div>
    </div>
  );
}

const CloseBtn = ({ onClose }: { onClose: () => void }) => <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button>;

/** The catalog: search, category chips and every integration with its honest status. */
export function CatalogSheet({ added, onPick, onClose }: { added: AddedIntegration[]; onPick: (i: IntegrationInfo) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<IntegrationCategory | "all">("all");
  const has = (id: string) => added.some((a) => a.connector === id);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return INTEGRATIONS.filter((i) => !i.builtin && (cat === "all" || i.category === cat) && (!t || `${i.name} ${i.blurb} ${i.chains.join(" ")} ${i.tags}`.toLowerCase().includes(t)));
  }, [q, cat]);
  const groups = cat === "all" && !q.trim() ? CATEGORIES.map((c) => ({ c, items: list.filter((i) => i.category === c.id) })).filter((g) => g.items.length) : [{ c: null, items: list }];
  let idx = 0;
  return (
    <IntSheet label="Add an integration" onClose={onClose} head={
      <>
        <div className="flex items-start gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-6 max-[430px]:px-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-grape text-white"><Icon name="plug" size={21} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="display text-[24px] leading-[1.05] text-ink max-[430px]:text-[21px]">Add an integration</h2>
            <p className="mt-1 text-[13px] leading-snug text-ink/60">Pick a tool, then choose which agents can use it.</p>
          </div>
          <CloseBtn onClose={onClose} />
        </div>
        <div className="px-5 sm:px-6 max-[430px]:px-4">
          <label className="flex h-11 items-center gap-2 rounded-full bg-tint px-4 ring-grape focus-within:ring-2">
            <Icon name="search" size={17} className="shrink-0 text-ink/45" />
            <input data-int-search value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations" aria-label="Search integrations" className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/40" />
            {q && <button onClick={() => setQ("")} aria-label="Clear search" className="grid h-6 w-6 place-items-center rounded-full bg-ink/10 text-ink/60"><Icon name="x" size={12} /></button>}
          </label>
          <div className="no-bar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-3 sm:-mx-6 sm:px-6 max-[430px]:-mx-4 max-[430px]:px-4" role="tablist" aria-label="Categories">
            {[{ id: "all" as const, label: "All" }, ...CATEGORIES].map((c) => (
              <button key={c.id} role="tab" aria-selected={cat === c.id} data-int-cat={c.id} onClick={() => setCat(c.id)} className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-semibold transition ${cat === c.id ? "bg-ink text-[var(--bg)]" : "bg-tint text-ink/70 hover:text-ink"}`}>{c.label}</button>
            ))}
          </div>
        </div>
      </>
    }>
      <div className="border-t border-line" />
      {list.length === 0 && (
        <div data-int-empty className="grid place-items-center py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-[20px] bg-tint text-ink/50"><Icon name="search" size={22} /></span>
          <p className="mt-3 text-[15px] font-bold text-ink">Nothing matches “{q}”</p>
          <p className="mt-1 text-[13px] text-ink/55">Try a chain or a token, like Solana or USDC.</p>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.c?.id || "results"}>
          {g.c && <h3 className="label pb-1 pt-4 text-[9px] text-ink/45">{g.c.label}</h3>}
          <ul className="divide-y divide-[var(--line)]">
            {g.items.map((i) => {
              const on = has(i.id);
              return (
                <li key={i.id} className="row-in" style={{ animationDelay: `${Math.min(idx++, 10) * 35}ms` }}>
                  <button data-int-item={i.id} data-addable={i.addable ? "1" : "0"} onClick={() => onPick(i)} className="group flex w-full items-start gap-3 py-3.5 text-left">
                    <IntegrationLogo id={i.id} size={44} className={`transition group-hover:scale-105 ${i.addable ? "" : "opacity-60 grayscale-[.4]"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[15px] font-bold text-ink">{i.name}</span><StatusPill status={i.status} /></span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-ink/60">{i.blurb}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1">{i.chains.map((c) => <span key={c} className="rounded-md bg-tint px-1.5 py-0.5 text-[10.5px] font-semibold text-ink/55">{c}</span>)}</span>
                    </span>
                    <span className="mt-1 shrink-0">
                      {on ? <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f8ee] px-2.5 py-1 text-[12px] font-bold text-[#137a3d]"><Icon name="check" size={12} stroke={2.6} />Added</span>
                        : i.addable ? <span className="grid h-8 w-8 place-items-center rounded-full bg-grape text-white transition group-hover:scale-110"><Icon name="plus" size={16} stroke={2.4} /></span>
                          : <span className="grid h-8 w-8 place-items-center rounded-full bg-tint text-ink/40"><Icon name="clock" size={15} /></span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </IntSheet>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-grape" : "bg-ink/20"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} /></button>;
}
export { Toggle as IntToggle };

function Stepper({ label, hint, value, min, max, step, onChange, name }: { label: string; hint: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; name: string }) {
  return (
    <div data-limit={name} className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1"><div className="text-[14.5px] font-semibold text-ink">{label}</div><div className="text-[12px] leading-snug text-ink/55">{hint}</div></div>
      <div className="flex shrink-0 items-center gap-1 rounded-full bg-tint p-1">
        <button type="button" aria-label={`Lower ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="grid h-8 w-8 place-items-center rounded-full bg-card text-ink shadow-sm transition active:scale-90 disabled:opacity-35"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg></button>
        <span key={value} data-limit-value className="price-in tab-num w-12 text-center text-[15px] font-bold text-ink">${value}</span>
        <button type="button" aria-label={`Raise ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="grid h-8 w-8 place-items-center rounded-full bg-card text-ink shadow-sm transition active:scale-90 disabled:opacity-35"><Icon name="plus" size={15} stroke={2.4} /></button>
      </div>
    </div>
  );
}
const SLIPS = [50, 100, 200, 300, 500];
const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 1 : 0)}%`;

/**
 * Add or edit one integration: what it can do, which agents may use it, and (for integrations that move money) the
 * per-trade, daily and slippage limits. The server checks the same limits again on every action.
 */
export function GrantSheet({ info, grant, st, onBack, onClose, onSaved }: {
  info: IntegrationInfo; grant?: AddedIntegration; st: IntegrationsState; onBack?: () => void; onClose: () => void; onSaved: (id: string) => void;
}) {
  const app = useApp();
  const [agents, setAgents] = useState<string[]>(grant?.agents ?? (st.agents.length === 1 ? [st.agents[0].slug] : []));
  const [perTx, setPerTx] = useState(grant?.perTxUsd ?? LIMITS.perTx.def);
  const [daily, setDaily] = useState(grant?.dailyUsd ?? LIMITS.daily.def);
  const [slip, setSlip] = useState(grant?.maxSlippageBps ?? LIMITS.slippageBps.def);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const edit = !!grant;
  const flip = (slug: string, on: boolean) => setAgents((a) => (on ? [...new Set([...a, slug])] : a.filter((x) => x !== slug)));
  const setPer = (v: number) => { setPerTx(v); if (daily < v) setDaily(v); };
  const setDay = (v: number) => { setDaily(v); if (perTx > v) setPerTx(v); };
  const save = async () => {
    setErr(""); setBusy(true);
    const body = { agents, ...(info.moves ? { perTxUsd: perTx, dailyUsd: daily, ...(info.category === "trading" ? { maxSlippageBps: slip } : {}) } : {}) };
    try {
      if (grant) await updateIntegration(grant.id, body); else await addIntegration(info.id, body);
      toast({ text: edit ? `${info.name} saved` : `${info.name} added` });
      onSaved(info.id);
    } catch (e) { setErr(friendly(e, "That didn't save. Try again.")); } finally { setBusy(false); }
  };
  const n = agents.length;
  const cta = !info.addable ? "Coming soon" : busy ? "Saving…" : edit ? "Save changes" : n ? `Add ${info.name} for ${n} agent${n === 1 ? "" : "s"}` : "Pick at least one agent";
  return (
    <IntSheet label={`${info.name} integration`} onClose={onClose} head={
      <div className="flex items-start gap-3 px-5 pb-4 pt-3 sm:px-6 sm:pt-6 max-[430px]:px-4">
        {onBack && <button onClick={onBack} aria-label="Back to the catalog" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="back" size={19} /></button>}
        <IntegrationLogo id={info.id} size={52} className="pop" />
        <div className="min-w-0 flex-1">
          <h2 className="display text-[24px] leading-[1.05] text-ink max-[430px]:text-[21px]">{info.name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><StatusPill status={info.status} />{info.chains.map((c) => <span key={c} className="rounded-md bg-tint px-1.5 py-0.5 text-[10.5px] font-semibold text-ink/55">{c}</span>)}</div>
        </div>
        <CloseBtn onClose={onClose} />
      </div>
    } footer={
      <>
        {err && <p role="alert" data-int-error className="mb-2.5 text-[13px] text-[#e5484d]">{err}</p>}
        <button data-int-save onClick={() => void save()} disabled={!info.addable || busy || (!edit && n === 0)} className="btn btn-brand w-full disabled:opacity-50">{info.addable && !busy && (edit || n > 0) && <Icon name={edit ? "check" : "plus"} size={17} stroke={2.4} />}{cta}</button>
      </>
    }>
      <p className="text-[14px] leading-relaxed text-ink/70">{info.about}</p>
      <h3 className="label mt-5 text-[9px] text-ink/45">What agents can do</h3>
      <ul className="mt-2 space-y-2">
        {info.can.map((c, i) => (
          <li key={c.text} className="row-in flex items-start gap-2.5 text-[13.5px]" style={{ animationDelay: `${i * 50}ms` }}>
            <span className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.live ? "bg-[#e7f8ee] text-[#137a3d]" : "bg-tint text-ink/45"}`}><Icon name={c.live ? "check" : "clock"} size={11} stroke={2.6} /></span>
            <span className={c.live ? "text-ink" : "text-ink/50"}>{c.text}{!c.live && <span className="ml-1.5 whitespace-nowrap rounded-full bg-tint px-1.5 py-0.5 text-[10px] font-bold text-ink/50">Coming soon</span>}</span>
          </li>
        ))}
      </ul>
      {!info.addable ? (
        <p className="mt-5 rounded-2xl bg-tint px-4 py-3 text-[13px] leading-snug text-ink/65">{info.name} is coming soon. You can add it here as soon as it&apos;s live.</p>
      ) : (
        <>
          <h3 className="label mt-6 text-[9px] text-ink/45">Which agents can use it</h3>
          <ul data-int-agents className="mt-1 divide-y divide-[var(--line)]">
            {st.agents.map((a) => (
              <li key={a.slug} data-int-agent={a.slug} className="flex items-center gap-3 py-2.5">
                <AgentTile id={a.slug} look={app?.agent?.look} size={38} status={false} />
                <div className="min-w-0 flex-1"><div className="truncate text-[14.5px] font-semibold text-ink">{a.name}</div><div className="text-[12px] text-ink/50">{a.kind === "home" ? "Your agent" : a.kind === "hired" ? "Hired" : "Made by you"} · uses its own wallet</div></div>
                <Toggle on={agents.includes(a.slug)} onChange={(v) => flip(a.slug, v)} label={`Let ${a.name} use ${info.name}`} />
              </li>
            ))}
          </ul>
          {edit && n === 0 && <p className="mt-1 text-[12.5px] text-ink/55">No agent can use {info.name} until you pick one.</p>}
          {info.moves && (
            <>
              <h3 className="label mt-6 text-[9px] text-ink/45">Limits</h3>
              <div data-int-limits className="mt-1 divide-y divide-[var(--line)]">
                <Stepper name="perTx" label="Per trade" hint="The most one action can move" value={perTx} min={LIMITS.perTx.min} max={LIMITS.perTx.max} step={1} onChange={setPer} />
                <Stepper name="daily" label="Daily" hint="Total across all agents, resets at 00:00 UTC" value={daily} min={LIMITS.daily.min} max={LIMITS.daily.max} step={daily < 10 ? 1 : 5} onChange={setDay} />
                {info.category === "trading" && <div data-limit="slippage" className="py-3">
                  <div className="text-[14.5px] font-semibold text-ink">Max slippage</div>
                  <div className="text-[12px] leading-snug text-ink/55">Swaps that would move the price more than this are refused</div>
                  <div className="mt-2.5 grid grid-cols-5 gap-1.5">
                    {SLIPS.map((b) => <button key={b} type="button" data-slip={b} aria-pressed={slip === b} onClick={() => setSlip(b)} className={`h-9 rounded-full text-[13px] font-bold transition ${slip === b ? "bg-grape text-white shadow-[0_3px_0_var(--color-grape-deep)]" : "bg-tint text-ink/70 hover:text-ink"}`}>{pct(b)}</button>)}
                  </div>
                </div>}
              </div>
              <p className="mt-2 flex items-start gap-2 rounded-2xl bg-grape/8 px-3.5 py-3 text-[12.5px] leading-snug text-ink/70"><Icon name="lock" size={15} className="mt-px shrink-0 text-brand-ink" />Every trade still waits for your Confirm in chat, and Lexari checks these limits again before anything is sent. Devnet test funds only.</p>
            </>
          )}
        </>
      )}
    </IntSheet>
  );
}
