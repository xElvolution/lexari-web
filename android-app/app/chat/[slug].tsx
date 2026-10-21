/** One conversation, ported from the web phone chat (ChatPanel + Composer): header with ID card, tasks, inbox and model
 * chip; the thread with day labels, avatars that think/talk/smile on the newest bubble, receipts and every chat card;
 * paste guard; composer with desktop, attach, voice note, call and send. Same words and sizes as app.lexari.ai at 390px. */
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import Icon from "@/components/Icon";
import { TourTarget } from "@/components/Tour";
import { ModelSheet } from "@/web/ModelSheet";
import { MailSheet, TasksSheet } from "@/web/MailTasks";
import { api, ApiError, msgId, streamChat, type ChatEvent } from "@/lib/api";
import { chatTurnBody } from "@/lib/chatTurn";
import { cutSecrets, findSecrets, isBlockedKind, SECRET_NAME_RE, toSecretName } from "@/lib/secretScan";
import { useSession } from "@/state/session";
import { useData, nameOf, withHello } from "@/web/data";
import { AgentTile, F, GRAPE, Label, T, ringOf, useC } from "@/web/kit";
import Svg, { Path } from "react-native-svg";
import { ActionCardView, EmailCardView, FileCards, MeetCard, SecretCardView, SendCard, Shots, TakeoverCardView, TaskCard, TxReceipt,
  type ActionCard, type CardFile, type EmailCard, type MeetAsk, type SecretCard, type SendAsk, type TaskRef, type TaskView, type Tx } from "@/web/chat/cards";
import { specialist } from "@/content/roster";

type M = { id: string; from: string; text?: string; at: number; call?: number; voice?: number; file?: { name: string; size?: number | string; id?: string }; files?: CardFile[];
  tx?: Tx; send?: SendAsk; meet?: MeetAsk; task?: TaskRef; secret?: SecretCard; takeover?: { reason: string }; action?: ActionCard; email?: EmailCard; shots?: number[]; re?: Record<string, string[]> };
type Mood = "idle" | "thinking" | "speaking" | "happy";

const SHORT: Record<string, string> = { lamina: "Lamina", "claude-sonnet": "Sonnet", "claude-opus": "Opus", grok: "Grok", "gemini-flash": "Gemini", "grok-fast": "Grok Fast", "grok-4.6": "Grok 4.6", kimi: "Kimi", qwen: "Qwen", zg: "0G" };
const SUGGEST = ["Compare three note-taking apps in a table", "Draft a short update email for my team"];
const fmtSecs = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
function dayLabel(ms: number, now: number) {
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 864e5);
  if (days <= 0) return "Today"; if (days === 1) return "Yesterday";
  return new Date(ms).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

/** The chat header's model chip: Lamina in a grape ring, any other model on ink. */
function ModelChip({ id, onPress }: { id: string; onPress: () => void }) {
  const k = useC(); const lamina = id === "lamina";
  return (
    <Pressable accessibilityLabel={`Model: ${SHORT[id] || id}. Change model`} onPress={onPress} style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingLeft: 4, paddingRight: 8, backgroundColor: lamina ? "rgba(91,43,255,0.10)" : k.ink, borderWidth: 1, borderColor: lamina ? "rgba(91,43,255,0.35)" : k.ink }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: lamina ? GRAPE : "#fff", alignItems: "center", justifyContent: "center" }}>{lamina ? <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M12 3.5 20.5 8 12 12.5 3.5 8z" fill="#fff" /><Path d="m3.5 12 8.5 4.5 8.5-4.5" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} /><Path d="m3.5 16 8.5 4.5 8.5-4.5" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} /></Svg> : <T f="bold" s={11} c="#000">{(SHORT[id] || id)[0]}</T>}</View>
      <T f="bold" s={13} c={lamina ? k.ink : k.bg} lines={1} style={{ maxWidth: 78 }}>{SHORT[id] || id}</T>
      <View style={{ transform: [{ rotate: "90deg" }] }}><Icon name="right" size={14} stroke={2.6} color={lamina ? k.ink : k.bg} /></View>
    </Pressable>
  );
}

