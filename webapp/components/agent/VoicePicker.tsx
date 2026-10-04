"use client";

import { useEffect, useState } from "react";
import { speak, voices } from "@/lib/voice";
import { VOICE_PRESETS } from "@/lib/voices";
import Icon from "../Icon";

export type AgentVoice = { name: string; pitch: number; rate: number; preset?: string };

/** Pick a browser voice and a pitch/rate preset for one agent. Used on calls and Read aloud. */
export default function VoicePicker({ value, onChange, name }: { value: AgentVoice; onChange: (v: AgentVoice) => void; name: string }) {
  const [list, setList] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => { void voices().then((v) => setList(v.filter((x) => /^(en|fr|es|pt|de|yo|ha|ig)/i.test(x.lang)).slice(0, 60))); }, []);
  const test = () => speak(`Hi, I'm ${name}. This is how I sound on calls.`, value);
  return (
    <div data-voice-picker>
      <span className="label text-[9.5px] text-ink/60">Voice</span>
      <div className="mt-1.5 rounded-2xl bg-card p-3.5 ring-1 ring-line">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Voice style">
          {VOICE_PRESETS.map((p) => {
            const on = (value.preset || "natural") === p.id;
            return <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, preset: p.id, pitch: p.pitch, rate: p.rate })} className={`rounded-full px-3 py-1.5 text-[13px] font-bold transition ${on ? "bg-grape text-white" : "bg-tint text-ink/75 hover:text-ink"}`}>{p.label}</button>;
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="relative min-w-0 flex-1">
            <select value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} aria-label="Browser voice" className="h-10 w-full appearance-none truncate rounded-full bg-tint pl-4 pr-9 text-[13.5px] font-semibold text-ink outline-none">
              <option value="">Device default voice</option>
              {list.map((v) => <option key={v.name} value={v.name}>{v.name} · {v.lang}</option>)}
            </select>
            <Icon name="right" size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-ink/60" />
          </span>
          <button type="button" onClick={() => void test()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-bold text-brand-ink hover:bg-grape hover:text-white"><Icon name="play" size={13} />Test</button>
        </div>
        <p className="mt-2 text-[12px] text-ink/50">{list.length ? `${list.length} voices on this device.` : "Uses your device's voices."} Pitch {value.pitch.toFixed(2)} · speed {value.rate.toFixed(2)}</p>
      </div>
    </div>
  );
}
