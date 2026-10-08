"use client";

import { useEffect, useState } from "react";
import { INTEGRATIONS, integrationById, type ActivityRow, type AddedIntegration, type IntegrationInfo } from "@/content/integrations";
import { loadIntegrations, removeIntegration, updateIntegration, useIntegrations, type IntegrationsState } from "@/lib/integrations";
import { loadSocial, useSocial } from "@/lib/social";
import { SOCIALS, SOCIAL_NAME } from "@/lib/socialInfo";
import { friendly } from "@/lib/api";
import { toast, type State } from "@/lib/store";
import { AgentTile } from "../faces";
import Icon from "../Icon";
import { SocialConnect, SocialMark, TILE } from "../social/SocialLinks";
import { IntegrationLogo, StatusPill } from "./Logos";
import { CatalogSheet, GrantSheet, IntToggle } from "./Sheets";
import { STATUS_CHIP } from "./ChatCards";

type Sheet = null | { kind: "catalog" } | { kind: "grant"; info: IntegrationInfo; grant?: AddedIntegration; fromCatalog: boolean };

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

/** Settings > Integrations: the tools you added, who may use them, their limits and what they did. */
export default function IntegrationsSection({ s }: { s: State }) {
  const st = useIntegrations();
  const social = useSocial();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => { void loadSocial(true); void loadIntegrations(true); }, []);
  // Linking (or unlinking) an account here or in another tab opens or locks the section right away.
  const linked = social.links.length;
  useEffect(() => { if (social.loaded) void loadIntegrations(true); }, [linked, social.loaded]);
  useEffect(() => { if (!fresh) return; const t = setTimeout(() => setFresh(null), 2200); return () => clearTimeout(t); }, [fresh]);

  if (!st.loaded) return (
    <div aria-busy className="space-y-3">
      <div className="h-[168px] animate-pulse rounded-[22px] bg-tint" />
      <div className="h-[120px] animate-pulse rounded-[22px] bg-tint" />
    </div>
  );
  if (st.error && !st.added.length && st.locked) return (
    <div className="rounded-[22px] bg-card p-5 ring-1 ring-line">
      <p className="text-[14px] text-ink/70">Integrations didn&apos;t load. {st.error}</p>
      <button onClick={() => void loadIntegrations(true)} className="btn btn-line btn-sm mt-3 text-ink">Try again</button>
    </div>
  );
  if (st.locked) return <Locked s={s} />;

  const pick = (info: IntegrationInfo) => {
    const g = st.added.find((a) => a.connector === info.id);
    setSheet({ kind: "grant", info, grant: g, fromCatalog: true });
  };
  return (
    <div data-integrations data-int-state="open">
      <section className="grain relative overflow-hidden rounded-[22px] bg-[linear-gradient(130deg,#2a0f9a,#5b2bff_60%,#8f6bff)] p-5 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 flex rotate-12 gap-2 opacity-25">
          {INTEGRATIONS.slice(0, 4).map((i, n) => <span key={i.id} style={{ animation: `hub-float ${3 + n * 0.4}s ease-in-out ${n * 0.3}s infinite` }}><IntegrationLogo id={i.id} size={40} /></span>)}
        </div>
        <div className="relative flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Icon name="plug" size={24} /></span>
          <div className="min-w-0 flex-1">
            <div className="label text-[9.5px] text-white/70">Your agents&apos; tools</div>
            <div data-int-count className="display mt-1 text-[30px] leading-none"><span key={st.added.length} className="price-in">{st.added.length}</span> added</div>
            <p className="mt-2 text-[13.5px] leading-snug text-white/80">Agents only see what you add here, act through their own wallets and stay inside your limits.</p>
          </div>
        </div>
        <button data-int-add onClick={() => setSheet({ kind: "catalog" })} className="relative mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15.5px] font-bold text-[#3a17c9] shadow-[0_5px_0_rgba(20,6,80,.35)] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_rgba(20,6,80,.35)]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-grape text-white"><Icon name="plus" size={14} stroke={2.6} /></span>Add integration
        </button>
      </section>

      {st.added.length === 0 ? (
        <section data-int-none className="mt-5 grid place-items-center rounded-[22px] bg-card px-5 py-8 text-center ring-1 ring-line">
          <div className="flex -space-x-2">{["solana", "orca", "polymarket"].map((id, n) => <span key={id} className="pop rounded-[15px] ring-4 ring-[var(--card,#fff)]" style={{ animationDelay: `${n * 80}ms` }}><IntegrationLogo id={id as never} size={46} /></span>)}</div>
          <p className="mt-4 text-[16px] font-bold text-ink">No integrations yet</p>
          <p className="mt-1 max-w-[300px] text-[13.5px] leading-snug text-ink/60">Add Solana, Orca or Polymarket and pick which agents can use them. Nothing runs until you add it.</p>
          <button onClick={() => setSheet({ kind: "catalog" })} className="btn btn-brand btn-sm mt-5"><Icon name="plus" size={15} stroke={2.4} />Add integration</button>
        </section>
      ) : (
        <div className="mt-5 space-y-4">
          {st.added.map((g) => <AddedCard key={g.id} g={g} st={st} s={s} fresh={fresh === g.connector} onEdit={() => { const info = integrationById(g.connector); if (info) setSheet({ kind: "grant", info, grant: g, fromCatalog: false }); }} />)}
        </div>
      )}
      <p className="mt-5 text-[12.5px] leading-snug text-ink/50">Trades and transfers run on Solana devnet with test funds only, and each one waits for your Confirm in chat. Market data is read only.</p>

      {sheet?.kind === "catalog" && <CatalogSheet added={st.added} onPick={pick} onClose={() => setSheet(null)} />}
      {sheet?.kind === "grant" && (
        <GrantSheet key={sheet.info.id + (sheet.grant?.id || "")} info={sheet.info} grant={sheet.grant} st={st}
          onBack={sheet.fromCatalog ? () => setSheet({ kind: "catalog" }) : undefined}
          onClose={() => setSheet(null)}
          onSaved={(id) => { setSheet(null); setFresh(id); }} />
      )}
    </div>
  );
}

