/**
 * Native Create an agent: port of webapp/components/agent/AddAgentDialog.tsx Create (Basics, Look, Personality),
 * then SetupSequence and MintFinish. Saves with the same call as the web's createAgent: POST /api/agents (kind "custom").
 */
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import AgentFace from "@/components/AgentFace";
import FaceCreator from "@/components/FaceCreator";
import SetupSequence from "@/components/SetupSequence";
import MintFinish from "@/components/MintFinish";
import Icon from "@/components/Icon";
import { agentIdNo, type IdInfo } from "@/components/AgentIdCard";
import { AGENT_TEMPLATES, Area, Field, SkillPicker, TonePicker, cleanAgentName, skillLabel, useFieldStyle, type AgentTone } from "@/components/AgentFields";
import type { FaceLook } from "@/components/avatar";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { useData, youName } from "@/web/data";
import { Btn, GRAPE, Label, T, WToggle, useC } from "@/web/kit";

const STEPS = ["Basics", "Look", "Personality"];
type Look = FaceLook;
/** webapp fields.tsx variant(): older looks get the robot antenna; blush off unless picked. */
const variant = (l: Partial<Look>): Look => ({ ...(l as Look), extra: l.extra ?? (l.shape === "robot" ? "antenna" : "none"), blush: l.blush ?? false });
const newId = () => `c-${Crypto.randomUUID().replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 10)}`;

