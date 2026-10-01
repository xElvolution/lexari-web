"use client";

import { memo, useRef, useState } from "react";
import { GLYPH_CATALOG, VIVID, VIVID_GRADIENTS, VIVID_KEYS, glyphLabel, type AvatarState, type GlyphPartKey, type VividKey } from "@/lib/glyph";
import { randomFace, type FaceDNA } from "@/lib/glyph/face";
import Icon from "@/components/app/Icon";
import GlyphFace from "./GlyphFace";

type Tab = GlyphPartKey | "colour";
const TABS: [Tab, string][] = [["body", "Body"], ["eyes", "Eyes"], ["mouth", "Mouth"], ["brows", "Brows"], ["accent", "Accent"], ["orbit", "Orbit"], ["colour", "Colour"]];
const STATES: [AvatarState, string][] = [["idle", "Idle"], ["thinking", "Think"], ["speaking", "Talk"], ["happy", "Happy"]];
const NAMES: Record<VividKey, string> = { orange: "Orange", yellow: "Yellow", lime: "Lime", green: "Green", teal: "Teal", sky: "Sky", blue: "Blue", indigo: "Indigo", purple: "Purple", lilac: "Lilac", pink: "Pink", magenta: "Magenta", red: "Red", coral: "Coral" };

/** soft tile colour behind a vivid face */
export const faceTint = (f: FaceDNA, k = 24) => `color-mix(in oklab, ${VIVID[f.color.body]?.fill ?? "#8b5cf6"} ${k}%, var(--card))`;

export function Dice({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none" /></svg>
  );
}

const Tile = memo(function Tile({ dna, on, label, onPick, size }: { dna: FaceDNA; on: boolean; label: string; onPick: () => void; size: number }) {
  return (
    <button type="button" onClick={onPick} aria-pressed={on} aria-label={label} title={label}
      className={`group relative flex flex-col items-center gap-0.5 rounded-[18px] px-1 pb-1.5 pt-2 transition-all duration-300 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] ${on ? "bg-tint ring-2 ring-grape" : "bg-tint/60 ring-1 ring-line hover:-translate-y-0.5 hover:ring-grape/50"}`}>
      <span className="grid place-items-center rounded-[14px] transition group-hover:scale-105" style={{ width: size + 6, height: size + 6, background: faceTint(dna, 30) }}><GlyphFace dna={dna} size={size} /></span>
      <span className={`max-w-full truncate text-[11.5px] font-bold ${on ? "text-ink" : "text-ink/65"}`}>{label}</span>
      {on && <span className="pop absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-grape text-white"><Icon name="check" size={11} stroke={3} /></span>}
    </button>
  );
});

function Slider({ label, min, max, step, value, onStart, onChange }: { label: string; min: number; max: number; step: number; value: number; onStart: () => void; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between"><span className="label text-[9px] text-ink/55">{label}</span><span className="text-[11px] font-bold text-ink/50">{Math.round(((value - min) / (max - min)) * 100)}%</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={onStart} onKeyDown={onStart} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-[var(--color-grape)]" aria-label={label} />
    </label>
  );
}

