"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTyping, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { myAgents, type MyAgent } from "../agents";

function Tile({ a, s, on, onPick }: { a: MyAgent; s: State; on: boolean; onPick: (id: string) => void }) {
  const typing = useTyping(a.id);
  return (
    <button data-tile onClick={() => onPick(a.id)} aria-pressed={on} title={`${a.name} · ${a.role}`} className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-2xl pb-1 pt-1.5 outline-none focus-visible:bg-tint">
      <span className={`relative rounded-[20px] p-[3px] transition duration-200 ${on ? "bg-grape" : "bg-transparent group-hover:bg-line"}`}>
        <AgentTile id={a.id} look={s.agent?.look} size={54} className="transition duration-200 group-hover:scale-[1.04]" radius={17} />
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

  return (
    <div className="flex flex-col gap-2 border-b border-line px-3 py-2.5 sm:px-4 md:flex-row md:items-center md:gap-3">
      <label className="relative flex h-11 shrink-0 items-center md:w-[210px]">
        <Icon name="search" size={17} className="pointer-events-none absolute left-3.5 text-ink/50" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${all.length} agent${all.length === 1 ? "" : "s"}`} aria-label="Search your agents" className="h-full w-full rounded-full bg-tint pl-10 pr-9 text-[14.5px] text-ink outline-none ring-grape transition placeholder:text-ink/50 focus:ring-2" />
        {q && <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 grid h-7 w-7 place-items-center rounded-full text-ink/60 hover:bg-line"><Icon name="x" size={14} /></button>}
      </label>
      <div className="relative min-w-0 flex-1">
        <div ref={row} onScroll={measure} className="no-bar flex cursor-grab select-none items-start gap-1 overflow-x-auto scroll-smooth active:cursor-grabbing" role="list" aria-label="Your agents">
          {list.map((a) => <Tile key={a.id} a={a} s={s} on={a.id === active} onPick={onPick} />)}
          {q && list.length === 0 && <p className="self-center whitespace-nowrap px-3 text-[14px] text-ink/60">No agent matches “{q}”.</p>}
          <Link href="/app/marketplace" draggable={false} title="Add an agent" className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 pb-1 pt-1.5">
            <span className="p-[3px]"><span className="grid h-[54px] w-[54px] place-items-center rounded-[17px] border-2 border-dashed border-ink/30 text-ink/70 transition group-hover:border-grape group-hover:bg-tint group-hover:text-brand-ink"><Icon name="plus" size={22} /></span></span>
            <span className="text-[12.5px] font-semibold text-ink/60">Add</span>
          </Link>
        </div>
        {edge.l && <button onClick={() => nudge(-1)} aria-label="Scroll left" className="absolute left-0 top-0 z-10 hidden h-full w-14 items-center justify-start bg-gradient-to-r from-base via-base/80 to-transparent md:flex"><span className="grid h-9 w-9 place-items-center rounded-full bg-card text-ink shadow ring-1 ring-line hover:text-brand-ink"><Icon name="left" size={18} /></span></button>}
        {edge.r && <button onClick={() => nudge(1)} aria-label="Scroll right" className="absolute right-0 top-0 z-10 hidden h-full w-14 items-center justify-end bg-gradient-to-l from-base via-base/80 to-transparent md:flex"><span className="grid h-9 w-9 place-items-center rounded-full bg-card text-ink shadow ring-1 ring-line hover:text-brand-ink"><Icon name="right" size={18} /></span></button>}
      </div>
    </div>
  );
}