function HeadBtn({ icon, label, onPress, badge, dot }: { icon: string; label: string; onPress: () => void; badge?: number; dot?: boolean }) {
  const k = useC();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={19} color={k.ink75} />
      {badge ? <View style={{ position: "absolute", right: 0, top: 0, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: k.bg }}><T f="bold" s={10} c="#fff">{badge > 9 ? "9+" : String(badge)}</T></View> : null}
      {dot ? <View style={{ position: "absolute", right: 6, top: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: GRAPE, borderWidth: 2, borderColor: k.bg }} /> : null}
    </Pressable>
  );
}

function VoiceNote({ secs, mine }: { secs: number; mine: boolean }) {
  const k = useC(); const [p, setP] = useState(-1);
  useEffect(() => {
    if (p < 0) return;
    if (p >= 1) { const t = setTimeout(() => setP(-1), 300); return () => clearTimeout(t); }
    const t = setTimeout(() => setP((x) => Math.min(1, x + 0.1 / secs)), 100); return () => clearTimeout(t);
  }, [p, secs]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 }}>
      <Pressable accessibilityLabel={p < 0 ? "Play voice note" : "Stop"} onPress={() => setP(p < 0 ? 0 : -1)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: mine ? "#fff" : GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name={p < 0 ? "play" : "pause"} size={15} color={mine ? GRAPE : "#fff"} /></Pressable>
      <View style={{ height: 28, flexDirection: "row", alignItems: "center", gap: 3 }}>{Array.from({ length: 26 }).map((_, i) => <View key={i} style={{ width: 3, borderRadius: 2, height: `${25 + ((i * 53) % 75)}%`, backgroundColor: p >= 0 && i / 26 <= p ? (mine ? "#fff" : k.brandInk) : mine ? "rgba(255,255,255,0.45)" : k.ink45 }} />)}</View>
      <T f="mono" s={12} c={mine ? "rgba(255,255,255,0.85)" : k.ink60}>{fmtSecs(p >= 0 ? secs * p : secs)}</T>
    </View>
  );
}

