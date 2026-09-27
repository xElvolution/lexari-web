"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { desktopFor } from "@/content/appData";
import { agentName, downloadFile, isGroup, groupOf, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { nameOf } from "../agents";

const TABS = [{ id: "screen", label: "Screen", icon: "globe" }, { id: "terminal", label: "Terminal", icon: "terminal" }, { id: "files", label: "Files", icon: "folder" }] as const;
type Tab = (typeof TABS)[number]["id"];

function Screen({ kind, url, title, step }: { kind: "browser" | "doc" | "sheet"; url: string; title: string; step: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 rounded-xl bg-white/[.08] px-3 py-2 font-mono text-[11.5px] text-white/80">
        <Icon name="globe" size={13} className="shrink-0 text-lilac" /><span className="truncate">https://{url}</span><span className="label ml-auto shrink-0 text-[8.5px] text-white/50">demo</span>
      </div>
      <div className="relative mt-3 flex-1 overflow-hidden rounded-xl bg-white/[.04] p-4 ring-1 ring-white/10">
        <div className="text-[15px] font-bold text-white">{title}</div>
        <div className="mt-1.5 h-2 w-1/3 rounded-full bg-white/15" />
        {kind === "sheet" ? (
          <div className="mt-4 grid grid-cols-4 gap-px overflow-hidden rounded-lg bg-white/10 text-[10.5px]">
            {Array.from({ length: 28 }).map((_, i) => <div key={i} className={`h-6 px-1.5 leading-6 ${i < 4 ? "bg-white/15 font-bold text-white/85" : Math.floor(i / 4) === (step % 6) + 1 ? "bg-grape/60 text-white" : "bg-[#0d0a17] text-white/55"}`}>{i < 4 ? ["Date", "Item", "Qty", "Total"][i] : i % 4 === 0 ? `0${(i % 9) + 1}/09` : i % 4 === 1 ? "row" : ((i * 7) % 90) + 10}</div>)}
          </div>
        ) : kind === "doc" ? (
          <div className="mt-4 space-y-2.5">
            {[92, 86, 95, 60, 0, 88, 78, 90, 40].map((w, i) => w === 0 ? <div key={i} className="h-2" /> : <div key={i} className={`h-2 rounded-full ${i === step % 9 ? "bg-lilac" : "bg-white/20"}`} style={{ width: `${w}%` }} />)}
            <span className="caret inline-block h-4 w-0.5 bg-lilac align-middle" />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`rounded-lg p-2.5 transition-colors duration-500 ${i === step % 3 ? "bg-grape" : "bg-white/[.07]"}`}>
                <div className="h-2 w-3/4 rounded-full bg-white/60" />{[0, 1, 2].map((k) => <div key={k} className="mt-1.5 h-1.5 rounded-full bg-white/25" style={{ width: `${88 - k * 18}%` }} />)}
              </div>
            ))}
            {[0, 1, 2, 3].map((k) => <div key={k} className="col-span-3 h-1.5 rounded-full bg-white/15" style={{ width: `${95 - k * 12}%` }} />)}
          </div>
        )}
        <div className="scan pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-transparent via-grape/25 to-transparent" />
        <svg className="cursor-path pointer-events-none absolute h-5 w-5 drop-shadow" viewBox="0 0 24 24" aria-hidden><path d="M5 3l14 8-6 1.5L10 19z" fill="#fff" stroke="#0a0a0a" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
}

