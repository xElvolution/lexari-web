"use client";

import Capped from "../Capped";
import { useEffect, useState } from "react";
import { INTEGRATIONS, SCOPE_INFO, STATUS_LABEL, integrationById, isOffered, type ActivityRow, type AddedIntegration, type IntegrationInfo } from "@/content/integrations";
import { loadIntegrations, removeIntegration, revokeAllIntegrations, updateIntegration, useIntegrations, type IntegrationsState } from "@/lib/integrations";
import { friendly } from "@/lib/api";
import { toast, type State } from "@/lib/store";
import { AgentTile } from "../faces";
import Icon from "../Icon";
import { IntegrationLogo, StatusPill } from "./Logos";
import { CatalogSheet, GrantSheet, IntToggle } from "./Sheets";
import { STATUS_CHIP } from "./ChatCards";
import { AuditSheet, ConsentSheet } from "./Consent";
import { Sheet as Modal } from "../billing/parts";

type Sheet = null | { kind: "catalog" } | { kind: "grant"; info: IntegrationInfo; grant?: AddedIntegration; fromCatalog: boolean } | { kind: "consent"; info: IntegrationInfo; grant: AddedIntegration } | { kind: "audit"; connector?: string };
const DAY = 86_400_000;
/** "Ends in 3 days" / "Ends today" / "Expired" for a grant's expiry. */
export function endsIn(at: number | null, now = Date.now()) {
  if (at === null) return null;
  const d = Math.ceil((at - now) / DAY);
  if (at <= now) return "Expired";
  if (d <= 1) return "Ends today";
  return `Ends in ${d} days`;
}

