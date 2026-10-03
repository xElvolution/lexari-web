"use client";

import type { State } from "@/lib/store";
import Icon from "../Icon";
import { nameOf } from "../agents";

/** The side pane next to a chat: the agent's memories and this conversation. */
export default function DesktopPane({ s, id, onClose }: { s: State; id: string; onClose: () => void; full?: boolean }) {
  const name = nameOf(s, id);
  const notes = s.memory.slice(0, 12);
  const thread = (s.threads[id] || []).filter((m) => m.text).slice(-8);
  return (
    <aside aria-label={`${name}'s notes`} className="flex h-full min-h-0 flex-col border-l border-line bg-alt">
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-line px-4">
        <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-grape text-white"><Icon name="monitor" size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-bold text-ink">{name}&apos;s notes</h2>
          <p className="truncate text-[12.5px] text-ink/60">Memories and this chat. Not a separate computer.</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/75 hover:bg-tint"><Icon name="x" size={19} /></button>
      </header>
      <div className="no-bar min-h-0 flex-1 overflow-y-auto p-4">
        <h3 className="text-[13px] font-bold text-ink">Memories</h3>
        <ul className="mt-2 grid gap-2">{notes.length ? notes.map((n) => (
          <li key={n.id} className="rounded-2xl bg-card p-3 ring-1 ring-line">
            <div className="label text-[9px] text-ink/50">{n.tag}</div>
            <p className="mt-1 text-[14px] text-ink">{n.text}</p>
          </li>
        )) : <li className="text-[14px] text-ink/60">No memories yet. Say “remember…” in chat.</li>}</ul>
        <h3 className="mt-6 text-[13px] font-bold text-ink">This chat</h3>
        <ul className="mt-2 grid gap-2">{thread.map((m) => (
          <li key={m.id} className="rounded-2xl bg-card p-3 text-[14px] text-ink ring-1 ring-line"><span className="font-bold">{m.from === "you" ? "You" : name}: </span>{m.text}</li>
        ))}</ul>
      </div>
    </aside>
  );
}

