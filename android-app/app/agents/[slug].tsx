/**
 * The phone agent page: port of webapp/components/agent/AgentPanel.tsx. The ID card with Flip card / Open chat,
 * then an About / Edit (Your notes for hired agents) tab. Edits save with the same calls as the web:
 * POST /api/agents (home and agents you made), PATCH /api/agents/:slug (nickname, notes, memory, voice),
 * PATCH /api/me (your agent's memory switch) and DELETE /api/agents/:slug (delete or release).
 */
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AgentIdCard, { agentIdNo, fmtDate, type IdInfo } from "@/components/AgentIdCard";
import AgentFace from "@/components/AgentFace";
import FaceCreator from "@/components/FaceCreator";
import Icon from "@/components/Icon";
import { OnchainCard } from "@/components/MintFinish";
import BudgetRow from "@/components/BudgetRow";
import AgentMoney from "@/components/AgentMoney";
import MinerRow from "@/components/MinerRow";
import { Area, Field, SkillPicker, TonePicker, VoicePicker, cleanAgentName, skillLabel, skillSlots, toneLabel, useFieldStyle, voiceOf, type AgentTone, type AgentVoice } from "@/components/AgentFields";
import { lookVariant, type FaceLook } from "@/components/avatar";
import { specialist, storeMeta } from "@/content/roster";
import { api } from "@/lib/api";
import { toast } from "@/web/anim";
import { AgentModelRow } from "@/web/ModelSheet";
import { MailSheet } from "@/web/MailTasks";
import { AgentTile, Btn, GRAPE, Label, T, WToggle, useC } from "@/web/kit";
import { useSession } from "@/state/session";
import { useData, youName, type Agent } from "@/web/data";
import TempoCard from "@/components/TempoCard";
import UnifiedBalance from "@/components/UnifiedBalance";

type Kind = "home" | "custom" | "hired";
type Meta = { nick?: string; notes?: string; you?: string; voice?: Partial<AgentVoice> | null };
const HOME_CHIPS = ["Own computer", "Lasting memory", "Can hire help"];
/** webapp fields.tsx variant() for agents you made. */
const customLook = (look: unknown, tone?: string): FaceLook => {
  const l = (look && typeof look === "object" ? look : {}) as Partial<FaceLook>;
  return { ...lookVariant({ shape: "round", color: "purple", eyes: "dot", mouth: "smile", ...l }), extra: l.extra ?? (l.shape === "robot" ? "antenna" : "none"), blush: l.blush ?? (tone === "warm" || tone === "playful") };
};

export default function AgentPage() {
  const { slug = "" } = useLocalSearchParams<{ slug: string }>();
  const k = useC();
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const { me } = useData();
  const agent = me?.agents.find((a) => a.slug === slug);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/agents"));

  return (
    <View style={{ flex: 1, backgroundColor: k.alt, paddingTop: insets.top }}>
      {!token ? (
        <><Header slug={slug} agent={undefined} close={close} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <T f="bold" s={18}>Sign in to see this card</T>
          <Pressable onPress={() => router.replace("/(auth)/sign-in")} style={{ marginTop: 14 }}><T f="bold" s={15} c={GRAPE}>Sign in</T></Pressable>
        </View></>
      ) : !me ? (
        <><Header slug={slug} agent={undefined} close={close} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><T s={14} c={k.ink60}>Loading the card…</T></View></>
      ) : !agent ? (
        <><Header slug={slug} agent={undefined} close={close} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <T f="bold" s={18}>This agent isn't on your team</T>
          <T s={14} c={k.ink60} style={{ marginTop: 8, textAlign: "center" }}>Hire them from the marketplace, or open an agent you already have.</T>
        </View></>
      ) : <Panel key={slug} slug={slug} agent={agent} close={close} />}
    </View>
  );
}

function Header({ slug, agent, close, info }: { slug: string; agent?: Agent; close: () => void; info?: IdInfo }) {
  const k = useC();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: k.line }}>
      {agent ? <AgentTile slug={slug} look={agent.look} size={36} radius={12} dot={false} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T f="bold" s={16} lines={1}>{info?.name ?? "Agent"}</T>
        {info ? <T s={12.5} c={k.ink60} lines={1}>{info.kind === "Personal" ? "Your personal agent" : info.kind === "Custom" ? "Made by you" : `Hired · by ${info.maker}`}</T> : null}
      </View>
      {agent ? <Pressable onPress={() => router.push(`/chat/${slug}`)} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: GRAPE, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="chat" size={15} color="#fff" /><T f="bold" s={13.5} c="#fff">Chat</T>
      </Pressable> : null}
      <Pressable accessibilityLabel="Close" onPress={close} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
        <Icon name="x" size={19} color={k.ink75} />
      </Pressable>
    </View>
  );
}