const ago = (t: number) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
};
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 1 : 0)}%`;
const TRY: Partial<Record<string, string>> = {
  solana: "“What's in your wallet?”",
  orca: "“Swap 1 USDC to SOL on Orca”",
  jupiter: "“Quote 1 SOL to BONK on Jupiter”",
  polymarket: "“What's trending on Polymarket?”",
  base: "“What's your Base address?”",
  ethereum: "“Check your Sepolia balance”",
  prices: "“What's BTC at right now?”",
};

/** The page's groups, in order. Anything not listed (new integrations) shows under Data. */
const GROUPS: [string, string[]][] = [
  ["Trading", ["orca", "jupiter", "kuru", "uniswap", "intents", "bridge", "hyperliquid", "polymarket", "panta"]],
  ["Wallets & Payments", ["skr", "solana", "base", "ethereum", "arbitrum", "robinhood", "monad", "zcash", "tempo", "agora", "mera", "payments"]],
  ["Data", ["prices", "nansen", "alchemy", "ore", "solami"]],
  ["AI", ["self"]],
];

/** Settings > Integrations: the tools you added, who may use them, their limits and what they did. */
export default function IntegrationsSection({ s }: { s: State }) {
  const st = useIntegrations();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [killAsk, setKillAsk] = useState(false);
  const [killBusy, setKillBusy] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [info, setInfo] = useState<IntegrationInfo | null>(null);
  useEffect(() => { void loadIntegrations(true); }, []);
  useEffect(() => { if (!fresh) return; const t = setTimeout(() => setFresh(null), 2200); return () => clearTimeout(t); }, [fresh]);

  if (!st.loaded) return (
    <div aria-busy className="space-y-3">
      <div className="h-[168px] animate-pulse rounded-[22px] bg-tint" />
      <div className="h-[120px] animate-pulse rounded-[22px] bg-tint" />
    </div>
  );
  if (st.error && !st.added.length) return (
    <div className="rounded-[22px] bg-card p-5 ring-1 ring-line">
      <p className="text-[14px] text-ink/70">Integrations didn&apos;t load. {st.error}</p>
      <button onClick={() => void loadIntegrations(true)} className="btn btn-line btn-sm mt-3 text-ink">Try again</button>
    </div>
  );

  const live = st.added.filter((g) => g.enabled).length;
  const killAll = async () => {
    setKillBusy(true);
    try { const n = await revokeAllIntegrations(); toast({ text: n ? `Switched off ${n} integration${n === 1 ? "" : "s"}` : "Everything was already off" }); setKillAsk(false); }
    catch (e) { toast({ text: friendly(e) }); } finally { setKillBusy(false); }
  };
  const pick = (info: IntegrationInfo) => {
    const g = st.added.find((a) => a.connector === info.id);
    setSheet({ kind: "grant", info, grant: g, fromCatalog: true });
  };
  const open = (i: IntegrationInfo) => {
    const g = st.added.find((a) => a.connector === i.id);
    if (g) setDetail(g.id); else if (i.addable && i.status !== "needskey") pick(i); else setInfo(i);
  };
  const shownDetail = detail ? st.added.find((g) => g.id === detail) : null;
  return (
    <div data-integrations data-int-state="open">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div data-int-count className="text-[15px] font-bold text-ink">{st.added.length} connected</div>
          <p className="text-[12.5px] leading-snug text-ink/55">Agents only use what you connect, and ask before moving money.</p>
        </div>
        <button data-int-add onClick={() => setSheet({ kind: "catalog" })} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-grape px-3.5 text-[13px] font-bold text-white"><Icon name="plus" size={13} stroke={2.6} />Add</button>
        <button data-int-audit onClick={() => setSheet({ kind: "audit" })} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-tint px-3 text-[13px] font-semibold text-ink"><Icon name="list" size={13} />Audit</button>
        {live > 0 && <button data-int-kill onClick={() => setKillAsk(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-tint px-3 text-[13px] font-semibold text-[#e5484d]"><Icon name="stop" size={13} />Off</button>}
      </div>
      {killAsk && (
        <div data-int-kill-ask className="mt-3 rounded-2xl bg-card p-3 ring-1 ring-[#e5484d]/40">
          <p className="text-[13px] leading-snug text-ink/80">Switch off all {live} integration{live === 1 ? "" : "s"}? Agents lose access right away and anything waiting for your Confirm is cancelled.</p>
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => setKillAsk(false)} disabled={killBusy} className="h-9 flex-1 rounded-full bg-tint text-[13.5px] font-semibold text-ink">Keep</button>
            <button data-int-kill-yes onClick={() => void killAll()} disabled={killBusy} className="h-9 flex-1 rounded-full bg-[#e5484d] text-[13.5px] font-bold text-white disabled:opacity-60">{killBusy ? "Switching off…" : "Switch off all"}</button>
          </div>
        </div>
      )}
      {GROUPS.map(([label, ids]) => {
        const items = ids.map((id) => integrationById(id as never)).filter((i): i is IntegrationInfo => !!i && (isOffered(i) || st.added.some((a) => a.connector === i.id)));
        if (!items.length) return null;
        return (
          <section key={label} className="mt-5">
            <h3 className="label mb-2 text-[9.5px] text-ink/50">{label}</h3>
            <div data-int-grid className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => {
                const g = st.added.find((a) => a.connector === i.id);
                const on = !!g?.enabled || !!i.builtin;
                return (
                  <button key={i.id} data-int-card={i.id} onClick={() => open(i)} className={`flex h-[60px] items-center gap-3 rounded-2xl bg-card px-3 text-left ring-1 transition hover:ring-grape/50 ${fresh === i.id ? "ring-2 ring-grape" : "ring-line"}`}>
                    <IntegrationLogo id={i.id} size={32} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-bold text-ink">{i.name}</span><span className="block truncate text-[12px] text-ink/55">{i.blurb}</span></span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${on ? "bg-[#e7f8ee] text-[#137a3d]" : "bg-tint text-ink/60"}`}>{on ? "Connected" : g ? "Off" : "Available"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="mt-5 text-[12px] leading-snug text-ink/50">Every trade and transfer waits for your Confirm in chat. Market data is read only.</p>

      {shownDetail && (() => { const i = integrationById(shownDetail.connector); return (
        <Modal label="integration" title={i?.name || "Integration"} icon={<IntegrationLogo id={shownDetail.connector as never} size={28} />} onClose={() => setDetail(null)}>
          <AddedCard g={shownDetail} st={st} s={s} fresh={false}
            onEdit={() => { setDetail(null); if (i) setSheet({ kind: "grant", info: i, grant: shownDetail, fromCatalog: false }); }}
            onConsent={() => { setDetail(null); if (i) setSheet({ kind: "consent", info: i, grant: shownDetail }); }}
            onAudit={() => { setDetail(null); setSheet({ kind: "audit", connector: shownDetail.connector }); }} />
        </Modal>
      ); })()}
      {info && (
        <Modal label="integration" title={info.name} sub={info.chains.join(", ")} icon={<IntegrationLogo id={info.id} size={28} />} onClose={() => setInfo(null)}>
          <p className="text-[14px] leading-snug text-ink/75">{info.about}</p>
          <ul className="mt-3 space-y-1.5">{info.can.map((c) => <li key={c.text} className="flex items-start gap-2 text-[13.5px] text-ink/80"><Icon name={c.live ? "check" : "info"} size={14} className="mt-0.5 shrink-0 text-brand-ink" />{c.text}</li>)}</ul>
          <p className="mt-3 rounded-2xl bg-tint p-3 text-[12.5px] text-ink/65">{info.id === "mera" ? "Link a passkey in Settings, Security." : info.builtin ? "Always on for your agents." : STATUS_LABEL[info.status]}</p>
        </Modal>
      )}
      {sheet?.kind === "catalog" && <CatalogSheet added={st.added} onPick={pick} onClose={() => setSheet(null)} />}
      {sheet?.kind === "grant" && (
        <GrantSheet key={sheet.info.id + (sheet.grant?.id || "")} info={sheet.info} grant={sheet.grant} st={st}
          onBack={sheet.fromCatalog ? () => setSheet({ kind: "catalog" }) : undefined}
          onClose={() => setSheet(null)}
          onSaved={(id) => { setSheet(null); setFresh(id); }} />
      )}
      {sheet?.kind === "consent" && (
        <ConsentSheet key={sheet.grant.id} info={sheet.info} grantId={sheet.grant.id} st={st}
          draft={{ agents: sheet.grant.agents, perTxUsd: sheet.grant.perTxUsd, dailyUsd: sheet.grant.dailyUsd, maxSlippageBps: sheet.grant.maxSlippageBps, scopes: sheet.grant.scopes }}
          onBack={() => setSheet({ kind: "grant", info: sheet.info, grant: sheet.grant, fromCatalog: false })}
          onClose={() => setSheet(null)} onDone={(id) => { setSheet(null); setFresh(id); }} />
      )}
      {sheet?.kind === "audit" && <AuditSheet connector={sheet.connector} st={st} onClose={() => setSheet(null)} />}
    </div>
  );
}