/** Locked until a social account is linked: one-tap link buttons, the same linking as Connected accounts. */
function Locked({ s }: { s: State }) {
  return (
    <div data-integrations data-int-state="locked">
      <section className="grain relative overflow-hidden rounded-[22px] bg-[linear-gradient(130deg,#1b0b5e,#3d1fc4_60%,#6a47ff)] p-5 text-white">
        <div className="flex items-start gap-4">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Icon name="lock" size={23} /><span aria-hidden className="absolute inset-0 animate-ping rounded-2xl bg-white/10 [animation-duration:2.4s]" /></span>
          <div className="min-w-0 flex-1">
            <div className="label text-[9.5px] text-white/70">Locked</div>
            <div className="display mt-1 text-[27px] leading-[1.05] max-[430px]:text-[24px]">Link a social account to unlock</div>
            <p className="mt-2 text-[13.5px] leading-snug text-white/80">Integrations let your agents use real tools with their own wallets. Link X, Discord or Telegram first so every agent is tied to a real person.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex -space-x-2">{INTEGRATIONS.slice(0, 6).map((i) => <span key={i.id} className="rounded-[12px] ring-2 ring-[#3d1fc4]"><IntegrationLogo id={i.id} size={30} /></span>)}</div>
          <span className="text-[12.5px] font-semibold text-white/75">{INTEGRATIONS.length} integrations waiting</span>
        </div>
      </section>
      <SocialConnect s={s}>
        {(a, enabled) => (
          <section className="mt-5">
            <h3 className="label mb-2 text-[9.5px] text-ink/50">Link one to continue</h3>
            <div className="grid gap-2">
              {SOCIALS.map((p, n) => {
                const on = enabled.includes(p);
                return (
                  <button key={p} data-int-link={p} disabled={!on || !a.ready || !!a.busy} onClick={() => a.link(p)} className="row-in group flex h-14 items-center gap-3 rounded-2xl bg-card px-3 text-left ring-1 ring-line transition enabled:hover:ring-grape disabled:opacity-55" style={{ animationDelay: `${n * 60}ms` }}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${on ? TILE[p] : "bg-tint text-ink/40"}`}><SocialMark provider={p} size={p === "twitter" ? 15 : 18} /></span>
                    <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{a.busy === p ? "Linking…" : `Link ${SOCIAL_NAME[p]}`}</span>
                    <span className="text-[12.5px] text-ink/45">{on ? <Icon name="right" size={17} className="transition group-enabled:group-hover:translate-x-0.5" /> : "Not available yet"}</span>
                  </button>
                );
              })}
            </div>
            {a.note && <p className="mt-3 text-[12.5px] leading-snug text-ink/55">{a.note}</p>}
          </section>
        )}
      </SocialConnect>
    </div>
  );
}

function AddedCard({ g, st, s, fresh, onEdit }: { g: AddedIntegration; st: IntegrationsState; s: State; fresh: boolean; onEdit: () => void }) {
  const info = integrationById(g.connector);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  if (!info) return null;
  const nameOf = (slug: string) => st.agents.find((a) => a.slug === slug)?.name || "An agent";
  const toggle = async (on: boolean) => {
    setBusy(true);
    try { await updateIntegration(g.id, { enabled: on }); toast({ text: on ? `${info.name} is on` : `${info.name} paused` }); }
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
        <span data-int-toggle className={busy ? "pointer-events-none opacity-60" : ""}><IntToggle on={g.enabled} onChange={(v) => void toggle(v)} label={g.enabled ? `Pause ${info.name}` : `Turn on ${info.name}`} /></span>
      </div>
      {!g.enabled && <p data-int-paused className="mx-4 mb-3 rounded-xl bg-tint px-3 py-2 text-[12.5px] font-semibold text-ink/60">Paused. No agent can use {info.name} until you turn it back on.</p>}

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
        <h4 className="label text-[9px] text-ink/45">Recent activity</h4>
        {g.activity.length ? (
          <ul data-int-activity className="mt-1 divide-y divide-[var(--line)]">{g.activity.map((r, i) => <Activity key={r.id} r={r} i={i} who={nameOf(r.agent)} />)}</ul>
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
