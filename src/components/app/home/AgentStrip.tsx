"use client";

import { useEffect, useRef, useState } from "react";
import { useTyping, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { myAgents, type MyAgent } from "../agents";
import { openAdd, openAgent } from "../overlays";

function Tile({ a, s, on, onPick }: { a: MyAgent; s: State; on: boolean; onPick: (id: string) => void }) {
  const typing = useTyping(a.id);
  return (
    <button data-tile data-tour={`tile-${a.id}`} onClick={() => (on ? openAgent(a.id) : onPick(a.id))} aria-pressed={on} title={on ? `${a.name} · tap for profile and ID card` : `${a.name} · ${a.role}`} className="group relative flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-2xl pb-1 pt-1.5 outline-none focus-visible:bg-tint">
      <span className={`relative rounded-[20px] p-[3px] transition duration-200 ${on ? "bg-grape" : "bg-transparent group-hover:bg-line"}`}>
        <AgentTile id={a.id} look={s.agent?.look} size={54} className="transition duration-200 group-hover:scale-[1.04]" radius={17} />
        {on && !typing && <span aria-hidden className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-card text-brand-ink shadow ring-1 ring-line"><Icon name="idcard" size={12} /></span>}
        {typing && <span className="typing absolute -right-1 -top-1 flex gap-0.5 rounded-full bg-grape px-1.5 py-1 text-white [&_i]:!h-1 [&_i]:!w-1"><i /><i /><i /></span>}
      </span>
      <span className={`block max-w-full truncate px-1 text-[12.5px] leading-tight ${on ? "font-bold text-ink" : "font-semibold text-ink/70"}`}>{a.name}</span>
    </button>
  );
}

/** Row of every agent on your team. Scrolls sideways (drag, swipe, wheel or arrows) and filters by name. */
export default function AgentStrip({ s, active, onPick }: { s: State; active: string; onPick: (id: string) => void }) {
  const all = myAgents(s);
  const [q, setQ] = useState("");
  const list = q.trim() ? all.filter((a) => `${a.name} ${a.role}`.toLowerCase().includes(q.trim().toLowerCase())) : all;
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });

  const measure = () => { const el = row.current; if (!el) return; setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }); };
  useEffect(() => {
    const el = row.current; if (!el) return;
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    // a vertical wheel scrolls the row sideways
    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) { e.preventDefault(); el.scrollLeft += e.deltaY; } };
    el.addEventListener("wheel", onWheel, { passive: false });
    // drag with the mouse; touch uses native swipe
    let down = false, sx = 0, sl = 0, moved = false;
    const pd = (e: PointerEvent) => { if (e.pointerType !== "mouse" || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = el.scrollLeft; };
    const pm = (e: PointerEvent) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 5) { moved = true; el.style.scrollBehavior = "auto"; el.scrollLeft = sl - dx; } };
    const pu = () => { down = false; el.style.scrollBehavior = ""; };
    const clk = (e: MouseEvent) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } };
    el.addEventListener("pointerdown", pd); window.addEventListener("pointermove", pm); window.addEventListener("pointerup", pu); el.addEventListener("click", clk, true);
    return () => { ro.disconnect(); el.removeEventListener("wheel", onWheel); el.removeEventListener("pointerdown", pd); window.removeEventListener("pointermove", pm); window.removeEventListener("pointerup", pu); el.removeEventListener("click", clk, true); };
  }, []);
  useEffect(measure, [list.length]);
  // keep the open agent in view
  useEffect(() => { row.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); }, [active]);

  const nudge = (d: number) => row.current?.scrollBy({ left: d * Math.max(200, (row.current.clientWidth ?? 400) * 0.7), behavior: "smooth" });

  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const close = () => { setOpen(false); setQ(""); };
  useEffect(() => { if (open) field.current?.focus(); }, [open]);
  const sq = "grid h-[54px] w-[54px] place-items-center rounded-[17px] transition";

  return (
    <div data-tour="strip" className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
      <div className="relative min-w-0 flex-1">
        <div ref={row} onScroll={measure} className="no-bar flex cursor-grab select-none items-start gap-1 overflow-x-auto scroll-smooth active:cursor-grabbing" role="list" aria-label="Your agents">
          {list.map((a) => <Tile key={a.id} a={a} s={s} on={a.id === active} onPick={onPick} />)}
          {q && list.length === 0 && <p className="self-center whitespace-nowrap px-3 py-5 text-[14px] text-ink/60">No agent matches “{q}”.</p>}
        </div>
        {edge.l && <button onClick={() => nudge(-1)} aria-label="Scroll left" className="absolute left-0 top-0 z-10 hidden h-full w-14 items-center justify-start bg-gradient-to-r from-base via-base/80 to-transparent md:flex"><span className="grid h-9 w-9 place-items-center rounded-full bg-card text-ink shadow ring-1 ring-line hover:text-brand-ink"><Icon name="left" size={18} /></span></button>}
        {edge.r && <button onClick={() => nudge(1)} aria-label="Scroll right" className="absolute right-0 top-0 z-10 hidden h-full w-14 items-center justify-end bg-gradient-to-l from-base via-base/80 to-transparent md:flex"><span className="grid h-9 w-9 place-items-center rounded-full bg-card text-ink shadow ring-1 ring-line hover:text-brand-ink"><Icon name="right" size={18} /></span></button>}
      </div>
      <div className="flex shrink-0 items-start gap-1 border-l border-line pl-2">
        <button onClick={() => openAdd()} title="Add an agent" aria-label="Add an agent" data-tour="add-agent" className="group flex w-[64px] flex-col items-center gap-1.5 pb-1 pt-1.5">
          <span className="p-[3px]"><span className={`${sq} border-2 border-dashed border-ink/30 text-ink/70 group-hover:border-grape group-hover:bg-tint group-hover:text-brand-ink`}><Icon name="plus" size={22} /></span></span>
          <span className="text-[12.5px] font-semibold text-ink/60">Add</span>
        </button>
        {open ? (
          <div className="flex flex-col items-center gap-1.5 pb-1 pt-1.5">
            <span className="p-[3px]">
              <label data-tour="strip-search-field" className="expand-in flex h-[54px] w-[min(240px,52vw)] items-center gap-2 rounded-[17px] bg-tint px-3 ring-2 ring-grape">
                <Icon name="search" size={17} className="shrink-0 text-brand-ink" />
                <input ref={field} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") close(); }} placeholder="Find an agent" aria-label="Search your agents" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/45" />
                <button onClick={close} aria-label="Close search" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-line hover:text-ink"><Icon name="x" size={14} /></button>
              </label>
            </span>
            <span className="text-[12.5px] font-semibold text-ink/60">{q ? `${list.length} of ${all.length}` : `${all.length} agent${all.length === 1 ? "" : "s"}`}</span>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} title="Search agents" aria-label="Search agents" data-tour="strip-search" className="group flex w-[64px] flex-col items-center gap-1.5 pb-1 pt-1.5">
            <span className="p-[3px]"><span className={`${sq} bg-tint text-ink/75 group-hover:bg-grape group-hover:text-white`}><Icon name="search" size={21} /></span></span>
            <span className="text-[12.5px] font-semibold text-ink/60">Search</span>
          </button>
        )}
      </div>
    </div>
  );
}
