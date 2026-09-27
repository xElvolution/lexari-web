"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { createGroup, deleteGroup, groupOf, updateGroup, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { myAgents } from "../agents";

/** Make a group (name + two or more agents) or edit one. */
export default function GroupDialog({ s, editId, onClose, onDone }: { s: State; editId?: string; onClose: () => void; onDone: (id: string | null) => void }) {
  const g = editId ? groupOf(s, editId) : undefined;
  const [name, setName] = useState(g?.name ?? "");
  const [pick, setPick] = useState<string[]>(g?.members ?? []);
  const card = useRef<HTMLDivElement>(null);
  const agents = myAgents(s);
  const ok = name.trim().length > 0 && pick.length >= 2;

  useLayoutEffect(() => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(card.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const toggle = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const save = () => {
    if (!ok) return;
    if (g) { updateGroup(g.id, { name: name.trim(), members: pick }); onDone(g.id); }
    else onDone(createGroup(name, pick));
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby="group-title" className="pb-safe-dlg w-full max-w-[460px] rounded-t-[28px] bg-card p-5 ring-1 ring-line sm:rounded-[28px] sm:p-6">
        <div className="flex items-center justify-between">
          <h2 id="group-title" className="display text-[32px] text-ink">{g ? "Edit group" : "New group"}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button>
        </div>
        <label className="mt-4 block">
          <span className="label text-[9.5px] text-ink/60">Group name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} onKeyDown={(e) => { if (e.key === "Enter") save(); }} placeholder="Launch crew" className="mt-1.5 h-12 w-full rounded-2xl bg-tint px-4 text-[16px] text-ink outline-none ring-grape placeholder:text-ink/40 focus:ring-2" />
        </label>
        <div className="mt-5 flex items-baseline justify-between"><span className="label text-[9.5px] text-ink/60">Add agents</span><span className="text-[12.5px] text-ink/55">{pick.length} picked · at least 2</span></div>
        <ul className="no-bar mt-2 max-h-[300px] space-y-1 overflow-y-auto">
          {agents.map((a) => {
            const on = pick.includes(a.id);
            return (
              <li key={a.id}>
                <button onClick={() => toggle(a.id)} aria-pressed={on} className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${on ? "bg-tint" : "hover:bg-tint/60"}`}>
                  <AgentTile id={a.id} look={s.agent?.look} size={42} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold text-ink">{a.name}</span><span className="block truncate text-[13px] text-ink/60">{a.role}</span></span>
                  <span className={`grid h-6 w-6 place-items-center rounded-full transition ${on ? "bg-grape text-white" : "border-2 border-ink/25"}`}>{on && <Icon name="check" size={14} stroke={3} />}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {agents.length < 2 && <p className="mt-2 text-[13.5px] text-ink/60">Add another agent with the + on Home to start a group.</p>}
        <div className="mt-5 flex gap-2">
          {g && <button onClick={() => { deleteGroup(g.id); onDone(null); }} className="btn btn-sm btn-line text-ink">Delete</button>}
          <button onClick={save} disabled={!ok} className="btn btn-brand btn-sm flex-1 disabled:opacity-40 disabled:shadow-none">{g ? "Save" : "Create group"}</button>
        </div>
      </div>
    </div>
  );
}
