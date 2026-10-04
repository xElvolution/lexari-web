"use client";

import { useState } from "react";
import Link from "next/link";
import { shortAddr } from "@/content/appData";
import type { State } from "@/lib/store";
import Icon from "../Icon";
import GetCardDialog from "./GetCardDialog";
import { cardFor, useCards } from "./useCards";

/** Wallet and card for one agent, shown on its page. The personal agent has your wallet; others can add one later. */
export default function AgentMoney({ s, id, name }: { s: State; id: string; name: string }) {
  const [getCard, setGetCard] = useState(false);
  const addr = s.auth?.address || "";
  const card = cardFor(useCards(), id);
  const row = "flex items-center gap-3 py-3";
  return (
    <section className="rounded-[22px] bg-card px-4 ring-1 ring-line">
      <div className={row}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name="wallet" size={16} /></span>
        <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink">Wallet</div><div className="truncate font-mono text-[12px] text-ink/60">{addr ? `${id === "home" ? "" : "Your wallet · "}${shortAddr(addr)}` : "Sign in with a wallet"}</div></div>
        <Link href="/app/wallets" className="rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-brand-ink">Open</Link>
      </div>
      <div className={`${row} border-t border-line`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name="file" size={16} /></span>
        <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink">Card</div><div className="truncate text-[12px] text-ink/60">{card ? `Test card ·· ${card.last4} · $${card.limit}/mo${card.frozen ? " · frozen" : ""}` : "No card yet · bought per agent"}</div></div>
        {card ? <Link href="/app/wallets?tab=cards" className="rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-brand-ink">Manage</Link>
          : <button onClick={() => setGetCard(true)} className="rounded-full bg-grape px-3 py-1.5 text-[12.5px] font-bold text-white">Get a card</button>}
      </div>
      {getCard && <GetCardDialog s={s} id={id} onClose={() => setGetCard(false)} />}
    </section>
  );
}
