"use client";

import Face from "@shared/components/Face";
import { COLORS, PALETTE, type ColorKey, type Eyes, type FaceLook, type Mouth, type Shape } from "@shared/components/avatar";
import FaceCreator from "./FaceCreator";
import { AGENT_SKILLS, LOOKS, TONES, type ToneId } from "@/content/appData";
import Icon from "../Icon";
import { AgentFace } from "../faces";

export const SHAPES: Shape[] = ["round", "square", "blob", "hex", "tri", "robot", "egg", "tall", "wide"];
export const EYES: Eyes[] = ["oval", "dot", "happy", "wink", "big", "sleepy", "glasses", "visor"];
export const MOUTHS: Mouth[] = ["smile", "grin", "o", "flat", "cat", "tongue", "teeth", "none"];
export type Look = { shape: Shape; color: ColorKey; eyes: Eyes; mouth: Mouth } & Partial<Pick<FaceLook, "extra" | "blush" | "brows" | "orbit" | "dots" | "bg">>;
/** a Look as a full face variant (older looks get the robot antenna, as before) */
export const variant = (l: Look): FaceLook => ({ ...l, extra: l.extra ?? (l.shape === "robot" ? "antenna" : "none"), blush: l.blush ?? false });

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-grape" : "bg-ink/20"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} /></button>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2"><span className="label text-[9.5px] text-ink/60">{label}</span>{hint && <span className="text-[12px] text-ink/45">{hint}</span>}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
export const inputCls = "h-12 w-full rounded-2xl bg-tint px-4 text-[16px] text-ink outline-none ring-grape placeholder:text-ink/40 focus:ring-2";
export const areaCls = "min-h-[92px] w-full resize-y rounded-2xl bg-tint px-4 py-3 text-[15px] leading-snug text-ink outline-none ring-grape placeholder:text-ink/40 focus:ring-2";

function Opt({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} title={label} className={`grid place-items-center rounded-2xl p-1.5 transition ${on ? "bg-tint ring-2 ring-grape" : "ring-1 ring-line hover:ring-grape/50"}`}>{children}</button>;
}

/** Face builder for agents you make: shape, colour, eyes and mouth, with a big live preview. */
export function AvatarPicker({ v, onChange, compact = false, name }: { v: Look; onChange: (l: Look) => void; compact?: boolean; name?: string }) {
  return <FaceCreator value={variant(v)} onChange={(f) => onChange(f as Look)} name={name} wide={!compact} preview={!compact} />;
}
/** the original simple picker (kept for reference; the creator above replaces it) */
export function ClassicPicker({ v, onChange, compact = false }: { v: Look; onChange: (l: Look) => void; compact?: boolean }) {
  const set = (p: Partial<Look>) => onChange({ ...v, ...p });
  const shuffle = () => { const r = (a: readonly string[]) => a[Math.floor(Math.random() * a.length)]; onChange({ shape: r(SHAPES) as Shape, color: r(COLORS) as ColorKey, eyes: r(EYES) as Eyes, mouth: r(MOUTHS) as Mouth }); };
  return (
    <div className={compact ? "space-y-4" : "grid gap-5 sm:grid-cols-[168px_1fr]"}>
      {!compact && (
        <div className="flex flex-col items-center gap-3">
          <span className="grid h-[150px] w-[150px] place-items-center rounded-[40px] transition-colors" style={{ background: `color-mix(in oklab, ${PALETTE[v.color].fill} 24%, var(--card))` }}>
            <span key={`${v.shape}${v.color}${v.eyes}${v.mouth}`} className="pop"><Face variant={variant(v)} size={118} track /></span>
          </span>
          <button type="button" onClick={shuffle} className="flex items-center gap-1.5 rounded-full bg-tint px-3.5 py-2 text-[13px] font-bold text-ink transition hover:bg-grape hover:text-white"><Icon name="flip" size={14} />Surprise me</button>
        </div>
      )}
      <div className="space-y-4">
        <div>
          <span className="label text-[9px] text-ink/55">Shape</span>
          <div className="mt-1.5 grid grid-cols-9 gap-1.5">{SHAPES.map((sh) => <Opt key={sh} on={v.shape === sh} onClick={() => set({ shape: sh })} label={`${sh} shape`}><Face variant={variant({ ...v, shape: sh })} size={30} /></Opt>)}</div>
        </div>
        <div>
          <span className="label text-[9px] text-ink/55">Colour</span>
          <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">{COLORS.map((c) => <button type="button" key={c} role="radio" aria-checked={v.color === c} aria-label={c} title={c} onClick={() => set({ color: c })} className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-[var(--card)] transition hover:scale-110 ${v.color === c ? "ring-2 ring-grape" : ""}`} style={{ background: PALETTE[c].fill, boxShadow: `inset 0 -3px 0 ${PALETTE[c].shade}` }} />)}</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className="label text-[9px] text-ink/55">Eyes</span><div className="mt-1.5 grid grid-cols-4 gap-1.5">{EYES.map((e) => <Opt key={e} on={v.eyes === e} onClick={() => set({ eyes: e })} label={`${e} eyes`}><Face variant={variant({ ...v, eyes: e })} size={28} /></Opt>)}</div></div>
          <div><span className="label text-[9px] text-ink/55">Mouth</span><div className="mt-1.5 grid grid-cols-4 gap-1.5">{MOUTHS.map((m) => <Opt key={m} on={v.mouth === m} onClick={() => set({ mouth: m })} label={`${m} mouth`}><Face variant={variant({ ...v, mouth: m })} size={28} /></Opt>)}</div></div>
        </div>
      </div>
    </div>
  );
}

/** Your own agent keeps the onboarding faces. */
export function LookPicker({ look, onChange }: { look: number | null; onChange: (l: number | null) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {LOOKS.map((l) => <Opt key={String(l)} on={look === l} onClick={() => onChange(l)} label={l === null ? "House face" : `Face ${l}`}><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#0a0a0a]"><AgentFace look={l} size={40} /></span></Opt>)}
    </div>
  );
}

export function TonePicker({ tone, onChange }: { tone: ToneId; onChange: (t: ToneId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Personality">
      {TONES.map((t) => <button type="button" key={t.id} role="radio" aria-checked={tone === t.id} onClick={() => onChange(t.id)} className={`rounded-2xl px-3.5 py-3 text-left text-[14px] font-bold transition ${tone === t.id ? "bg-tint text-ink ring-2 ring-grape" : "text-ink/75 ring-1 ring-line hover:ring-grape/50"}`}>{t.label}</button>)}
    </div>
  );
}

export function SkillPicker({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  return (
    <ul className="divide-y divide-[var(--line)] rounded-2xl px-3.5 ring-1 ring-line">
      {AGENT_SKILLS.map((k) => {
        const on = skills.includes(k.id);
        return (
          <li key={k.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold text-ink">{k.label}</span><span className="block text-[12.5px] text-ink/55">{k.desc}</span></span>
            <Toggle on={on} label={k.label} onChange={(v) => onChange(v ? [...skills, k.id] : skills.filter((x) => x !== k.id))} />
          </li>
        );
      })}
    </ul>
  );
}