export default function CreateAgent() {
  const k = useC();
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const { me, reload } = useData();
  const field = useFieldStyle();
  const [step, setStep] = useState(0);
  const [tpl, setTpl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [about, setAbout] = useState("");
  const [look, setLook] = useState<Partial<Look>>({ shape: "blob", color: "purple", eyes: "happy", mouth: "smile" });
  const [tone, setTone] = useState<AgentTone>("warm");
  const [skills, setSkills] = useState<string[]>(["web", "files"]);
  const [memory, setMemory] = useState(true);
  const [phase, setPhase] = useState<"form" | "setup" | "done">("form");
  const [made, setMade] = useState<{ id: string; at: number } | null>(null);
  const [err, setErr] = useState("");
  const nameOk = name.trim().length > 0;
  const v = variant(look);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/agents"));

  const applyTpl = (id: string | null) => {
    setTpl(id);
    const t = AGENT_TEMPLATES.find((x) => x.id === id);
    if (!t) { setRole(""); setAbout(""); setSkills([]); return; }
    setRole(t.role); setAbout(t.about); setSkills([...t.skills]); setLook((l) => ({ ...l, shape: t.shape, color: t.color }));
  };

  // the web saves while SetupSequence plays; here the sequence waits for the save so a refused seat never shows a fake success
  const [saved, setSaved] = useState<Promise<void> | null>(null);
  const make = () => {
    if (!nameOk || phase !== "form" || !token) return;
    setErr("");
    const id = newId(), at = Date.now();
    const look = { template: tpl, shape: v.shape, color: v.color, eyes: v.eyes, mouth: v.mouth, extra: v.extra, blush: v.blush, brows: v.brows, orbit: v.orbit, dots: v.dots, bg: v.bg };
    const body = { slug: id, kind: "custom", name: name.trim().slice(0, 40), role: (role.trim() || "Custom agent").slice(0, 80), tone, about: about.trim().slice(0, 2000), skills: skills.slice(0, 20), memoryOn: memory, look };
    setMade({ id, at });
    setSaved(api("/api/agents", { method: "POST", body: JSON.stringify(body) }, token).then(() => reload()));
    setPhase("setup");
  };
  const ready = async () => {
    try { await saved; setPhase("done"); }
    catch (e) { setErr(e instanceof Error && e.message ? e.message : "Could not create your agent. Try again."); setMade(null); setPhase("form"); }
  };
  const open = () => { if (made) router.replace(`/chat/${made.id}`); else close(); };

  const info: IdInfo | null = useMemo(() => made ? {
    id: made.id, name: name.trim(), role: role.trim() || "Custom agent", idNo: agentIdNo(made.id), desk: (() => { const i = me?.agents.findIndex((a) => a.slug === made.id) ?? -1; return i >= 0 ? i + 1 : (me?.agents.length ?? 0) + 1; })(),
    born: made.at, maker: youName(me), kind: "Custom", chips: skills.length ? skills.map(skillLabel) : ["Made by you"], memory, look: v, bg: v.bg,
  } : null, [made, name, role, me, skills, memory, v]);

  if (phase !== "form") return (
    <View style={{ flex: 1, backgroundColor: k.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 28 }}>
        {phase === "setup" ? <SetupSequence name={name.trim()} v={v} bg={v.bg} onDone={() => void ready()} />
          : info ? <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 14 }}>
              <MintFinish info={info} title={`Say hi to ${name.trim()}.`} sub="Its computer is on and its memory is ready. Mint its ID card on chain now, or do it later from its profile." later={open} laterLabel="Later, open chat" />
            </View> : null}
      </ScrollView>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: k.card, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 16 }}>
        <Pressable accessibilityLabel="Back" onPress={() => (step > 0 ? setStep(step - 1) : close())} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}><Icon name="back" size={19} color={k.ink75} /></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T f="display" s={30} style={{ letterSpacing: -1.2, lineHeight: 32 }}>Create an agent.</T>
          <T s={14} c={k.ink60} style={{ marginTop: 6 }}>Give it a name, a job and a face. It gets its own computer and memory.</T>
        </View>
        <Pressable accessibilityLabel="Close" onPress={close} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={19} color={k.ink75} /></Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}>
        <View accessibilityLabel="Steps" style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
          {STEPS.map((l, i) => (
            <View key={l} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: i === step }} accessibilityLabel={`Step ${i + 1}, ${l}`} onPress={() => (i < step || nameOk) && setStep(i)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: i < step ? GRAPE : i === step ? k.ink : k.tint }}>
                  {i < step ? <Icon name="check" size={14} stroke={3} color="#fff" /> : <T f="bold" s={12.5} c={i === step ? k.bg : k.ink45}>{String(i + 1)}</T>}
                </View>
                <T f="bold" s={13} c={i === step ? k.ink : i < step ? k.brandInk : k.ink45}>{l}</T>
              </Pressable>
              {i < STEPS.length - 1 ? <View style={{ height: 2, flex: 1, borderRadius: 1, backgroundColor: i < step ? GRAPE : k.line }} /> : null}
            </View>
          ))}
        </View>

        {step === 0 ? (
          <View style={{ gap: 20 }}>
            <View>
              <Label s={9.5} c={k.ink60}>Start from a role, or blank</Label>
              <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: tpl === null }} onPress={() => applyTpl(null)} style={{ height: 40, borderRadius: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: tpl === null ? k.ink : "transparent", borderWidth: tpl === null ? 0 : 1, borderColor: k.line }}>
                  <Icon name="plus" size={15} color={tpl === null ? k.bg : k.ink75} /><T f="bold" s={14} c={tpl === null ? k.bg : k.ink75}>Blank</T>
                </Pressable>
                {AGENT_TEMPLATES.map((t) => { const on = tpl === t.id; return (
                  <Pressable key={t.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => applyTpl(t.id)} style={{ height: 40, borderRadius: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: on ? GRAPE : "transparent", borderWidth: on ? 0 : 1, borderColor: k.line }}>
                    <Icon name={t.icon} size={15} color={on ? "#fff" : k.ink75} /><T f="bold" s={14} c={on ? "#fff" : k.ink75}>{t.label}</T>
                  </Pressable>
                ); })}
              </View>
            </View>
            <Field label="Name" hint={`${name.length}/16`}><TextInput accessibilityLabel="Name" autoFocus value={name} onChangeText={(t) => setName(cleanAgentName(t))} onSubmitEditing={() => nameOk && setStep(1)} placeholder="Nova" placeholderTextColor={k.ink45} style={field} /></Field>
            <Field label="Role"><TextInput accessibilityLabel="Role" value={role} onChangeText={(t) => setRole(t.slice(0, 28))} placeholder="Research, writing, planning…" placeholderTextColor={k.ink45} style={field} /></Field>
            <Field label="What should it do?" hint="Instructions it always follows"><Area label="What should it do?" value={about} onChangeText={(t) => setAbout(t.slice(0, 400))} placeholder="Every Monday, read my inbox and tell me the three things that need me. Keep it short." /></Field>
          </View>
        ) : step === 1 ? (
          <FaceCreator value={v} onChange={(f) => setLook(f)} name={name.trim() || undefined} />
        ) : (
          <View style={{ gap: 20 }}>
            <Field label="Personality"><TonePicker tone={tone} onChange={setTone} /></Field>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: k.tint, padding: 14 }}>
              <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={14}>Memory</T><T s={12.5} c={k.ink60}>Remembers what you tell it, in its own brain.</T></View>
              <WToggle on={memory} onChange={setMemory} label="Memory" />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: k.line }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: k.faceTile, alignItems: "center", justifyContent: "center" }}><AgentFace variant={v} size={40} /></View>
              <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={15} lines={1}>{name.trim() || "Your new agent"}</T><T s={12.5} c={k.ink60} lines={1}>{`${role.trim() || "Custom agent"} · joins your strip`}</T></View>
            </View>
            <View><Label s={9.5} c={k.ink60}>Skills · optional</Label><View style={{ marginTop: 6 }}><SkillPicker skills={skills} onChange={setSkills} /></View></View>
          </View>
        )}
        {err ? <T s={13} c="#e5484d" style={{ marginTop: 14 }}>{err}</T> : null}
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(14, insets.bottom), borderTopWidth: 1, borderTopColor: k.line, backgroundColor: k.card }}>
        {step > 0 ? <Btn kind="line" h={40} fs={14} label="Back" onPress={() => setStep(step - 1)} /> : null}
        <T s={12.5} c={k.ink45} style={{ flex: 1 }} lines={2}>{`${me?.plan.name ?? "Free"} plan · agents you make don't take a desk`}</T>
        {step < 2
          ? <Btn kind="brand" h={40} fs={14} label="Next" disabled={!nameOk} style={{ opacity: nameOk ? 1 : 0.4 }} onPress={() => nameOk && setStep(step + 1)} />
          : <Btn kind="brand" h={40} fs={14} icon="spark" label={`Create ${name.trim() || "agent"}`} disabled={!token} onPress={make} />}
      </View>
    </KeyboardAvoidingView>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