function Swatches({ label, value, onPick }: { label: string; value: VividKey; onPick: (k: VividKey) => void }) {
  return (
    <div>
      <span className="label text-[9px] text-ink/55">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {VIVID_KEYS.map((c) => <button type="button" key={c} role="radio" aria-checked={value === c} aria-label={NAMES[c]} title={NAMES[c]} onClick={() => onPick(c)} className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-[var(--card)] transition hover:scale-110 ${value === c ? "ring-2 ring-grape" : ""}`} style={{ background: VIVID[c].fill, boxShadow: `inset 0 -3px 0 ${VIVID[c].shade}` }} />)}
      </div>
    </div>
  );
}

/**
 * Glyph character creator: live animated preview (idle / think / talk / happy),
 * part tabs, option tiles that show this agent with each option, vivid colours
 * (body, accent, solid or gradient), sliders, randomize and undo.
 */
export default function GlyphCreator({ value, onChange, name, previewSize = 150, wide = false, preview = true }: { value: FaceDNA; onChange: (f: FaceDNA) => void; name?: string; previewSize?: number; wide?: boolean; preview?: boolean }) {
  const [tab, setTab] = useState<Tab>("body");
  const [state, setState] = useState<AvatarState>("idle");
  const hist = useRef<FaceDNA[]>([]);
  const [, bump] = useState(0);
  const push = () => { hist.current = [...hist.current.slice(-39), value]; bump((n) => n + 1); };
  const commit = (f: FaceDNA) => { push(); onChange(f); };
  const undo = () => { const p = hist.current.pop(); bump((n) => n + 1); if (p) onChange(p); };
  const shuffle = () => { commit(randomFace(value)); setState("happy"); setTimeout(() => setState((s) => (s === "happy" ? "idle" : s)), 1400); };
  const part = (k: GlyphPartKey, id: string): FaceDNA => ({ ...value, glyph: { ...value.glyph, [k]: id } });
  const col = (c: Partial<FaceDNA["color"]>): FaceDNA => ({ ...value, color: { ...value.color, ...c } });
  const grid = wide ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-4";
  const tileSize = 52;

  return (
    <div className="space-y-4">
      {preview && (
        <div className="carpet-w relative overflow-hidden rounded-[26px] bg-[#0a0a0a] p-3 text-white ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-2">
            <span className="label pt-1.5 text-[9px] text-white/60">Live preview{name ? ` · ${name}` : ""}</span>
            <div className="flex gap-1.5">
              <button type="button" onClick={undo} disabled={!hist.current.length} aria-label="Undo" title="Undo" className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-35"><Icon name="undo" size={16} /></button>
              <button type="button" onClick={shuffle} className="flex h-9 items-center gap-1.5 rounded-xl bg-grape px-3 text-[13px] font-bold text-white shadow-[0_3px_0_#3514b0] transition hover:-translate-y-0.5"><Dice />Randomize</button>
            </div>
          </div>
          <div className="relative grid place-items-center py-2">
            <span className="pointer-events-none absolute h-[70%] w-[55%] rounded-full blur-[46px]" style={{ background: VIVID[value.color.body]?.fill, opacity: 0.35 }} />
            <span className="relative"><GlyphFace dna={value} state={state} size={previewSize} animated /></span>
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white/10 p-1" role="radiogroup" aria-label="Preview state">
            {STATES.map(([s, l]) => <button type="button" key={s} role="radio" aria-checked={state === s} onClick={() => setState(s)} className={`h-8 rounded-xl text-[13px] font-bold transition ${state === s ? "bg-white text-[#0a0a0a]" : "text-white/70 hover:text-white"}`}>{l}</button>)}
          </div>
        </div>
      )}

      <div className="no-bar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Face parts">
        {TABS.map(([t, l]) => <button type="button" key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-bold transition ${tab === t ? "bg-grape text-white shadow-[0_3px_0_#3514b0]" : "bg-tint text-ink/75 hover:text-ink"}`}>{l}</button>)}
        {!preview && <button type="button" onClick={shuffle} aria-label="Randomize" title="Randomize" className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-ink hover:bg-grape hover:text-white"><Dice /></button>}
      </div>

      {tab !== "colour" ? (
        <div className={`grid ${grid} gap-2`} role="radiogroup" aria-label={tab}>
          {GLYPH_CATALOG[tab].map((id) => <Tile key={id} dna={part(tab, id)} on={value.glyph[tab] === id} label={glyphLabel(tab, id)} onPick={() => commit(part(tab, id))} size={tileSize} />)}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <span className="label text-[9px] text-ink/55">Gradients</span>
            <div className={`mt-1.5 grid ${grid} gap-2`}>
              {VIVID_GRADIENTS.map((g) => { const d = col({ body: g.body, accent: g.accent, finish: "gradient" }); const on = value.color.finish === "gradient" && value.color.body === g.body && value.color.accent === g.accent; return <Tile key={g.id} dna={d} on={on} label={g.label} onPick={() => commit(d)} size={tileSize} />; })}
            </div>
          </div>
          <Swatches label="Body colour" value={value.color.body} onPick={(c) => commit(col({ body: c }))} />
          <Swatches label="Accent colour · antenna, ears, orbit" value={value.color.accent} onPick={(c) => commit(col({ accent: c }))} />
          <div>
            <span className="label text-[9px] text-ink/55">Finish</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-full bg-tint p-1">
              {(["solid", "gradient"] as const).map((f) => <button type="button" key={f} aria-pressed={value.color.finish === f} onClick={() => commit(col({ finish: f }))} className={`h-9 rounded-full text-[13.5px] font-bold transition ${value.color.finish === f ? "bg-card text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink/60 hover:text-ink"}`}>{f === "solid" ? "Solid" : "Two-tone gradient"}</button>)}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Slider label="Roundness" min={0} max={1} step={0.02} value={value.glyph.roundness} onStart={push} onChange={(v) => onChange({ ...value, glyph: { ...value.glyph, roundness: v } })} />
            <Slider label="Eye size" min={0.8} max={1.25} step={0.01} value={value.glyph.eyeSize} onStart={push} onChange={(v) => onChange({ ...value, glyph: { ...value.glyph, eyeSize: v } })} />
            <Slider label="Eye spacing" min={0} max={1} step={0.02} value={value.glyph.eyeGap} onStart={push} onChange={(v) => onChange({ ...value, glyph: { ...value.glyph, eyeGap: v } })} />
          </div>
        </div>
      )}
    </div>
  );
}
