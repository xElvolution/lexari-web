"use client";

import Link from "next/link";
import { shortAddr, walletFor } from "@/content/appData";
import { toast, useApp } from "@/lib/store";
import Icon from "@/components/app/Icon";
import { AgentTile } from "@/components/app/faces";
import { DemoTag, PageHead } from "@/components/app/ui";
import { myAgents } from "@/components/app/agents";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Spark({ pts }: { pts: number[] }) {
  const max = Math.max(...pts), min = Math.min(...pts);
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${28 - ((p - min) / (max - min || 1)) * 24}`).join(" ");
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full text-brand-ink" aria-hidden><polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

export default function WalletsPage() {
  const s = useApp()!;
  const agents = myAgents(s).map((a) => ({ ...a, w: walletFor(a.id) }));
  const total = agents.reduce((t, a) => t + a.w.balance, 0);
  const copy = (addr: string, name: string) => { navigator.clipboard?.writeText(addr).catch(() => {}); toast({ text: `Copied ${name}'s address` }); };

  return (
    <>
      <PageHead kicker="Wallets" title="Agent wallets." body="Every agent has its own wallet for the tools it uses on your behalf. Addresses and balances here are demo placeholders." right={<DemoTag />} />

      <div data-rise className="mt-8 flex flex-col gap-4 rounded-[26px] bg-card p-5 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <span className="label text-[9.5px] text-ink/60">Total balance · demo</span>
          <div className="display tab-num mt-2 text-[48px] leading-none text-ink">{fmt(total)}</div>
          <p className="mt-2 text-[14px] text-ink/60">Across {agents.length} wallet{agents.length === 1 ? "" : "s"}. Nothing here is live.</p>
        </div>
        <div className="flex -space-x-2">{agents.slice(0, 6).map((a) => <AgentTile key={a.id} id={a.id} look={s.agent?.look} size={44} className="ring-4 ring-[var(--card)]" />)}</div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <article key={a.id} data-rise className="flex flex-col rounded-[26px] bg-card p-5 ring-1 ring-line">
            <div className="flex items-center gap-3">
              <AgentTile id={a.id} look={s.agent?.look} size={48} />
              <div className="min-w-0 flex-1"><h2 className="truncate text-[17px] font-bold text-ink">{a.name}</h2><p className="truncate text-[13px] text-ink/60">{a.role}</p></div>
              <span className="label rounded-full bg-tint px-2 py-1 text-[8.5px] text-ink/70">Demo</span>
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <div><span className="label text-[9px] text-ink/55">Balance</span><div className="display tab-num mt-1 text-[36px] leading-none text-ink">{fmt(a.w.balance)}</div></div>
              <div className="w-24"><Spark pts={a.w.spark} /></div>
            </div>
            <button onClick={() => copy(a.w.address, a.name)} title={a.w.address} className="mt-4 flex items-center gap-2 rounded-2xl bg-tint px-3 py-2.5 text-left transition hover:bg-grape hover:text-white">
              <Icon name="wallet" size={16} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{shortAddr(a.w.address)}</span>
              <span className="flex items-center gap-1 text-[12px] font-bold"><Icon name="copy" size={14} />Copy</span>
            </button>
            <ul className="mt-4 space-y-2 border-t border-line pt-4">
              {a.w.lines.map((l) => (
                <li key={l.label} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span className="min-w-0 truncate text-ink/75">{l.label}<span className="ml-2 text-[12px] text-ink/45">{l.ago}</span></span>
                  <span className={`tab-num font-mono text-[12.5px] ${l.amount > 0 ? "text-brand-ink" : "text-ink/60"}`}>{l.amount > 0 ? "+" : "−"}{fmt(Math.abs(l.amount))}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
        <Link href="/app/marketplace" data-rise className="grid min-h-[220px] place-items-center rounded-[26px] border-2 border-dashed border-ink/20 p-5 text-center text-ink/60 transition hover:border-grape hover:text-ink">
          <span><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-tint text-brand-ink"><Icon name="plus" size={20} /></span><span className="mt-3 block text-[14.5px] font-semibold">New agents get a wallet too</span></span>
        </Link>
      </div>
    </>
  );
}
