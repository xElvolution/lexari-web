"use client";

import { memo, useRef, useState } from "react";
import Face from "@shared/components/Face";
import BgArt from "@shared/components/BgArt";
import { ALL_BROWS, ALL_EXTRAS, ALL_EYES, ALL_MOUTHS, ALL_ORBITS, ALL_SHAPES, COLORS, LABEL, type FaceLook, type FaceState, type Variant } from "@shared/components/avatar";
import { BACKGROUNDS } from "@shared/lib/backgrounds";
import Icon from "../Icon";

type Tab = "shape" | "color" | "eyes" | "mouth" | "brows" | "extra" | "orbit" | "bg";
const TABS: [Tab, string][] = [["shape", "Shape"], ["color", "Colour"], ["eyes", "Eyes"], ["mouth", "Mouth"], ["brows", "Brows"], ["extra", "Extras"], ["orbit", "Orbit"], ["bg", "Background"]];
const STATES: [FaceState, string][] = [["idle", "Idle"], ["thinking", "Think"], ["speaking", "Talk"], ["happy", "Happy"]];
const LISTS = { shape: ALL_SHAPES, eyes: ALL_EYES, mouth: ALL_MOUTHS, brows: ALL_BROWS, extra: ALL_EXTRAS, orbit: ALL_ORBITS } as const;
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export function Dice({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none" /></svg>;
}

const Tile = memo(function Tile({ v, on, label, onPick, children }: { v: Variant; on: boolean; label: string; onPick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onPick} aria-pressed={on} aria-label={label} title={label}
      className={`group relative flex flex-col items-center gap-1 rounded-[18px] p-1.5 pb-1 transition-all duration-300 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] ${on ? "ring-2 ring-grape" : "ring-1 ring-line hover:-translate-y-0.5 hover:ring-grape/50"}`}>
      <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-[13px] bg-[var(--face-tile)]">{children}<span className="relative transition group-hover:scale-105"><Face variant={v} size={46} /></span></span>
      <span className={`max-w-full truncate text-[11px] font-bold ${on ? "text-ink" : "text-ink/60"}`}>{label}</span>
      {on && <span className="pop absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-grape text-white"><Icon name="check" size={11} stroke={3} /></span>}
    </button>
  );
});

/** A random look from the classic parts (no hats unless you pick one). */
export function randomLook(keep?: Partial<FaceLook>): FaceLook {
  const shape = pick(ALL_SHAPES);
  return { shape, color: pick(COLORS), eyes: pick(ALL_EYES), mouth: pick(ALL_MOUTHS), extra: shape === "robot" ? "antenna" : pick(["none", "none", "antenna", "ears", "catEars", "tuft", "horns"] as const), brows: pick(ALL_BROWS), orbit: pick(["none", "dots", "dots", "ring", "comet", "sparkle"] as const), dots: 3, blush: Math.random() < 0.4, bg: keep?.bg ?? "black" };
}

/**
 * The face creator: the classic Lexari faces plus states, brows, extras, orbiting memory dots
 * and an NFT background. Live preview with Idle / Think / Talk / Happy, randomize and undo.
 */
