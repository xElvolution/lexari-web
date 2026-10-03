"use client";

import { useNow, useTyping, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile, GroupTile } from "../faces";
import { convos, nameOf, preview, shortTime, type Convo } from "../agents";

function Row({ c, s, on, now, onPick }: { c: Convo; s: State; on: boolean; now: number; onPick: (id: string) => void }) {
  const typing = useTyping(c.id);
  return (
    <li>
      <button onClick={() => onPick(c.id)} aria-current={on ? "true" : undefined} className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition ${on ? "bg-card shadow-[0_0_0_1px_var(--line)]" : "hover:bg-tint/70"}`}>
        {c.group ? <GroupTile members={c.members} look={s.agent?.look} size={44} /> : <AgentTile id={c.id} look={s.agent?.look} size={44} />}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-bold text-ink">{c.name}</span>
              {c.group && <Icon name="users" size={13} className="shrink-0 text-ink/45" />}
            </span>
            <span className="label shrink-0 text-[8.5px] text-ink/50">{c.last ? shortTime(c.last.at, now) : ""}</span>
          </span>
          <span className={`block truncate text-[13.5px] ${typing ? "font-semibold text-brand-ink" : "text-ink/60"}`}>{typing ? `${c.group ? `${nameOf(s, typing)} is ` : ""}typing…` : preview(c.last, s, c.group)}</span>
        </span>
      </button>
    </li>
  );
}

/** Conversation list: direct chats and groups, most recent first. */
export default function ConvoList({ s, active, onPick, onNewGroup, className = "" }: {
  s: State; active: string | null; onPick: (id: string) => void; onNewGroup: () => void; className?: string;
}) {
  const now = useNow(30000);
  const list = convos(s);
  return (
    <aside className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-5">
        <h1 className="display text-[30px] leading-none text-ink">Chats</h1>
        <button onClick={onNewGroup} title="New group" aria-label="New group" className="grid h-10 w-10 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-brand-ink"><Icon name="groupadd" size={20} /></button>
      </div>
      <div className="label px-5 pb-1.5 pt-2 text-[9px] text-ink/50">Messages</div>
      <ul className="no-bar min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-3">
        {list.map((c) => <Row key={c.id} c={c} s={s} on={c.id === active} now={now} onPick={onPick} />)}
        <li>
          <button onClick={onNewGroup} data-tour="new-group" className="mt-1 flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left text-ink/65 transition hover:bg-tint/70 hover:text-ink">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] border-2 border-dashed border-ink/25"><Icon name="plus" size={18} /></span>
            <span className="text-[14.5px] font-semibold">New group chat</span>
          </button>
        </li>
      </ul>
    </aside>
  );
}