function AddedCard({ g, st, s, fresh, onEdit, onConsent, onAudit }: { g: AddedIntegration; st: IntegrationsState; s: State; fresh: boolean; onEdit: () => void; onConsent: () => void; onAudit: () => void }) {
  const info = integrationById(g.connector);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  if (!info) return null;
  const nameOf = (slug: string) => st.agents.find((a) => a.slug === slug)?.name || "An agent";
  const toggle = async (on: boolean) => {
    // On always goes through the consent popup; off revokes right away.
    if (on) { onConsent(); return; }
    setBusy(true);
    try { await updateIntegration(g.id, { enabled: false }); toast({ text: `${info.name} switched off` }); }
    catch (e) { toast({ text: friendly(e) }); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await removeIntegration(g.id); toast({ text: `${info.name} removed` }); }
    catch (e) { toast({ text: friendly(e) }); setBusy(false); }
  };
  const copy = (a: string) => { void navigator.clipboard?.writeText(a).then(() => toast({ text: "Address copied" })).catch(() => {}); };
  const used = info.moves ? Math.min(100, (g.spentTodayUsd / Math.max(1, g.dailyUsd)) * 100) : 0;
  return (
    <section data-int-card={g.connector} data-enabled={g.enabled ? "1" : "0"} className={`pop overflow-hidden rounded-[22px] bg-card ring-1 transition-shadow duration-700 ${fresh ? "ring-2 ring-grape shadow-[0_0_0_6px_rgba(91,43,255,.12)]" : "ring-line"}`}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <IntegrationLogo id={info.id} size={46} className={`transition ${g.enabled ? "" : "grayscale"}`} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold leading-tight text-ink">{info.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5"><StatusPill status={info.status} /><span className="text-[11.5px] text-ink/45">{info.chains.join(", ")}</span></div>
        </div>
        <span data-int-toggle className={busy ? "pointer-events-none opacity-60" : ""}><IntToggle on={g.enabled} onChange={(v) => void toggle(v)} label={g.enabled ? `Switch off ${info.name}` : `Turn on ${info.name}`} /></span>
      </div>
      {!g.enabled && <p data-int-paused className="mx-4 mb-3 rounded-xl bg-tint px-3 py-2 text-[12.5px] font-semibold text-ink/60">{g.expiresAt !== null && g.expiresAt <= Date.now() ? "Access expired." : "Switched off."} No agent can use {info.name} until you allow it again.</p>}

      <div data-int-access className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h4 className="label text-[9px] text-ink/45">Access</h4>
          {g.enabled && g.expiresAt !== null && <span data-int-ends className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${g.expiresAt - Date.now() < 3 * DAY ? "bg-[#fff6db] text-[#8a6100]" : "bg-tint text-ink/55"}`}>{endsIn(g.expiresAt)}</span>}
          <button data-int-renew onClick={onConsent} className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-brand-ink hover:bg-tint"><Icon name="lock" size={13} />{g.enabled ? "Review" : "Allow again"}</button>
        </div>
        <div data-int-scopes className="mt-1.5 flex flex-wrap gap-1.5">
          {g.scopes.map((x) => <span key={x} className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${SCOPE_INFO[x].risky ? "bg-[#fff1e6] text-[#c2570c]" : "bg-tint text-ink/75"}`}>{SCOPE_INFO[x].title}</span>)}
        </div>
      </div>

      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h4 className="label text-[9px] text-ink/45">Agents</h4>
          <button data-int-edit onClick={onEdit} className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-brand-ink hover:bg-tint"><Icon name="edit" size={13} />Edit</button>
        </div>
        {g.agents.length ? (
          <div data-int-card-agents className="mt-1.5 flex flex-wrap gap-1.5">
            {g.agents.map((a) => <span key={a} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-tint py-1 pl-1 pr-2.5 text-[13px] font-semibold text-ink"><AgentTile id={a} look={s.agent?.look} size={22} status={false} ring={false} /><span className="truncate">{nameOf(a)}</span></span>)}
          </div>
        ) : <p className="mt-1 text-[13px] text-ink/55">No agent can use it yet. Tap Edit to pick one.</p>}
      </div>

      {info.moves && (
        <div className="border-t border-line px-4 py-3">
          <h4 className="label text-[9px] text-ink/45">Limits</h4>
          <div data-int-card-limits className={`mt-2 grid gap-2 ${info.category === "trading" ? "grid-cols-3" : "grid-cols-2"}`}>
            {([["Per trade", `$${g.perTxUsd}`], ["Daily", `$${g.dailyUsd}`], ...(info.category === "trading" ? [["Slippage", pct(g.maxSlippageBps)]] : [])] as [string, string][]).map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-2xl bg-tint px-2.5 py-2"><div className="truncate text-[11px] font-semibold text-ink/50">{k}</div><div key={v} className="price-in tab-num text-[16px] font-bold text-ink">{v}</div></div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[12px] text-ink/55"><span>Used today</span><span className="tab-num font-semibold text-ink/75">${g.spentTodayUsd.toFixed(2)} of ${g.dailyUsd}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tint"><div className={`h-full rounded-full transition-[width] duration-700 ${used >= 90 ? "bg-[#e5484d]" : "bg-grape"}`} style={{ width: `${used}%` }} /></div>
        </div>
      )}

      {g.addresses.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <h4 className="label text-[9px] text-ink/45">Agent wallets</h4>
          <ul className="mt-1">
            {g.addresses.map((w) => (
              <li key={w.agent + w.chain} data-int-wallet={w.agent} className="flex items-center gap-2 py-1.5">
                <AgentTile id={w.agent} look={s.agent?.look} size={24} status={false} ring={false} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-ink">{nameOf(w.agent)}</span><span className="block truncate text-[11px] text-ink/45">{w.chain}</span></span>
                <button onClick={() => copy(w.address)} aria-label={`Copy ${nameOf(w.agent)}'s address`} className="tab-num inline-flex h-8 items-center gap-1 rounded-full bg-tint px-2.5 font-mono text-[11.5px] text-ink/75 hover:text-ink"><Icon name="copy" size={12} />{shortAddr(w.address)}</button>
                <a href={w.explorer} target="_blank" rel="noreferrer" aria-label="Open in explorer" className="grid h-8 w-8 place-items-center rounded-full text-ink/55 hover:bg-tint hover:text-ink"><Icon name="arrow" size={14} /></a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h4 className="label text-[9px] text-ink/45">Recent activity</h4>
          <button data-int-card-audit onClick={onAudit} className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-brand-ink hover:bg-tint"><Icon name="list" size={13} />Audit log</button>
        </div>
        {g.activity.length ? (
          <Capped className="mt-1"><ul data-int-activity className="divide-y divide-[var(--line)]">{g.activity.map((r, i) => <Activity key={r.id} r={r} i={i} who={nameOf(r.agent)} />)}</ul></Capped>
        ) : <p className="mt-1.5 text-[13px] leading-snug text-ink/55">Nothing yet. Try asking an agent in chat: {TRY[g.connector] || "ask it to use this"}</p>}
      </div>

      <div className="border-t border-line px-4 py-3">
        {ask ? (
          <div data-int-remove-ask className="row-in">
            <p className="text-[13px] leading-snug text-ink/70">Remove {info.name}? Your agents lose access right away and any unconfirmed actions are cancelled.</p>
            <div className="mt-2.5 flex gap-2">
              <button onClick={() => setAsk(false)} disabled={busy} className="btn btn-line btn-sm !h-10 flex-1 text-ink">Keep</button>
              <button data-int-remove-yes onClick={() => void remove()} disabled={busy} className="btn btn-sm !h-10 flex-1 bg-[#e5484d] text-white disabled:opacity-60">{busy ? "Removing…" : "Remove"}</button>
            </div>
          </div>
        ) : <button data-int-remove onClick={() => setAsk(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-1 text-[13.5px] font-semibold text-[#e5484d] hover:opacity-80"><Icon name="trash" size={15} />Remove</button>}
      </div>
    </section>
  );
}

function Activity({ r, i, who }: { r: ActivityRow; i: number; who: string }) {
  const [label, chip] = STATUS_CHIP[r.status];
  return (
    <li data-int-row={r.status} className="row-in flex items-center gap-2.5 py-2" style={{ animationDelay: `${i * 40}ms` }}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-ink">{r.title}</div>
        <div className="truncate text-[11.5px] text-ink/50">{who} · {ago(r.at)}{r.error && (r.status === "failed" || r.status === "rejected") ? ` · ${r.error}` : ""}</div>
      </div>
      {r.usd > 0 && <span className="tab-num shrink-0 text-[13px] font-bold text-ink">${r.usd.toFixed(2)}</span>}
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${chip}`}>{label}</span>
      {r.explorer && <a data-int-tx href={r.explorer} target="_blank" rel="noreferrer" aria-label="View transaction" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/55 hover:bg-tint hover:text-ink"><Icon name="arrow" size={13} /></a>}
    </li>
  );
}