/** The agent's own computer, like watching over its shoulder. Demo: a mock screen that loops through a few steps. */
export default function DesktopPane({ s, id, onClose, full = false }: { s: State; id: string; onClose: () => void; full?: boolean }) {
  const members = isGroup(id) ? groupOf(s, id)?.members ?? ["home"] : [id];
  const [who, setWho] = useState(members[0]);
  const [tab, setTab] = useState<Tab>("screen");
  const [step, setStep] = useState(0);
  const root = useRef<HTMLElement>(null);
  const d = desktopFor(who, agentName(s));
  useEffect(() => { setWho(members[0]); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setStep(0); const t = setInterval(() => setStep((x) => x + 1), 2600); return () => clearInterval(t); }, [who]);
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(root.current, { opacity: 0, x: full ? 0 : 24, y: full ? 16 : 0 }, { opacity: 1, x: 0, y: 0, duration: 0.35, ease: "power3.out", clearProps: "transform" });
  }, [full]);
  const cur = step % d.steps.length;
  const shown = d.terminal.slice(0, Math.min(d.terminal.length, 2 + (step % (d.terminal.length - 1))));
  const clock = (k: number) => new Date(Date.now() - k * 2600).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <aside ref={root} aria-label={`${nameOf(s, who)}'s desktop`} className={`flex min-h-0 flex-col bg-alt ${full ? "h-full" : "h-full border-l border-line"}`}>
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-line px-4">
        <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-grape text-white"><Icon name="monitor" size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-bold text-ink">{nameOf(s, who)}&apos;s desktop</h2>
          <p className="flex items-center gap-1.5 text-[12.5px] text-ink/60"><i className="h-1.5 w-1.5 rounded-full bg-grape live-dot" />Live · demo view</p>
        </div>
        <button onClick={onClose} aria-label="Close desktop" className="grid h-10 w-10 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-ink"><Icon name={full ? "back" : "x"} size={19} /></button>
      </header>
      {members.length > 1 && (
        <div className="no-bar flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5">
          {members.map((m) => (
            <button key={m} onClick={() => setWho(m)} aria-pressed={who === m} className={`flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-semibold transition ${who === m ? "bg-grape text-white" : "bg-card text-ink/75 ring-1 ring-line hover:text-ink"}`}>
              <AgentTile id={m} look={s.agent?.look} size={26} radius={13} />{nameOf(s, m)}
            </button>
          ))}
        </div>
      )}
      <div className="no-bar min-h-0 flex-1 overflow-y-auto p-4">
        <div className="rounded-[22px] bg-frame p-2.5 ring-1 ring-line">
          <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1">
            <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-white/25" /><i className="h-2.5 w-2.5 rounded-full bg-white/25" /><i className="h-2.5 w-2.5 rounded-full bg-white/25" /></span>
            <div className="ml-2 flex gap-1" role="tablist" aria-label="Desktop view">
              {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold transition ${tab === t.id ? "bg-white text-[#0a0a0a]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}><Icon name={t.icon} size={13} />{t.label}</button>)}
            </div>
          </div>
          <div className="relative h-[300px] overflow-hidden rounded-[16px] bg-[#07050e] p-3.5 xl:h-[340px]">
            {tab === "screen" && <Screen kind={d.kind} url={d.url} title={d.title} step={step} />}
            {tab === "terminal" && (
              <div className="font-mono text-[12px] leading-[1.9]">
                {shown.map((l, i) => <div key={i} className={l.startsWith("$") ? "text-white" : "text-lilac"}>{l}</div>)}<span className="caret" />
              </div>
            )}
            {tab === "files" && (
              <div className="grid gap-2">
                {d.files.map((f) => (
                  <div key={f.name} className="flex items-center gap-3 rounded-xl bg-white/[.07] px-3 py-2.5 ring-1 ring-white/10">
                    <span className="grid h-8 w-7 place-items-center rounded-md bg-grape text-[9px] font-bold uppercase text-white">{f.name.split(".").pop()}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-white">{f.name}</span>
                    <span className="text-[11px] text-white/55">{f.size}</span>
                    <button onClick={() => downloadFile(f.name, `${f.name}\nDemo file from ${nameOf(s, who)}'s desktop.\n`)} aria-label={`Download ${f.name}`} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-grape"><Icon name="download" size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between"><span className="label text-[9.5px] text-ink/55">Activity</span><span className="label text-[9px] text-ink/40">demo</span></div>
        <ol className="mt-2.5 space-y-1">
          {Array.from({ length: Math.min(5, step + 1) }).map((_, k) => {
            const i = (cur - k + d.steps.length * 10) % d.steps.length;
            return (
              <li key={`${step - k}`} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] ${k === 0 ? "bg-card font-semibold text-ink ring-1 ring-line" : "text-ink/60"}`}>
                <i className={`h-2 w-2 shrink-0 rounded-full ${k === 0 ? "bg-grape live-dot" : "bg-ink/20"}`} />
                <span className="min-w-0 flex-1 truncate">{d.steps[i]}</span>
                <span className="tab-num font-mono text-[11px] text-ink/45" suppressHydrationWarning>{clock(k)}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