type Caught = { id: number; kind: string; label: string; service: string; name: string; value?: string; busy?: boolean; err?: string };
/** Paste protection, as on the web: keys are pulled out and offered "Save securely"; seeds and private keys are removed. */
function GuardPanel({ items, setItems, onSwap }: { items: Caught[]; setItems: (f: (c: Caught[]) => Caught[]) => void; onSwap: (id: number, put: string) => void }) {
  const k = useC(); const { token } = useSession();
  if (!items.length) return null;
  const patch = (id: number, p: Partial<Caught>) => setItems((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const drop = (id: number) => setItems((c) => c.filter((x) => x.id !== id));
  const save = async (it: Caught) => {
    const name = toSecretName(it.name);
    if (!SECRET_NAME_RE.test(name)) { patch(it.id, { err: "Use a name like OPENAI_API_KEY." }); return; }
    patch(it.id, { busy: true, err: "" });
    try { const r = await api<{ secret: { name: string } }>("/api/secrets", { method: "POST", body: JSON.stringify({ name, value: it.value, service: it.service || undefined, label: it.label.replace(/^an? /, "") }) }, token); onSwap(it.id, `(saved securely as ${r.secret.name})`); drop(it.id); }
    catch { patch(it.id, { busy: false, err: "It couldn't be saved." }); }
  };
  return (
    <View style={{ marginBottom: 8, borderRadius: 18, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, overflow: "hidden" }}>
      {items.map((it) => it.kind === "seed" || it.kind === "private" ? (
        <View key={it.id} style={{ flexDirection: "row", gap: 10, padding: 12, backgroundColor: "rgba(229,72,77,0.12)" }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#e5484d", alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={15} /></View>
          <View style={{ flex: 1 }}><T f="bold" s={13.5}>Removed {it.label}</T><T s={12.5} style={{ lineHeight: 17 }}>Never share it with anyone, agents included. Lexari will never ask for it, and it can't be saved or sent.</T></View>
          <Pressable accessibilityLabel="Got it" onPress={() => drop(it.id)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={14} color={k.ink60} /></Pressable>
        </View>
      ) : (
        <View key={it.id} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: k.line }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="key" size={15} /></View>
            <View style={{ flex: 1 }}><T f="bold" s={13.5} lines={1}>That looks like {it.label}</T><T s={12.5} c={k.ink75}>Keys never go in chat. Save it to your vault instead.</T></View>
          </View>
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TextInput value={it.name} onChangeText={(v) => patch(it.id, { name: toSecretName(v) || v.toUpperCase().slice(0, 64), err: "" })} accessibilityLabel="Save as" placeholder="NAME" autoCapitalize="characters" style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: k.tint, paddingHorizontal: 12, color: k.ink, fontFamily: "monospace", fontSize: 12.5 }} />
            <Pressable accessibilityLabel="Discard it" onPress={() => { onSwap(it.id, ""); drop(it.id); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={15} color={k.ink75} /></Pressable>
            <Pressable onPress={() => void save(it)} disabled={it.busy} style={{ height: 36, borderRadius: 18, backgroundColor: GRAPE, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, opacity: it.busy ? 0.5 : 1 }}><Icon name="lock" size={13} /><T f="bold" s={12.5} c="#fff">Save securely</T></Pressable>
          </View>
          {it.err ? <T s={12} c="#e5484d" style={{ marginTop: 6 }}>{it.err}</T> : null}
        </View>
      ))}
    </View>
  );
}

export default function Chat() {
  const { slug: id = "home", prompt } = useLocalSearchParams<{ slug: string; prompt?: string }>();
  const k = useC();
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const { me, reload } = useData();
  const agent = me?.agents.find((a) => a.slug === id);
  const chat = me?.chats.find((c) => c.slug === id);
  const group = chat?.kind === "group";
  const look = me?.agents.find((a) => a.slug === "home")?.look;
  const lookOf = (s: string) => me?.agents.find((a) => a.slug === s)?.look ?? (s === "home" ? look : undefined);
  const name = group ? chat?.title || "Group" : agent?.name || specialist(id)?.name || nameOf(me, id);
  const [local, setLocal] = useState<M[]>([]);
  const [patches, setPatches] = useState<Record<string, Partial<M>>>({});
  const msgs = useMemo(() => {
    const base = ((chat?.messages ?? []) as unknown as M[]);
    const ids = new Set(base.map((m) => m.id));
    return withHello(me, id, [...base, ...local.filter((m) => !ids.has(m.id))].map((m) => (patches[m.id] ? { ...m, ...patches[m.id] } : m)));
  }, [chat, local, patches, me, id]);
  const [mood, setMood] = useState<Mood>("idle");
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState(prompt || "");
  const [model, setModel] = useState("lamina");
  const [modelOpen, setModelOpen] = useState(false);
  const [panel, setPanel] = useState<"mail" | "tasks" | null>(null);
  const [unread, setUnread] = useState(0);
  const [mailOn, setMailOn] = useState(false);
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [caught, setCaught] = useState<Caught[]>([]);
  const [file, setFile] = useState<{ name: string; size: string; id?: string; uploading?: boolean } | null>(null);
  const [rec, setRec] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const now = Date.now();
  const scroll = useRef<ScrollView>(null);
  const nextCaught = useRef(1);
  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); }, [msgs.length, typing]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (rec === null) return; const t = setInterval(() => setRec((r) => (r === null ? r : r + 0.1)), 100); return () => clearInterval(t); }, [rec === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // live header state: the model that answers here, the agent's inbox, its tasks (own agents only)
  const taskAgent = !group && (id === "home" || !specialist(id)) ? id : null;
  useEffect(() => {
    if (!token) return;
    api<{ models?: { default?: string; agents?: Record<string, string>; chats?: Record<string, string> } }>("/api/billing", {}, token)
      .then((b) => setModel(b.models?.chats?.[id] || (!group ? b.models?.agents?.[id] : undefined) || b.models?.default || "lamina")).catch(() => {});
    if (!group) api<{ mode?: string; unread?: number; box?: { unread?: number } }>(`/api/email/${encodeURIComponent(id)}`, {}, token)
      .then((r) => { { const md = r.mode ?? (r.box as { mode?: string } | undefined)?.mode; setMailOn(!!md && md !== "off"); }; setUnread(r.unread ?? r.box?.unread ?? 0); }).catch(() => {});
    if (taskAgent) api<{ tasks: TaskView[] }>(`/api/tasks?agent=${encodeURIComponent(taskAgent)}`, {}, token).then((r) => setTasks(r.tasks || [])).catch(() => {});
  }, [token, id, group, taskAgent]);
  // The agent can switch its own model from chat (a confirmed self card reloads the account): the chip follows it.
  const agentRow = me?.agents.find((a) => a.slug === id);
  useEffect(() => {
    if (!token || !agentRow) return;
    api<{ models?: { default?: string; agents?: Record<string, string>; chats?: Record<string, string> } }>("/api/billing", {}, token)
      .then((b) => setModel(b.models?.chats?.[id] || (!group ? b.models?.agents?.[id] : undefined) || b.models?.default || "lamina")).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentRow?.name, agentRow?.model]);
  const taskMap = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const latest = new Map<string, number>();
  msgs.forEach((m, i) => { if (m.from !== "you" && m.from !== "system") latest.set(m.from, i); });
  const sp = specialist(id);
  const suggestions = msgs.filter((m) => m.from === "you").length > 1 ? [] : group ? ["What's still open for Friday?", "Everyone, one line on progress"] : id === "home" ? [...SUGGEST, "Remember that I work from Lagos"] : (sp as { examples?: string[] } | undefined)?.examples?.slice(0, 2) ?? [];
  const sub = typing ? "typing…" : group ? (chat?.members ?? []).map((m) => nameOf(me, m)).join(", ") : `${agent?.role || (id === "home" ? "Your personal agent" : "") || (sp as { role?: string } | undefined)?.role || "Agent"} · ${mood === "idle" ? "idle" : "active now"}`;
  const patch = (mid: string, p: Partial<M>) => setPatches((x) => ({ ...x, [mid]: { ...x[mid], ...p } }));
  const desk = () => router.push(`/desktop/${id}`);

  const catchIn = async (v: string) => {
    const found = await findSecrets(v);
    if (!found.length) return null;
    const add: Caught[] = [];
    const clean = cutSecrets(v, found, (f) => { const n = nextCaught.current++; add.push({ id: n, kind: f.kind, label: f.label, service: f.service, name: f.name, value: isBlockedKind(f.kind) ? undefined : f.value }); return isBlockedKind(f.kind) ? "" : `[secret ${n}]`; }).replace(/[ \t]{2,}/g, " ");
    setCaught((c) => [...c.filter((x) => !isBlockedKind(x.kind as never)), ...add]);
    return clean;
  };
  const onChange = (v: string) => {
    const big = v.length - text.length > 12; // a paste: secrets never land in the box
    setText(v.slice(0, 2000));
    if (big) void catchIn(v).then((clean) => { if (clean !== null) setText(clean); });
  };

  const send = async (raw?: string) => {
    const body = (raw ?? text).trim();
    if ((!body && !file) || !token || file?.uploading) return;
    if (body) { const clean = await catchIn(body); if (clean !== null) { setText(clean); return; } }
    if (caught.some((c) => !isBlockedKind(c.kind as never))) { setToast("Save or discard the key first. It never goes in the chat."); return; }
    const mine: M = { id: msgId(), from: "you", text: body, at: Date.now(), ...(file ? { file: { name: file.name, size: file.size, id: file.id } } : {}) };
    const replyId = msgId();
    const speaker = group ? (chat?.members[0] || "home") : id;
    setLocal((xs) => [...xs, mine, { id: replyId, from: speaker, text: "", at: Date.now() + 1 }]);
    setText(""); setFile(null); setTyping(true); setMood("thinking");
    try {
      await streamChat(chatTurnBody({ convo: id, speaker, text: body, file: mine.file, history: msgs, userMsgId: mine.id, replyMsgId: replyId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }), token, (ev: ChatEvent) => {
        const up = (f: (m: M) => M) => setLocal((xs) => xs.map((l) => (l.id === replyId ? f(l) : l)));
        if (ev.token) { setTyping(false); setMood("speaking"); up((l) => ({ ...l, text: (l.text || "") + ev.token })); }
        if (ev.replace !== undefined) up((l) => ({ ...l, text: ev.replace }));
        if (ev.send) up((l) => ({ ...l, send: ev.send as unknown as SendAsk }));
        if (ev.secret?.id) up((l) => ({ ...l, secret: ev.secret as unknown as SecretCard }));
        if (ev.takeover) up((l) => ({ ...l, takeover: { reason: ev.takeover?.reason || "" } }));
        if (ev.action) up((l) => ({ ...l, action: ev.action as unknown as ActionCard }));
        if (ev.shots) up((l) => ({ ...l, shots: ev.shots?.n }));
        const extra = ev as ChatEvent & { meet?: MeetAsk; task?: TaskRef; email?: EmailCard; files?: CardFile[] };
        if (extra.meet) up((l) => ({ ...l, meet: extra.meet })); if (extra.task) up((l) => ({ ...l, task: extra.task })); if (extra.email) up((l) => ({ ...l, email: extra.email })); if (extra.files) up((l) => ({ ...l, files: extra.files }));
        if (ev.error) setToast("Your agent hit a snag. Try again.");
        if (ev.done) { setTyping(false); setMood("happy"); setTimeout(() => setMood("idle"), 1800); }
      });
      reload().catch(() => {});
    } catch (e) {
      setTyping(false); setMood("idle"); setLocal((xs) => xs.filter((l) => l.id !== replyId || l.text));
      // The server's own words for a refused message (signed out, plan limit, rate limit, a key in the text), else the generic line.
      const said = e instanceof ApiError && e.status >= 400 && e.status < 500 && e.data ? e.message : "";
      setToast(said || "That message didn't send. Try again.");
    }
  };

  const attach = async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true }).catch(() => null);
    const a = r && !r.canceled ? r.assets[0] : null; if (!a || !token) return;
    const kb = a.size ? (a.size > 1e6 ? `${(a.size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(a.size / 1e3))} KB`) : "";
    setFile({ name: a.name, size: kb, uploading: true });
    try {
      const fd = new FormData(); fd.append("file", (a as unknown as { file?: Blob }).file ?? ({ uri: a.uri, name: a.name, type: a.mimeType || "application/octet-stream" } as unknown as Blob), a.name); fd.append("agent", id);
      const up = await api<{ file: { id: string } }>("/api/files", { method: "POST", body: fd }, token);
      setFile({ name: a.name, size: kb, id: up.file.id });
    } catch { setFile(null); setToast("That file didn't upload. Try again."); }
  };

  const ready = (!!text.trim() || !!file) && !file?.uploading;
  const iconBtn = { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" } as const;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: k.bg }}>
      <View style={{ paddingTop: insets.top, height: 54 + insets.top, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: k.line }}>
        <Pressable accessibilityLabel="Back to chats" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/agents"))} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Icon name="back" size={20} color={k.ink} /></Pressable>
        <Pressable onPress={() => !group && router.push(`/agents/${id}`)} style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AgentTile slug={id} look={lookOf(id)} size={40} ring={group ? null : ringOf(id, agent?.kind, me?.prefs?.defaultAgent || "home")} live={mood !== "idle"} mood={mood} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><T f="bold" s={15} lines={1} style={{ flexShrink: 1 }}>{name}</T>{!group ? <Icon name="idcard" size={15} color={k.ink45} /> : null}</View>
            <T s={12.5} c={typing ? k.brandInk : k.ink60} lines={1} style={typing ? { fontWeight: "600" } : undefined}>{sub}</T>
          </View>
        </Pressable>
        {taskAgent && tasks.length ? <HeadBtn icon="jobs" label={`${name}'s tasks`} dot={tasks.some((t) => t.status === "running" || t.status === "waiting")} onPress={() => setPanel("tasks")} /> : null}
        {!group && mailOn ? <HeadBtn icon="mail" label={`${name}'s email`} badge={unread} onPress={() => setPanel("mail")} /> : null}
        <ModelChip id={model} onPress={() => setModelOpen(true)} />
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingVertical: 16 }} keyboardShouldPersistTaps="handled">
        {msgs.length === 0 ? (
          <View style={{ margin: "auto", alignItems: "center", maxWidth: 320 }}>
            <AgentTile slug={id} look={lookOf(id)} size={96} dot={false} />
            <T f="display" s={22} style={{ marginTop: 20, textAlign: "center", letterSpacing: -1 }}>Say hi to {name}.</T>
            <T s={14.5} c={k.ink60} style={{ marginTop: 8, textAlign: "center", lineHeight: 21 }}>{group ? "Everyone in the group sees your messages. Name someone to ask them directly." : id === "home" ? "Ask for anything. Start with “remember…” and it files a memory in its brain." : (sp as { back?: string } | undefined)?.back || ""}</T>
          </View>
        ) : null}
        <View style={{ marginTop: "auto", gap: 8 }}>
          {msgs.map((m, i) => {
            const prev = msgs[i - 1], next = msgs[i + 1];
            const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
            const first = !prev || prev.from !== m.from || newDay;
            const lastOfRun = !next || next.from !== m.from;
            const day = newDay ? <Label c={k.ink45} s={9} style={{ textAlign: "center", marginVertical: 20 }}>{dayLabel(m.at, now)}</Label> : null;
            const has = m.text || m.file || m.files?.length || m.voice || m.send || m.action || m.email || m.secret || m.takeover || m.meet || m.task;
            if (m.from !== "system" && !has) return null;
            if (m.from === "system" && m.tx) return <View key={m.id}>{day}<TxReceipt tx={m.tx} /></View>;
            if (m.from === "system") return (
              <View key={m.id}>{day}<View style={{ marginVertical: 12, alignItems: "center" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 6 }}>{m.call ? <Icon name="call" size={13} color={k.brandInk} /> : null}<T f="semi" s={12.5} c={k.ink75}>{m.call ? `Voice call · ${fmtSecs(m.call)}` : m.text || ""}</T></View></View></View>
            );
            const mine = m.from === "you";
            const bubble = (m.text || (m.file && !m.file.id) || m.voice) ? (
              <View style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: mine ? GRAPE : k.card, borderWidth: mine ? 0 : 1, borderColor: k.line, ...(lastOfRun ? (mine ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }) : null) }}>
                {m.file && !m.file.id ? <View style={{ marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, padding: 6, paddingRight: 12, backgroundColor: mine ? "rgba(255,255,255,0.15)" : k.tint }}><View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: mine ? "#fff" : GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="file" size={17} color={mine ? GRAPE : "#fff"} /></View><View style={{ flexShrink: 1 }}><T f="semi" s={14} c={mine ? "#fff" : k.ink} lines={1}>{m.file.name}</T><T s={11.5} c={mine ? "rgba(255,255,255,0.75)" : k.ink60}>{String(m.file.size ?? "")}</T></View></View> : null}
                {m.voice ? <VoiceNote secs={m.voice} mine={mine} /> : m.text ? <T s={14.5} c={mine ? "#fff" : k.ink} style={{ lineHeight: 20.3 }}>{m.text}</T> : null}
              </View>
            ) : null;
            const cards = (
              <>
                {m.file?.id ? <FileCards files={[{ id: m.file.id, name: m.file.name, size: m.file.size ?? 0 }]} /> : null}
                {bubble}
                {m.send ? <SendCard convo={id} mid={m.id} sd={m.send} who={m.from} onPatch={(p) => patch(m.id, { send: { ...m.send!, ...p } })} /> : null}
                {m.action ? <ActionCardView a0={m.action} who={m.from} /> : null}
                {m.email ? <EmailCardView e0={m.email} who={m.from} /> : null}
                {m.secret ? <SecretCardView c0={m.secret} who={m.from} onSaved={() => {}} /> : null}
                {m.takeover ? <TakeoverCardView reason={m.takeover.reason} onDesktop={desk} /> : null}
                {m.meet ? <MeetCard convo={id} mid={m.id} from={m.from} mt={m.meet} task={m.meet.taskId ? taskMap[m.meet.taskId] : undefined} now={now} onDesktop={desk} onPatch={(p) => patch(m.id, { meet: p })} onTask={(t) => setTasks((x) => [t, ...x.filter((y) => y.id !== t.id)])} /> : null}
                {m.task && !m.meet ? <TaskCard r={m.task} t={taskMap[m.task.id]} now={now} onDesktop={desk} /> : null}
                <Shots mid={m.id} list={m.shots} />
                {m.files?.length ? <FileCards files={m.files} /> : null}
              </>
            );
            return (
              <View key={m.id}>{day}
                {mine ? <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: first ? 16 : 0 }}><View style={{ maxWidth: "80%", alignItems: "flex-end" }}>{cards}</View></View> : (
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: first ? 16 : 0 }}>
                    {lastOfRun ? <Pressable accessibilityLabel={`${nameOf(me, m.from)}'s profile`} onPress={() => router.push(`/agents/${m.from}`)}><AgentTile slug={m.from} look={lookOf(m.from)} size={30} radius={10} ring={ringOf(m.from, me?.agents.find((a) => a.slug === m.from)?.kind, me?.prefs?.defaultAgent || "home")} mood={latest.get(m.from) === i ? mood : undefined} /></Pressable> : <View style={{ width: 30 }} />}
                    <View style={{ maxWidth: "80%", minWidth: 0 }}>
                      {first ? <T f="bold" s={12} c={k.ink60} style={{ marginBottom: 4 }}>{nameOf(me, m.from) === m.from && specialist(m.from) ? specialist(m.from)!.name : nameOf(me, m.from)}</T> : null}
                      {cards}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          {typing ? (
            <View style={{ marginTop: 12, flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
              <AgentTile slug={group ? chat?.members[0] || "home" : id} look={lookOf(id)} size={30} radius={10} dot={false} mood="thinking" />
              <View style={{ flexDirection: "row", gap: 4, borderRadius: 20, borderBottomLeftRadius: 6, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, paddingHorizontal: 16, paddingVertical: 14 }}>{[0, 1, 2].map((d) => <View key={d} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: k.brandInk, opacity: 0.4 + d * 0.25 }} />)}</View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: k.line, backgroundColor: k.bg, paddingHorizontal: 12, paddingTop: 12, paddingBottom: insets.bottom + 10 }}>
        {toast ? <View style={{ alignSelf: "center", marginBottom: 8, borderRadius: 999, backgroundColor: k.ink, paddingHorizontal: 14, paddingVertical: 8 }}><T f="semi" s={13} c={k.bg}>{toast}</T></View> : null}
        {suggestions.length && rec === null ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
            {suggestions.map((s) => <Pressable key={s} onPress={() => void send(s)} style={{ borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 8 }}><T f="semi" s={13} c={k.ink75}>{s}</T></Pressable>)}
          </ScrollView>
        ) : null}
        {rec === null ? <GuardPanel items={caught} setItems={setCaught} onSwap={(n, put) => setText((t) => t.split(`[secret ${n}]`).join(put).replace(/[ \t]{2,}/g, " "))} /> : null}
        <TourTarget id="composer">
        <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: rec !== null ? GRAPE : k.line }}>
          {file && rec === null ? (
            <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, backgroundColor: k.tint, paddingVertical: 6, paddingLeft: 8, paddingRight: 6, maxWidth: "100%" }}>
                <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="file" size={16} /></View>
                <View style={{ flexShrink: 1 }}><T f="semi" s={13} lines={1}>{file.name}</T><T s={11.5} c={k.ink60}>{file.uploading ? "Uploading…" : file.size}</T></View>
                <Pressable accessibilityLabel="Remove attachment" onPress={() => setFile(null)} style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={14} color={k.ink} /></Pressable>
              </View>
            </View>
          ) : null}
          {rec === null ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, padding: 6 }}>
              <Pressable accessibilityLabel={`Open ${name}'s desktop`} onPress={desk} style={iconBtn}><Icon name="monitor" size={19} color={k.ink75} /></Pressable>
              <Pressable accessibilityLabel="Attach a file" onPress={() => void attach()} style={iconBtn}><Icon name="clip" size={19} color={k.ink75} /></Pressable>
              <TextInput value={text} onChangeText={onChange} multiline placeholder={`Message ${name}`} placeholderTextColor={k.ink45} accessibilityLabel={`Message ${name}`}
                style={{ flex: 1, minHeight: 36, maxHeight: 160, paddingHorizontal: 6, paddingVertical: 7, fontSize: 15, lineHeight: 22, color: k.ink, fontFamily: F.sans }} />
              <Pressable accessibilityLabel="Record a voice message" onPress={() => setRec(0)} style={iconBtn}><Icon name="mic" size={19} color={k.ink75} /></Pressable>
              <Pressable accessibilityLabel={`Call ${name}`} onPress={() => router.push(`/call/${id}`)} style={iconBtn}><Icon name="call" size={18} color={k.ink75} /></Pressable>
              <Pressable accessibilityLabel="Send" disabled={!ready} onPress={() => void send()} style={{ ...iconBtn, backgroundColor: ready ? GRAPE : k.dark ? "rgba(255,255,255,0.15)" : "rgba(10,10,10,0.15)" }}><Icon name="send" size={18} stroke={2.4} color={ready ? "#fff" : k.ink45} /></Pressable>
            </View>
          ) : (
            <View accessibilityLabel="Recording a voice message" style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 6 }}>
              <Pressable accessibilityLabel="Cancel recording" onPress={() => setRec(null)} style={iconBtn}><Icon name="trash" size={18} color={k.ink75} /></Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GRAPE }} /><T f="mono" s={13} style={{ width: 40 }}>{fmtSecs(rec)}</T></View>
              <View style={{ flex: 1, height: 40, flexDirection: "row", alignItems: "center", gap: 3, overflow: "hidden" }}>{Array.from({ length: 36 }).map((_, i) => <View key={i} style={{ width: 3, borderRadius: 2, height: `${30 + ((i * 37 + Math.floor(rec * 10) * 13) % 60)}%`, backgroundColor: k.brandInk }} />)}</View>
              <Pressable accessibilityLabel="Done recording, check the text" onPress={() => { setRec(null); setToast("I didn't catch anything. Try again a little closer to the mic."); }} style={{ ...iconBtn, width: 40, height: 40, borderRadius: 20, backgroundColor: GRAPE }}><Icon name="check" size={18} stroke={2.6} /></Pressable>
            </View>
          )}
        </View>
        </TourTarget>
      </View>
      {!group ? <MailSheet open={panel === "mail"} onClose={() => setPanel(null)} agent={id} name={name} onAsk={(t) => void send(t)} onUnread={setUnread} /> : null}
      {taskAgent ? <TasksSheet open={panel === "tasks"} onClose={() => setPanel(null)} agent={id} name={name} tasks={tasks} now={now} onDesktop={desk} onChange={(t, tid) => setTasks((x) => (t ? x.map((y) => (y.id === tid ? t : y)) : x.filter((y) => y.id !== tid)))} /> : null}
      <ModelSheet open={modelOpen} onClose={() => setModelOpen(false)} convo={id} agent={group ? null : id} agentName={name} group={!!group} onChange={setModel} />
    </KeyboardAvoidingView>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