function Panel({ slug, agent, close }: { slug: string; agent: Agent; close: () => void }) {
  const k = useC();
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const { me, hub, reload } = useData();
  const field = useFieldStyle();
  const kind: Kind = slug === "home" || agent.kind === "home" ? "home" : agent.kind === "custom" ? "custom" : "hired";
  const sp = specialist(slug);
  const meta = (agent.meta ?? {}) as Meta;
  const level = hub?.levels?.find((l) => l.slug === slug)?.level ?? 1;
  const memoryNow = kind === "home" ? me?.prefs?.memory !== false : agent.memoryOn !== false;

  // web idInfo()
  const info: IdInfo = useMemo(() => {
    const desk = Math.max(1, (me?.agents.findIndex((a) => a.slug === slug) ?? 0) + 1);
    const base = { id: slug, idNo: agentIdNo(slug), desk, born: agent.createdAt || Date.now(), level };
    if (kind === "home") return { ...base, name: agent.name, role: "Personal agent", maker: youName(me), kind: "Personal", look: agent.look as IdInfo["look"], bg: agent.look && typeof agent.look === "object" ? (agent.look as { bg?: string }).bg : undefined, memory: memoryNow, chips: agent.skills?.length ? agent.skills.map(skillLabel) : HOME_CHIPS };
    if (kind === "custom") { const v = customLook(agent.look, agent.tone); return { ...base, name: agent.name, role: agent.role || "Custom agent", maker: youName(me), kind: "Custom", look: v, bg: v.bg, memory: memoryNow, chips: agent.skills?.length ? agent.skills.map(skillLabel) : ["Made by you"] }; }
    return { ...base, name: (typeof meta.nick === "string" && meta.nick) || agent.name || sp?.name || "Agent", role: sp?.job ?? "Specialist", maker: sp ? storeMeta(sp).maker : "Maker", kind: "Hired", look: null, memory: memoryNow, chips: sp?.tools ?? [] };
  }, [agent, kind, level, me, memoryNow, meta.nick, slug, sp]);

  const [tab, setTab] = useState<"about" | "edit">("about");
  const [flipped, setFlipped] = useState(false);
  /* edit drafts, as the web */
  const [name, setName] = useState(agent.name ?? "");
  const [role, setRole] = useState(agent.role ?? "");
  const [about, setAbout] = useState(agent.about ?? "");
  const [tone, setTone] = useState<AgentTone>(((agent.tone as AgentTone) || (kind === "home" ? "short" : "warm")));
  const [skills, setSkills] = useState<string[]>(kind === "home" ? (agent.skills?.length ? agent.skills : ["web", "files", "code", "calendar"]) : agent.skills ?? []);
  const [d0Skills] = useState(() => (kind === "home" ? agent.skills?.length || 4 : agent.skills?.length ?? 0));
  const [memory, setMemory] = useState(memoryNow);
  const [lookHome, setLookHome] = useState<FaceLook>(() => lookVariant(agent.look as never));
  const [look, setLook] = useState<FaceLook>(() => customLook(agent.look, agent.tone));
  const [nick, setNick] = useState(meta.nick ?? "");
  const [notes, setNotes] = useState(meta.notes ?? "");
  const [voice, setVoice] = useState<AgentVoice>(() => voiceOf(slug, meta.voice));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState<{ on: boolean; unread: number; test: boolean }>({ on: false, unread: 0, test: false });
  const [mailOpen, setMailOpen] = useState(false);
  useEffect(() => {
    if (!token || kind === "hired") return;
    api<{ mode?: string; unread?: number; box?: { unread?: number } }>(`/api/email/${encodeURIComponent(slug)}`, {}, token)
      .then((r) => setMail({ on: !!r.mode && r.mode !== "off", unread: r.unread ?? r.box?.unread ?? 0, test: r.mode === "mock" }), () => {});
  }, [token, slug, kind]);

  const save = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      if (kind === "home") {
        await api("/api/agents", { method: "POST", body: JSON.stringify({ slug: "home", kind: "home", name: (name.trim() || agent.name || "Juniper").slice(0, 40), role: agent.role ?? "", tone, about: about.trim().slice(0, 2000), skills, memoryOn: agent.memoryOn !== false, look: lookHome, meta: { you: meta.you ?? "" } }) }, token);
        await api("/api/me", { method: "PATCH", body: JSON.stringify({ prefs: { memory } }) }, token);
      } else if (kind === "custom") {
        const prev = (agent.look && typeof agent.look === "object" ? agent.look : {}) as { template?: string | null };
        await api("/api/agents", { method: "POST", body: JSON.stringify({ slug, kind: "custom", name: (name.trim() || agent.name).slice(0, 40), role: role.trim().slice(0, 80), tone, about: about.trim().slice(0, 2000), skills: skills.slice(0, 20), memoryOn: memory,
          look: { template: prev.template ?? null, shape: look.shape, color: look.color, eyes: look.eyes, mouth: look.mouth, extra: look.extra, blush: look.blush, brows: look.brows, orbit: look.orbit, dots: look.dots, bg: look.bg } }) }, token);
      } else {
        await api(`/api/agents/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify({ nick: nick.trim().slice(0, 40), notes: notes.trim().slice(0, 2000), memoryOn: memory }) }, token);
      }
      await api(`/api/agents/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify({ voice }) }, token);
      await reload();
      toast(`Saved. ${kind === "hired" ? nick.trim() || sp?.name || info.name : name.trim() || info.name} is up to date.`);
      setTab("about");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "That didn't save. Try again.");
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await api(`/api/agents/${encodeURIComponent(slug)}`, { method: "DELETE" }, token);
      toast(kind === "custom" ? `${info.name} was deleted` : `${info.name} left seat ${String(info.desk).padStart(2, "0")}`);
      await reload();
      router.replace("/(tabs)/agents");
    } catch (e) { toast(e instanceof Error && e.message ? e.message : "That didn't work. Try again."); setBusy(false); }
  };
  const chat = () => router.push(`/chat/${slug}`);

  // what the card shows while you edit (web preview)
  const preview: IdInfo = tab === "edit" && kind !== "hired"
    ? { ...info, name: name.trim() || info.name, role: kind === "custom" ? role.trim() || "Custom agent" : info.role, look: kind === "home" ? lookHome : look, bg: kind === "home" ? lookHome.bg : look.bg, memory, chips: skills.length ? skills.map(skillLabel) : info.chips }
    : tab === "edit" && kind === "hired" ? { ...info, name: nick.trim() || sp?.name || info.name, memory } : info;
  const faceEl = tab === "edit" && kind === "custom" ? <AgentFace variant={look} size={96} animated /> : undefined;
  const what = kind === "home" ? agent.about || `${info.name} is yours: it has its own computer, remembers what you tell it and can hire help.` : kind === "custom" ? agent.about || "No instructions yet. Add some in Edit." : sp?.back ?? "";
  const facts: [string, string][] = [["ID number", info.idNo], ["Desk", String(info.desk).padStart(2, "0")], ["Born", fmtDate(info.born)], ["Personality", toneLabel(agent.tone) ?? (sp ? "Set by maker" : "-")], [info.kind === "Hired" ? "Maker" : "Owner", info.maker], ["Memory", info.memory ? "On" : "Off"]];
  const canDo = kind === "hired" ? (sp?.skills ?? []).map((x) => x[0]) : info.chips;
  const card = { borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line } as const;
  const tabBtn = (t: "about" | "edit", label: string) => (
    <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={{ flex: 1, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tab === t ? k.card : "transparent", borderWidth: tab === t ? 1 : 0, borderColor: k.line }}>
      <T f="bold" s={14} c={tab === t ? k.ink : k.ink60}>{label}</T>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Header slug={slug} agent={agent} close={close} info={info} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <View style={{ alignItems: "center", paddingTop: 4, paddingBottom: 20, paddingHorizontal: 16 }}>
          <View style={tab === "edit" ? { transform: [{ scale: 0.8 }], marginBottom: -78, transformOrigin: "50% 0%" } : undefined}>
            <AgentIdCard info={preview} flipped={flipped} onFlip={setFlipped} faceEl={faceEl} />
          </View>
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Pressable onPress={() => setFlipped(!flipped)} style={{ height: 32, borderRadius: 16, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: k.card, borderWidth: 1, borderColor: k.line }}><Icon name="flip" size={14} color={k.ink} /><T f="bold" s={12.5}>Flip card</T></Pressable>
            {tab !== "edit" ? <Pressable onPress={chat} style={{ height: 32, borderRadius: 16, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: GRAPE }}><Icon name="chat" size={14} color="#fff" /><T f="bold" s={12.5} c="#fff">Open chat</T></Pressable> : null}
            <T s={12} c={k.ink45}>{tab === "edit" ? "Live preview" : "or tap the card"}</T>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4, borderRadius: 999, backgroundColor: k.tint, padding: 4 }}>{tabBtn("about", "About")}{tabBtn("edit", kind === "hired" ? "Your notes" : "Edit")}</View>

          {tab === "about" ? (
            <View style={{ marginTop: 16, gap: 16 }}>
              <View style={[card, { padding: 16 }]}>
                <Label s={9.5} c={k.ink45}>What it does</Label>
                <T s={14.5} c={k.dark ? "rgba(255,255,255,0.85)" : "rgba(10,10,10,0.85)"} style={{ marginTop: 6, lineHeight: 20 }}>{what}</T>
                {meta.notes ? <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: k.tint, padding: 12 }}><T s={13.5} c={k.ink75}><T f="bold" s={13.5}>Your note:</T>{` ${meta.notes}`}</T></View> : null}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {facts.map(([a, b]) => (
                  <View key={a} style={{ width: "48.5%", flexGrow: 1, borderRadius: 16, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 12 }}>
                    <Label s={8.5} c={k.dark ? "rgba(255,255,255,0.5)" : "rgba(10,10,10,0.5)"}>{a}</Label>
                    <T f="bold" s={14} lines={1} style={{ marginTop: 2 }}>{b}</T>
                  </View>
                ))}
              </View>
              {canDo.length ? (
                <View style={[card, { padding: 16 }]}>
                  <Label s={9.5} c={k.ink45}>{kind === "hired" ? "Skills" : "Can do"}</Label>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {canDo.map((c) => <View key={c} style={{ borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 12, paddingVertical: 6 }}><T f="semi" s={13} c={k.dark ? "rgba(255,255,255,0.8)" : "rgba(10,10,10,0.8)"}>{c}</T></View>)}
                  </View>
                </View>
              ) : null}
              <AgentModelRow agent={slug} name={info.name} />
              {mail.on ? (
                <Pressable accessibilityRole="button" onPress={() => setMailOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: k.card, padding: 14, borderWidth: 1, borderColor: k.line }}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="mail" size={17} color="#fff" /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><T f="bold" s={14}>Email</T>{mail.unread > 0 ? <View style={{ borderRadius: 999, backgroundColor: GRAPE, paddingHorizontal: 6, paddingVertical: 2 }}><T f="bold" s={10} c="#fff">{`${mail.unread} new`}</T></View> : null}{mail.test ? <View style={{ borderRadius: 999, backgroundColor: "#fff4d6", paddingHorizontal: 6, paddingVertical: 2 }}><Label s={8} c="#8a5a00">Test</Label></View> : null}</View>
                    <T s={12.5} c={k.ink60}>{`${info.name}'s own inbox, forwarding and drafts you approve.`}</T>
                  </View>
                  <Icon name="right" size={16} color={k.ink45} />
                </Pressable>
              ) : null}
              {slug === "ore" ? <MinerRow /> : null}
              {kind !== "hired" ? <UnifiedBalance slug={slug} name={info.name} token={token} /> : null}
              <BudgetRow agent={slug} name={info.name} token={token} />
              {kind !== "hired" ? <TempoCard slug={slug} name={info.name} token={token} /> : null}
              <AgentMoney slug={slug} name={info.name} created={kind !== "hired"} look={kind === "home" ? agent.look : undefined} />
              {kind !== "hired" ? <OnchainCard id={slug} name={info.name} /> : null}
              <Pressable onPress={() => setTab("edit")} style={{ height: 48, borderRadius: 16, backgroundColor: k.tint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="edit" size={15} color={k.brandInk} /><T f="bold" s={14} c={k.brandInk}>{kind === "hired" ? "Add a nickname or notes" : `Edit ${info.name}`}</T></Pressable>
            </View>
          ) : (
            <View style={{ marginTop: 16, gap: 20 }}>
              {kind === "hired" ? (
                <>
                  <View style={{ flexDirection: "row", gap: 10, borderRadius: 16, backgroundColor: k.tint, padding: 14 }}><Icon name="info" size={17} color={k.brandInk} /><T s={13.5} c={k.ink75} style={{ flex: 1, lineHeight: 19 }}>{`${sp?.name ?? info.name} is made by `}<T f="bold" s={13.5}>{info.maker}</T>. The maker controls its name, look, skills and instructions. You can add a nickname and private notes.</T></View>
                  <Field label="Nickname" hint="Only you see it"><TextInput accessibilityLabel="Nickname" value={nick} onChangeText={(t) => setNick(t.slice(0, 16))} placeholder={sp?.name} placeholderTextColor={k.ink45} style={field} /></Field>
                  <Field label="Notes"><Area label="Notes" value={notes} onChangeText={(t) => setNotes(t.slice(0, 300))} placeholder="Prefers short briefs. Ask for sources." /></Field>
                </>
              ) : (
                <>
                  <Field label="Name"><TextInput accessibilityLabel="Name" value={name} onChangeText={(t) => setName(cleanAgentName(t))} placeholderTextColor={k.ink45} style={field} /></Field>
                  {kind === "custom" ? <Field label="Role"><TextInput accessibilityLabel="Role" value={role} onChangeText={(t) => setRole(t.slice(0, 28))} placeholder="Custom agent" placeholderTextColor={k.ink45} style={field} /></Field> : null}
                  <View><Label s={9.5} c={k.ink60}>Face</Label><View style={{ marginTop: 6 }}>{kind === "home" ? <FaceCreator value={lookHome} onChange={setLookHome} name={name.trim() || info.name} /> : <FaceCreator value={look} onChange={setLook} name={name.trim() || info.name} />}</View></View>
                  <Field label="Instructions" hint="What it should always do"><Area label="Instructions" value={about} onChangeText={(t) => setAbout(t.slice(0, 400))} placeholder="Keep answers short. Always link sources." /></Field>
                  <Field label="Personality"><TonePicker tone={tone} onChange={setTone} /></Field>
                  <View><Label s={9.5} c={k.ink60}>Skills</Label><View style={{ marginTop: 6 }}><SkillPicker skills={skills} onChange={setSkills} max={Math.max(skillSlots(level), d0Skills)} /></View></View>
                </>
              )}
              <VoicePicker value={voice} onChange={setVoice} name={kind === "hired" ? nick.trim() || sp?.name || info.name : name.trim() || info.name} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: k.card, padding: 14, borderWidth: 1, borderColor: k.line }}>
                <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={14}>Memory</T><T s={12.5} c={k.ink60}>{memory ? "Remembers what you tell it." : "Starts fresh every chat."}</T></View>
                <WToggle on={memory} onChange={setMemory} label="Memory" />
              </View>
              <View style={{ flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: k.line, paddingTop: 12 }}>
                <Btn kind="line" h={40} fs={14} label="Cancel" onPress={() => setTab("about")} />
                <Btn kind="brand" h={40} fs={14} icon="check" label={busy ? "Saving…" : "Save changes"} disabled={busy} style={{ flex: 1 }} full onPress={() => void save()} />
              </View>
              {kind !== "home" ? (
                <View style={{ borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(244,91,91,0.35)" }}>
                  {confirm ? (
                    <View>
                      <T f="bold" s={14}>{kind === "custom" ? `Delete ${info.name}?` : `Release ${info.name}?`}</T>
                      <T s={13} c={k.ink60} style={{ marginTop: 2 }}>{kind === "custom" ? "Its chat, wallet and card go too. This can't be undone." : "It leaves its seat. You can hire it again from the marketplace."}</T>
                      <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                        <Btn kind="line" h={40} fs={14} label="Keep" onPress={() => setConfirm(false)} />
                        <Pressable disabled={busy} onPress={() => void remove()} style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: "#e5484d", alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}><T f="bold" s={14} c="#fff">{kind === "custom" ? "Delete agent" : "Release seat"}</T></Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable onPress={() => setConfirm(true)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="trash" size={16} color="#e5484d" /><T f="bold" s={14} c="#e5484d">{kind === "custom" ? "Delete agent" : "Release from seat"}</T></Pressable>
                  )}
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
      {mail.on ? <MailSheet open={mailOpen} onClose={() => setMailOpen(false)} agent={slug} name={info.name} onAsk={() => { setMailOpen(false); chat(); }} onUnread={(n) => setMail((m) => ({ ...m, unread: n }))} /> : null}
    </KeyboardAvoidingView>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
