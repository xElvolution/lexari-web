"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/store";
import { tokenUrl } from "@/lib/nft";
import Link from "next/link";
import { shortAddr } from "@/content/appData";
import type { State } from "@/lib/store";
import Icon from "../Icon";
import GetCardDialog from "./GetCardDialog";
import { cardFor, useCards } from "./useCards";

/** Wallet and card for one agent, shown on its page. The personal agent has your wallet; others can add one later. */
/** A hired specialist's own task wallet (held for its maker): you fund it from chat when a task needs money; leftovers come back. */
function HiredWallet({ id, name }: { id: string; name: string }) {
  const [w, setW] = useState<{ address: string; sol: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api<{ address: string; sol: number | null }>(`/api/hires/wallet?slug=${encodeURIComponent(id)}`).then(setW).catch(() => setW(null));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = async () => {
    setBusy(true);
    try { const r = await api<{ sig: string | null; sol: number }>("/api/hires/wallet", { body: { slug: id, action: "return" } }); toast({ text: r.sig ? `${r.sol.toFixed(4)} SOL sent back to you` : "Nothing left to send back" }); await load(); }
    catch (e) { toast({ text: (e as Error).message || "Couldn't send it back." }); }
    finally { setBusy(false); }
  };
  const left = (w?.sol ?? 0) > 0.00001;
  return (
    <section data-hired-wallet={id} className="rounded-[22px] bg-card px-4 py-3 ring-1 ring-line">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-ink/70"><Icon name="wallet" size={16} /></span>
        <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink">{name}&apos;s task wallet</div><div className="truncate font-mono text-[12px] text-ink/60">{w ? `${shortAddr(w.address)} · ${w.sol === null ? "—" : `${w.sol.toFixed(4)} SOL`}` : "Loading…"}</div></div>
        {w && <a href={tokenUrl(w.address)} target="_blank" rel="noreferrer" className="rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-brand-ink">View</a>}
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-ink/55">Held for {name}&apos;s maker, not your wallet. {name} asks in chat when a task needs funds; you confirm each one.</p>
      {left && <button data-hired-return onClick={() => void back()} disabled={busy} className="btn btn-line btn-sm mt-2 w-full text-ink disabled:opacity-60">{busy ? "Sending back…" : "Return leftover to me"}</button>}
    </section>
  );
}

export default function AgentMoney({ s, id, name }: { s: State; id: string; name: string }) {
  if (s.hired.includes(id)) return <HiredWallet id={id} name={name} />;
  return <CreatedMoney s={s} id={id} name={name} />;
}

function CreatedMoney({ s, id, name }: { s: State; id: string; name: string }) {
  const [getCard, setGetCard] = useState(false);
  const addr = s.auth?.address || "";
  const card = cardFor(useCards(), id);
  const row = "flex items-center gap-3 py-3";
  return (
    <section className="rounded-[22px] bg-card px-4 ring-1 ring-line">
      <div className={row}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name="wallet" size={16} /></span>
        <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink">Wallet</div><div className="truncate font-mono text-[12px] text-ink/60">{addr ? `${id === "home" ? "" : "Your wallet · "}${shortAddr(addr)}` : "Sign in with a wallet"}</div></div>
        <Link href="/wallets" className="rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-brand-ink">Open</Link>
      </div>
      <div className={`${row} border-t border-line`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name="file" size={16} /></span>
        <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink">Card</div><div className="truncate text-[12px] text-ink/60">{card ? `Test card ·· ${card.last4} · $${card.limit}/mo${card.frozen ? " · frozen" : ""}` : "No card yet · bought per agent"}</div></div>
        {card ? <Link href="/wallets?tab=cards" className="rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-brand-ink">Manage</Link>
          : <button onClick={() => setGetCard(true)} className="rounded-full bg-grape px-3 py-1.5 text-[12.5px] font-bold text-white">Get a card</button>}
      </div>
      {getCard && <GetCardDialog s={s} id={id} onClose={() => setGetCard(false)} />}
    </section>
  );
}
