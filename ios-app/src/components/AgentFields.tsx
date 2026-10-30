/**
 * Port of webapp/components/agent/fields.tsx and VoicePicker.tsx plus the AGENT_SKILLS / AGENT_TEMPLATES lists from
 * webapp/content/appData.ts, shared by the native Create an agent screen and the agent page's Edit tab.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, TextInput, View, type TextStyle } from "react-native";
import * as Speech from "expo-speech";
import Icon from "./Icon";
import type { ColorKey, Shape } from "./avatar";
import { F, GRAPE, Label, T, WSheet, WToggle, useC } from "@/web/kit";
import { tap } from "./ui";

export const AGENT_SKILLS = [
  { id: "web", label: "Browse the web", desc: "Open pages, read and compare them." },
  { id: "files", label: "Read and write files", desc: "Work with docs and save results to Files." },
  { id: "code", label: "Run code", desc: "Use the terminal on its computer." },
  { id: "sheets", label: "Spreadsheets", desc: "Clean, sum and chart tables." },
  { id: "images", label: "Make images", desc: "Draft simple graphics and cards." },
  { id: "email", label: "Draft emails", desc: "Write emails for you to send." },
  { id: "calendar", label: "Plans and reminders", desc: "Keep dates, steps and check ins." },
  { id: "wallet", label: "Use its wallet", desc: "Pay for tools inside a limit (demo)." },
] as const;
export const skillLabel = (id: string) => AGENT_SKILLS.find((x) => x.id === id)?.label ?? id;

export const AGENT_TEMPLATES: { id: string; label: string; icon: string; role: string; about: string; skills: string[]; shape: Shape; color: ColorKey }[] = [
  { id: "research", label: "Researcher", icon: "search", role: "Research", about: "Reads the web for me, checks every source and sends back a short summary with links.", skills: ["web", "files"], shape: "round", color: "orange" },
  { id: "writer", label: "Writer", icon: "edit", role: "Writing", about: "Drafts posts, emails and briefs in my voice, then cuts them down to what matters.", skills: ["files", "email"], shape: "blob", color: "blue" },
  { id: "analyst", label: "Analyst", icon: "jobs", role: "Numbers", about: "Cleans my sheets, builds summary tables and explains what changed in plain words.", skills: ["sheets", "files"], shape: "square", color: "green" },
  { id: "designer", label: "Designer", icon: "spark", role: "Design", about: "Turns rough ideas into layouts, social cards and simple visuals.", skills: ["images", "web"], shape: "hex", color: "pink" },
  { id: "dev", label: "Developer", icon: "terminal", role: "Code", about: "Reads code, finds the bug and suggests the smallest fix, with tests.", skills: ["code", "files"], shape: "robot", color: "teal" },
  { id: "marketer", label: "Marketer", icon: "chat", role: "Marketing", about: "Plans a week of posts, writes the hooks and keeps an eye on what gets replies.", skills: ["web", "images"], shape: "tall", color: "yellow" },
  { id: "planner", label: "Planner", icon: "list", role: "Planning", about: "Breaks big goals into steps, owners and dates, then checks in every week.", skills: ["calendar", "files"], shape: "egg", color: "sky" },
];

/** webapp content/appData.ts TONES (same ids and labels). */
export const AGENT_TONES = [
  { id: "short", label: "Short and direct" },
  { id: "warm", label: "Warm and chatty" },
  { id: "formal", label: "Formal" },
  { id: "playful", label: "Playful" },
] as const;
export type AgentTone = (typeof AGENT_TONES)[number]["id"];
export const toneLabel = (id?: string) => AGENT_TONES.find((t) => t.id === id)?.label;

/** webapp lib/perks.ts skillSlots: 4, 5 from level 6. */
export const skillSlots = (level: number) => (level >= 6 ? 5 : 4);
/** webapp AddAgentDialog / AgentPanel name rule. */
export const cleanAgentName = (s: string) => s.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 16);

export function useFieldStyle(): TextStyle {
  const k = useC();
  return { height: 48, borderRadius: 14, backgroundColor: k.tint, borderWidth: 1, borderColor: k.line, paddingHorizontal: 14, color: k.ink, fontFamily: F.semi, fontSize: 15, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null) };
}

