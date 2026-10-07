"use client";

import { useState } from "react";
import Link from "next/link";
import { isCreated, type State } from "@/lib/store";
import Icon from "../Icon";
import GetCardDialog from "./GetCardDialog";
import { cardFor, useCards } from "./useCards";
import { AgentWalletCard, useWallet } from "./agentWallet";

/** The agent's own wallet (and, for agents you made, its card), shown on its page. Never your balance. */
export default function AgentMoney({ s, id, name }: { s: State; id: string; name: string }) {
  const d = useWallet(id);
  const a = d?.agents.find((x) => x.slug === id);
  const [getCard, setGetCard] = useState(false);
  const card = cardFor(useCards(), id);
  const created = isCreated(s, id);
  if (d === undefined) return <section className="rounded-[22px] bg-card p-4 text-[13.5px] text-ink/60 ring-1 ring-line">Loading {name}&apos;s wallet…</section>;
  if (!d || !a) return null;
  return (
    <div data-agent-money={id}>
      <AgentWalletCard a={a} name={name} look={id === "home" ? s.agent?.look : undefined} funding={d.funding} fundings={d.fundings} compact>
        {created && (
          <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name="file" size={16} /></span>
            <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink">Card</div><div className="truncate text-[12px] text-ink/60">{card ? `Test card ·· ${card.last4} · $${card.limit}/mo${card.frozen ? " · frozen" : ""}` : "No card yet"}</div></div>
            {card ? <Link href="/wallets?tab=cards" className="rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-brand-ink">Manage</Link>
              : <button onClick={() => setGetCard(true)} className="rounded-full bg-grape px-3 py-1.5 text-[12.5px] font-bold text-white">Get a card</button>}
          </div>
        )}
      </AgentWalletCard>
      <Link href="/wallets" className="mt-2 block text-center text-[12.5px] font-bold text-brand-ink hover:underline">Your balance and all wallets</Link>
      {getCard && <GetCardDialog s={s} id={id} onClose={() => setGetCard(false)} />}
    </div>
  );
}
