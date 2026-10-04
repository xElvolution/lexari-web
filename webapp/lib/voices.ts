"use client";

import { get } from "./store";
import type { VoiceSettings } from "./voice";

/** Pitch/rate presets that work with any browser voice. */
export const VOICE_PRESETS: { id: string; label: string; pitch: number; rate: number }[] = [
  { id: "natural", label: "Natural", pitch: 1, rate: 1 },
  { id: "warm", label: "Warm", pitch: 0.85, rate: 0.95 },
  { id: "bright", label: "Bright", pitch: 1.3, rate: 1.05 },
  { id: "calm", label: "Calm", pitch: 0.8, rate: 0.85 },
  { id: "quick", label: "Quick", pitch: 1.05, rate: 1.3 },
  { id: "deep", label: "Deep", pitch: 0.55, rate: 0.95 },
];

/** Each agent's own voice (agent settings), so a call with Quill doesn't sound like your agent. */
export function voiceOf(id: string): VoiceSettings {
  const v = get().meta[id]?.voice;
  if (v) return v;
  // A gentle default difference per agent until you pick one.
  if (id === "home") return { pitch: 1, rate: 1 };
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const p = VOICE_PRESETS[1 + (h % (VOICE_PRESETS.length - 1))];
  return { pitch: p.pitch, rate: p.rate };
}