/** web Field: a small uppercase label, an optional hint on the right, then the control. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const k = useC();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <Label s={9.5} c={k.ink60}>{label}</Label>
        {hint ? <T s={12} c={k.ink45}>{hint}</T> : null}
      </View>
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

export function Area({ value, onChangeText, placeholder, label }: { value: string; onChangeText: (v: string) => void; placeholder?: string; label: string }) {
  const k = useC();
  const field = useFieldStyle();
  return <TextInput multiline accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={k.ink45} style={[field, { height: 110, paddingTop: 12, textAlignVertical: "top", fontFamily: F.sans }]} />;
}

/** web TonePicker: a 2 by 2 grid of radio cards. */
export function TonePicker({ tone, onChange }: { tone: string; onChange: (t: AgentTone) => void }) {
  const k = useC();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Personality" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {AGENT_TONES.map((t) => {
        const on = tone === t.id;
        return (
          <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { tap(); onChange(t.id); }}
            style={{ width: "48.5%", flexGrow: 1, minHeight: 48, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "center", backgroundColor: on ? k.tint : "transparent", borderWidth: on ? 2 : 1, borderColor: on ? GRAPE : k.line }}>
            <T f="bold" s={14} c={on ? k.ink : k.ink75}>{t.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** web SkillPicker: skills to switch on. An agent has 4 skill slots, 5 from level 6 (Extra skill slot). */
export function SkillPicker({ skills, onChange, max = 4 }: { skills: string[]; onChange: (s: string[]) => void; max?: number }) {
  const k = useC();
  const full = skills.length >= max;
  return (
    <View>
      <T f="semi" s={12} c={k.ink60} style={{ marginBottom: 6 }}>{`${skills.length} of ${max} skill slots used${max < 5 ? " · level 6 adds one more" : ""}`}</T>
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: k.line, paddingHorizontal: 14 }}>
        {AGENT_SKILLS.map((s, i) => {
          const on = skills.includes(s.id);
          const locked = !on && full;
          return (
            <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: k.line, opacity: locked ? 0.5 : 1 }}>
              <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={14}>{s.label}</T><T s={12.5} c={k.ink60}>{s.desc}</T></View>
              <WToggle on={on} label={s.label} disabled={locked} onChange={(v) => { if (v && locked) return; onChange(v ? [...skills, s.id] : skills.filter((x) => x !== s.id)); }} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** webapp lib/voices.ts VOICE_PRESETS. */
export const VOICE_PRESETS: { id: string; label: string; pitch: number; rate: number }[] = [
  { id: "natural", label: "Natural", pitch: 1, rate: 1 },
  { id: "warm", label: "Warm", pitch: 0.85, rate: 0.95 },
  { id: "bright", label: "Bright", pitch: 1.3, rate: 1.05 },
  { id: "calm", label: "Calm", pitch: 0.8, rate: 0.85 },
  { id: "quick", label: "Quick", pitch: 1.05, rate: 1.3 },
  { id: "deep", label: "Deep", pitch: 0.55, rate: 0.95 },
];
export type AgentVoice = { name: string; pitch: number; rate: number; preset?: string };
/** webapp voiceOf: the saved voice, else a gentle default difference per agent. */
export function voiceOf(id: string, saved?: Partial<AgentVoice> | null): AgentVoice {
  if (saved && typeof saved === "object") return { name: saved.name || "", pitch: saved.pitch ?? 1, rate: saved.rate ?? 1, preset: saved.preset };
  if (id === "home") return { name: "", pitch: 1, rate: 1 };
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const p = VOICE_PRESETS[1 + (h % (VOICE_PRESETS.length - 1))];
  return { name: "", pitch: p.pitch, rate: p.rate };
}

/** Port of webapp VoicePicker: a style preset, a device voice and a Test button. Used on calls and Read aloud. */
export function VoicePicker({ value, onChange, name }: { value: AgentVoice; onChange: (v: AgentVoice) => void; name: string }) {
  const k = useC();
  const [list, setList] = useState<{ identifier: string; name: string; language: string }[]>([]);
  const [pick, setPick] = useState(false);
  useEffect(() => { Speech.getAvailableVoicesAsync().then((v) => setList(v.filter((x) => /^(en|fr|es|pt|de|yo|ha|ig)/i.test(x.language)).slice(0, 60)), () => setList([])); }, []);
  const cur = list.find((v) => v.identifier === value.name || v.name === value.name);
  const test = () => { Speech.stop(); Speech.speak(`Hi, I'm ${name}. This is how I sound on calls.`, { pitch: value.pitch, rate: value.rate, voice: cur?.identifier }); };
  return (
    <View>
      <Label s={9.5} c={k.ink60}>Voice</Label>
      <View style={{ marginTop: 6, borderRadius: 16, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 14 }}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Voice style" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {VOICE_PRESETS.map((p) => {
            const on = (value.preset || "natural") === p.id;
            return <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange({ ...value, preset: p.id, pitch: p.pitch, rate: p.rate })} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: on ? GRAPE : k.tint }}><T f="bold" s={13} c={on ? "#fff" : k.ink75}>{p.label}</T></Pressable>;
          })}
        </View>
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable accessibilityLabel="Device voice" onPress={() => setPick(true)} style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 20, backgroundColor: k.tint, paddingLeft: 16, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T f="semi" s={13.5} lines={1} style={{ flex: 1 }}>{cur ? `${cur.name} · ${cur.language}` : "Device default voice"}</T><Icon name="right" size={14} color={k.ink60} />
          </Pressable>
          <Pressable onPress={test} style={{ height: 40, borderRadius: 20, backgroundColor: k.tint, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="play" size={13} color={k.brandInk} /><T f="bold" s={13} c={k.brandInk}>Test</T></Pressable>
        </View>
        <T s={12} c={k.ink45} style={{ marginTop: 8 }}>{`${list.length ? `${list.length} voices on this device.` : "Uses your device's voices."} Pitch ${value.pitch.toFixed(2)} · speed ${value.rate.toFixed(2)}`}</T>
      </View>
      <WSheet open={pick} title="Device voice" onClose={() => setPick(false)}>
        {[{ identifier: "", name: "Device default voice", language: "" }, ...list].map((v) => {
          const on = (value.name || "") === v.identifier;
          return (
            <Pressable key={v.identifier || "default"} onPress={() => { onChange({ ...value, name: v.identifier }); setPick(false); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: k.line }}>
              <T f="semi" s={15} lines={1} style={{ flex: 1 }}>{v.language ? `${v.name} · ${v.language}` : v.name}</T>{on ? <Icon name="check" size={16} color={k.brandInk} /> : null}
            </Pressable>
          );
        })}
      </WSheet>
    </View>
  );
}
