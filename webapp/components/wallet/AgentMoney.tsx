"use client";

import { useState } from "react";
import Link from "next/link";
import { shortAddr } from "@/content/appData";
import { toast, type State } from "@/lib/store";
import Icon from "../Icon";
import GetCardDialog from "./GetCardDialog";

export const WALLETS_SOON = "Agent wallets open soon. For now your agents act with your own wallet.";

/** Wallet and card for one agent, shown on its page. The personal agent has your wallet; others can add one later. */
export default function AgentMoney({ s, id, name }: { s: State; id: string; name: string }) {
  const [getCard, setGetCard] = useState(false);
  const addr = id === "home" ? s.auth?.address || "" : "";
  const row = "flex items-center gap-3 py-3";
  return (
    <section className="rounded-[22px] bg-card px-4 ring-1 ring-line">
      <div className={row}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name="wallet" size={16} /></span>
        <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink">Wallet</div><div className="truncate font-mono text-[12px] text-ink/60">{addr ? shortAddr(addr) : "No wallet yet"}</div></div>
        {addr ? <Link href="/app/wallets" className="rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-brand-ink">Open</Link>
          : <button onClick={() => toast({ text: WALLETS_SOON })} className="rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-ink/70">Create</button>}
      </div>
      <div className={`${row} border-t border-line`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name="file" size={16} /></span>
        <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink">Card</div><div className="truncate text-[12px] text-ink/60">No card yet · bought per agent</div></div>
        <button onClick={() => setGetCard(true)} className="rounded-full bg-grape px-3 py-1.5 text-[12.5px] font-bold text-white">Get a card</button>
      </div>
      {getCard && <GetCardDialog s={s} id={id} onClose={() => setGetCard(false)} />}
    </section>
  );
}
