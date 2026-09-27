"use client";

import Link from "next/link";
import { planOf, seatsLeft, useNow, useTyping, type State } from "@/lib/store";
import Icon from "../Icon";
import { WhoFace } from "../faces";
import { myAgents, shortTime, type MyAgent } from "../agents";

function Row({ a, s, active, now }: { a: MyAgent; s: State; active: boolean; now: number }) {
  const typing = useTyping(a.id);
  const home = a.id === "home";
  const preview = typing ? "typing…" : a.last ? `${a.last.from === "you" ? "You: " : ""}${a.last.text}` : "Say hi";
  return (
    <li>
      <Link href={`/app/chat/${a.id}`} aria-current={active ? "page" : undefined} className={`group relative flex items-center gap-3 rounded-[20px] p-2.5 pr-3 transition ${active ? "bg-card shadow-[0_0_0_1px_var(--line),0_10px_24px_-18px_var(--glow)]" : "hover:bg-tint/70"}`}>
        {active && <span className="absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-grape" />}
        <span className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105 ${home ? "bg-grape" : "bg-tint"}`}>
          <WhoFace who={a.id} look={s.agent?.look} size={40} />
          <i className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-grape ring-[3px] ring-alt" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-bold text-ink">{a.name}</span>
            <span className="label shrink-0 text-[8.5px] text-ink/55">{a.last ? shortTime(a.last.at, now) : ""}</span>
          </span>
          <span className={`block truncate text-[13.5px] ${typing ? "font-semibold text-brand-ink" : "text-ink/65"}`}>{preview}</span>
        </span>
      </Link>
    </li>
  );
}

export default function AgentList({ s, activeId, className = "" }: { s: State; activeId?: string; className?: string }) {
  const now = useNow(30000);
  const list = myAgents(s);
  const left = seatsLeft(s);
  return (
    <aside className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex items-end justify-between px-5 pb-3 pt-6 lg:pt-7">
        <div><span className="label text-brand-ink">Chats</span><h1 className="display mt-1.5 text-[36px] leading-none text-ink">Your team</h1></div>
        <span className="label rounded-full bg-tint px-2.5 py-1.5 text-[9.5px] text-ink">{list.length}</span>
      </div>
      <ul className="no-bar min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {list.map((a) => <Row key={a.id} a={a} s={s} active={a.id === activeId} now={now} />)}
      </ul>
      <div className="border-t border-line p-3">
        <Link href={left > 0 ? "/app/marketplace" : "/app/team"} className="group flex items-center gap-3 rounded-[20px] border-2 border-dashed border-ink/25 p-2.5 transition hover:border-grape hover:bg-tint">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-tint text-brand-ink transition group-hover:rotate-90 group-hover:bg-grape group-hover:text-white"><Icon name="plus" size={20} /></span>
          <span className="min-w-0"><span className="block text-[15px] font-bold text-ink">Hire more</span><span className="block text-[12.5px] text-ink/65">{left > 0 ? `${left} open seat${left > 1 ? "s" : ""} on ${planOf(s).name}` : "Every seat is taken"}</span></span>
        </Link>
      </div>
    </aside>
  );
}