export default function FaceCreator({ value, onChange, name, wide = false, preview = true }: { value: FaceLook; onChange: (v: FaceLook) => void; name?: string; wide?: boolean; preview?: boolean }) {
  const [tab, setTab] = useState<Tab>("shape");
  const [state, setState] = useState<FaceState>("idle");
  const hist = useRef<FaceLook[]>([]);
  const [, bump] = useState(0);
  const v: FaceLook = { ...value, plain: false };
  const commit = (n: Partial<FaceLook>) => { hist.current = [...hist.current.slice(-39), value]; bump((x) => x + 1); onChange({ ...v, ...n }); };
  const undo = () => { const p = hist.current.pop(); bump((x) => x + 1); if (p) onChange(p); };
  const shuffle = () => { hist.current = [...hist.current.slice(-39), value]; onChange(randomLook(value)); setState("happy"); setTimeout(() => setState((s) => (s === "happy" ? "idle" : s)), 1600); };
  const grid = wide ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-4";

  return (
    <div className="space-y-4">
      {preview && (
        <div data-face-preview data-bg={v.bg ?? "black"} className="relative overflow-hidden rounded-[26px] bg-[#0a0a0a] p-3 text-white ring-1 ring-white/10">
          <BgArt id={v.bg ?? "black"} />
          <div className="relative flex items-start justify-between gap-2">
            <span className="label mt-1 rounded-full bg-black/45 px-2 py-1 text-[9px] text-white/80 backdrop-blur-sm">Live preview{name ? ` · ${name}` : ""}</span>
            <div className="flex gap-1.5">
              <button type="button" onClick={undo} disabled={!hist.current.length} aria-label="Undo" title="Undo" className="grid h-9 w-9 place-items-center rounded-xl bg-black/45 backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-35"><Icon name="undo" size={16} /></button>
              <button type="button" onClick={shuffle} className="flex h-9 items-center gap-1.5 rounded-xl bg-grape px-3 text-[13px] font-bold shadow-[0_3px_0_#3514b0] transition hover:-translate-y-0.5"><Dice />Randomize</button>
            </div>
          </div>
          <div className="relative grid place-items-center py-1"><Face variant={v} size={150} state={state} animated /></div>
          <div className="relative grid grid-cols-4 gap-1 rounded-2xl bg-black/45 p-1 backdrop-blur-sm" role="radiogroup" aria-label="Preview state">
            {STATES.map(([s, l]) => <button type="button" key={s} role="radio" aria-checked={state === s} onClick={() => setState(s)} className={`h-8 rounded-xl text-[13px] font-bold transition ${state === s ? "bg-white text-[#0a0a0a]" : "text-white/70 hover:text-white"}`}>{l}</button>)}
          </div>
        </div>
      )}

      <div className="no-bar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Face parts">
        {TABS.map(([t, l]) => <button type="button" key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-bold transition ${tab === t ? "bg-grape text-white shadow-[0_3px_0_#3514b0]" : "bg-tint text-ink/75 hover:text-ink"}`}>{l}</button>)}
        {!preview && <button type="button" onClick={shuffle} aria-label="Randomize" title="Randomize" className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-ink hover:bg-grape hover:text-white"><Dice /></button>}
      </div>

      {tab === "color" ? (
        <div className="space-y-4">
          <div className={`grid ${grid} gap-2`}>{COLORS.map((c) => <Tile key={c} v={{ ...v, color: c }} on={v.color === c} label={c[0].toUpperCase() + c.slice(1)} onPick={() => commit({ color: c })} />)}</div>
          <label className="flex items-center justify-between rounded-2xl bg-tint px-3.5 py-2.5 text-[14px] font-bold text-ink">Blush cheeks<input type="checkbox" checked={!!v.blush} onChange={(e) => commit({ blush: e.target.checked })} className="h-5 w-5 accent-[var(--color-grape)]" /></label>
        </div>
      ) : tab === "bg" ? (
        <div className="space-y-2">
          <p className="text-[12.5px] text-ink/55">Shown behind the face on the ID card and its NFT. Small avatars stay plain.</p>
          <div className={`grid ${grid} gap-2`}>{BACKGROUNDS.map((b) => <Tile key={b.id} v={v} on={(v.bg ?? "black") === b.id} label={b.label} onPick={() => commit({ bg: b.id })}><BgArt id={b.id} /></Tile>)}</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`grid ${grid} gap-2`} role="radiogroup" aria-label={tab}>
            {(LISTS[tab] as readonly string[]).map((id) => {
              const cur = (v as Record<string, unknown>)[tab] ?? "none";
              return <Tile key={id} v={{ ...v, [tab]: id } as Variant} on={cur === id} label={LABEL[id] ?? id} onPick={() => commit({ [tab]: id } as Partial<FaceLook>)} />;
            })}
          </div>
          {tab === "orbit" && v.orbit && v.orbit !== "none" && v.orbit !== "comet" && (
            <label className="block"><span className="flex justify-between"><span className="label text-[9px] text-ink/55">Memory dots</span><span className="text-[12px] font-bold text-ink/60">{v.dots ?? 3}</span></span>
              <input type="range" min={1} max={6} step={1} value={v.dots ?? 3} onChange={(e) => commit({ dots: Number(e.target.value) })} className="mt-1.5 w-full accent-[var(--color-grape)]" aria-label="Memory dots" /></label>
          )}
        </div>
      )}
    </div>
  );
}
