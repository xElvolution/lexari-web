/** Port of webapp/app/(app)/settings/page.tsx at phone width: the section list first, then one section with a back button. */
import { Stage, toast } from "@/web/anim";
import { linkPasskey, loadKeys, passkeyError, passkeySupported, type MeraKeys as MeraKeysT } from "@/lib/passkey";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Linking, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Icon from "@/components/Icon";
import { SecurityRows } from "@/components/SecurityRows";
import SecurityCenter from "@/components/SecurityCenter";
import { api } from "@/lib/api";
import { disablePush, enablePush, pushOnHere, pushPermission, type Perm } from "@/lib/push";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { AgentTile, F, GRAPE, Label, Pill, T, WSheet, ringOf, short, useC, WToggle } from "@/web/kit";
import { primaryOf, useData } from "@/web/data";
import { UpgradeSheet } from "@/web/Plans";
import { IntegrationsSec, WalletsSec } from "@/web/Access";
import { SECRET_NAME_RE, findSecrets, isBlockedKind, toSecretName } from "@/lib/secretScan";

const SECTIONS = [
  { id: "general", label: "General", icon: "settings" },
  { id: "personal", label: "Personalization", icon: "spark" },
  { id: "agents", label: "Agents", icon: "team" },
  { id: "models", label: "Models", icon: "chip" },
  { id: "notifications", label: "Notifications", icon: "chat" },
  { id: "data", label: "Data controls", icon: "folder" },
  { id: "security", label: "Security", icon: "pin" },
  { id: "accounts", label: "Account", icon: "globe" },
  { id: "social", label: "Connected accounts", icon: "link" },
  { id: "wallets", label: "Wallets", icon: "wallet" },
  { id: "integrations", label: "Integrations", icon: "plug" },
  { id: "secrets", label: "Secrets", icon: "key" },
  { id: "billing", label: "Billing", icon: "wallet" },
  { id: "about", label: "About", icon: "list" },
] as const;
type Sec = (typeof SECTIONS)[number]["id"];

/** web: section.mt-6 > h3.label.mb-1 (9.5px, ink/50) + rounded-[22px] bg-card px-5 ring-1 ring-line, rows divided by a line */
function Group({ title, children, pad = 20 }: { title?: string; children: ReactNode; pad?: number }) {
  const k = useC();
  return (
    <View style={{ marginTop: 18 }}>
      {title ? <Label s={11} c={k.dark ? "rgba(255,255,255,0.5)" : "rgba(10,10,10,0.5)"} style={{ lineHeight: 16.5, letterSpacing: 0.44, marginBottom: 4 }}>{title}</Label> : null}
      <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, paddingHorizontal: pad - 1 }}>{children}</View>
    </View>
  );
}
function Row({ title, desc, children, danger, last }: { title: string; desc?: string; children?: ReactNode; danger?: boolean; last?: boolean }) {
  const k = useC();
  return (
    <View style={{ paddingVertical: 16, gap: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: k.line }}>
      <View><T f="semi" s={14.5} c={danger ? "#e5484d" : k.ink} style={{ lineHeight: 21.75 }}>{title}</T>{desc ? <T f="reg" s={13.5} c={k.ink60} style={{ marginTop: 2, lineHeight: 18.56 }}>{desc}</T> : null}</View>
      {children ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>{children}</View> : null}
    </View>
  );
}
function Small({ label, icon, onPress }: { label: string; icon?: string; onPress: () => void }) {
  const k = useC();
  return <Pressable onPress={onPress} style={{ height: 40, borderRadius: 20, backgroundColor: k.tint, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>{icon ? <Icon name={icon} size={15} color={k.ink} /> : null}<T f="semi" s={14}>{label}</T></Pressable>;
}
function Toggle({ on, set, label = "Switch" }: { on: boolean; set: (v: boolean) => void; label?: string }) {
  return <WToggle on={on} onChange={set} label={label} />;
}
function Select({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  const k = useC();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={{ height: 40, borderRadius: 20, backgroundColor: k.tint, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}><T f="semi" s={14}>{options.find((o) => o[0] === value)?.[1] ?? value}</T><Icon name="right" size={14} color={k.ink60} /></Pressable>
      <WSheet open={open} title="Choose" onClose={() => setOpen(false)}>
        {options.map(([id, l]) => <Pressable key={id} onPress={() => { onChange(id); setOpen(false); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: k.line }}><T f="semi" s={15}>{l}</T>{id === value ? <Icon name="check" size={16} color={k.brandInk} /> : null}</Pressable>)}
      </WSheet>
    </>
  );
}

function usePatch() {
  const { token } = useSession();
  const { reload } = useData();
  return async (body: Record<string, unknown>) => { if (!token) return; await api("/api/me", { method: "PATCH", body: JSON.stringify(body) }, token).catch(() => {}); await reload(); };
}

function General() {
  const k = useC();
  const { me } = useData();
  const { theme, setTheme } = usePrefs() as ReturnType<typeof usePrefs> & { theme?: string };
  const patch = usePatch();
  const p = (me?.prefs ?? {}) as Record<string, unknown>;
  const home = me?.agents.find((a) => a.slug === "home");
  return (
    <>
      <Group title="Appearance">
        <Row title="Theme" desc="Light, dark, or follow your device.">
          <View style={{ flexDirection: "row", backgroundColor: k.tint, borderRadius: 999, padding: 4 }}>
            {([["light", "sun", "Light"], ["dark", "moon", "Dark"], ["system", "laptop", "System"]] as const).map(([id, ic, l]) => { const on = (theme ?? "dark") === id; return (
              <Pressable key={id} onPress={() => setTheme(id)} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: on ? k.card : "transparent" }}><Icon name={ic} size={14} color={on ? k.ink : k.ink60} /><T f="bold" s={13} c={on ? k.ink : k.ink60}>{l}</T></Pressable>
            ); })}
          </View>
        </Row>
        <Row last title="Animations" desc="Smooth motion across the app. Turn off for a calmer screen."><Toggle label="Animations" on={p.motion !== false} set={(v) => patch({ prefs: { motion: v } })} /></Row>
      </Group>
      <Group title="Language and voice">
        <Row title="Language" desc="Used for the app and your agents' replies."><Select value={String(p.language ?? "English")} options={["English", "Français", "Español", "Português", "Deutsch", "Yorùbá", "Hausa", "Igbo"].map((x) => [x, x])} onChange={(v) => patch({ prefs: { language: v } })} /></Row>
        <Row last title="Voices" desc="Each agent has its own voice for calls and Read aloud. Open an agent, tap Edit, then Voice."><Small icon="speaker" label={`${home?.name ?? "Your agent"}'s voice`} onPress={() => router.push("/agents/home")} /></Row>
      </Group>
      <Group title="Chats">
        <Row last title="Default agent" desc="Who opens first on the Agents page."><Select value={String(p.defaultAgent ?? "home")} options={(me?.agents ?? []).map((a) => [a.slug, a.name])} onChange={(v) => patch({ prefs: { defaultAgent: v } })} /></Row>
      </Group>
    </>
  );
}

const TONES: [string, string][] = [["short", "Short and clear"], ["warm", "Warm"], ["playful", "Playful"], ["formal", "Formal"]];
function Personal() {
  const k = useC();
  const { token } = useSession();
  const { me, reload } = useData();
  const patch = usePatch();
  const home = me?.agents.find((a) => a.slug === "home");
  const [name, setName] = useState(home?.name ?? "");
  const [you, setYou] = useState(String(home?.meta?.you ?? ""));
  const [ins, setIns] = useState(String((me?.prefs as Record<string, unknown> | undefined)?.instructions ?? ""));
  const save = async (extra: Record<string, unknown> = {}) => { if (!token || !home) return; await api("/api/agents", { method: "POST", body: JSON.stringify({ slug: "home", kind: "home", name: name.trim() || home.name, role: home.role ?? "", tone: (home as { tone?: string }).tone ?? "short", look: home.look ?? null, meta: { you: you.trim() }, ...extra }) }, token).catch(() => {}); await reload(); };
  const field = { marginTop: 6, height: 46, borderRadius: 14, backgroundColor: k.tint, paddingHorizontal: 14, color: k.ink, fontFamily: F.semi, fontSize: 15 } as const;
  return (
    <>
      <Group title="Your agent">
        <View style={{ paddingVertical: 16, gap: 12 }}>
          <View style={{ width: 96, height: 96, borderRadius: 26, backgroundColor: k.faceTile, borderWidth: 1, borderColor: k.line, alignItems: "center", justifyContent: "center" }}><AgentTile slug="home" look={home?.look} size={84} dot={false} /></View>
          <View><Label s={9.5} c={k.ink60}>Agent name</Label><TextInput value={name} onChangeText={(v) => setName(v.slice(0, 12))} style={field} /></View>
          <View><Label s={9.5} c={k.ink60}>It calls you</Label><TextInput value={you} onChangeText={(v) => setYou(v.slice(0, 20))} placeholder="Ada" placeholderTextColor={k.ink45} style={field} /></View>
          <Pill label="Save" h={40} style={{ alignSelf: "flex-start" }} disabled={!name.trim() || (name.trim() === home?.name && you.trim() === String(home?.meta?.you ?? ""))} onPress={() => save()} />
        </View>
        <Row last title="Tone" desc={`How ${home?.name ?? "your agent"} talks to you.`}><Select value={(home as { tone?: string } | undefined)?.tone ?? "short"} options={TONES} onChange={(v) => save({ tone: v })} /></Row>
      </Group>
      <Group title="Custom instructions">
        <View style={{ paddingVertical: 14 }}>
          <T s={13.5} c={k.ink60}>Anything every agent should know or do, every time.</T>
          <TextInput multiline value={ins} onChangeText={(v) => setIns(v.slice(0, 600))} placeholder="e.g. Keep answers short. I work from Lagos, so use WAT for times." placeholderTextColor={k.ink45} style={{ ...field, height: 110, paddingTop: 12, textAlignVertical: "top", marginTop: 10 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}><T s={12} c={k.ink45}>{`${ins.length}/600`}</T><Pill label="Save" h={40} onPress={() => patch({ prefs: { instructions: ins } })} /></View>
        </View>
      </Group>
      <Group title="Memory">
        <Row title="Memory" desc="Let agents remember useful things about you between chats."><Toggle label="Memory" on={(me?.prefs as Record<string, unknown> | undefined)?.memory !== false} set={(v) => patch({ prefs: { memory: v } })} /></Row>
        <Row last title="Manage memory" desc={`${me?.memories?.length ?? 0} things remembered. See, edit or forget any of them.`}><Small label="Open brain" onPress={() => router.navigate("/(tabs)/brain")} /></Row>
      </Group>
    </>
  );
}

function AgentsSec() {
  const { me } = useData();
  const k = useC();
  const primary = primaryOf(me);
  const list = me?.agents ?? [];
  return (
    <>
      <Group title={`Your team · ${list.length} agent${list.length === 1 ? "" : "s"}`}>
        {list.map((a, i) => (
          <View key={a.slug} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: k.line }}>
            <AgentTile slug={a.slug} look={a.look} size={44} ring={ringOf(a.slug, a.kind, primary)} />
            <View style={{ flex: 1 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><T f="semi" s={15}>{a.name}</T>{a.slug === primary ? <View style={{ backgroundColor: k.tint, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}><Label s={8}>Default</Label></View> : null}</View><T s={13} c={k.ink45}>{`${a.role || (a.kind === "home" ? "Your agent" : "Specialist")} · seat ${String(i + 1).padStart(2, "0")}`}</T></View>
            <Small label="Chat" onPress={() => router.push(`/chat/${a.slug}`)} />
          </View>
        ))}
      </Group>
      <Group>
        <Row title="Add an agent" desc="Create your own, or hire a specialist from the marketplace."><Small label="Add agent" onPress={() => router.navigate("/(tabs)/marketplace")} /></Row>
        <Row last title="Your team" desc="Everyone you hired, and the specialists you can bring back for free."><Small label="Team" onPress={() => router.navigate("/(tabs)/team")} /></Row>
      </Group>
    </>
  );
}

/** content/models.ts HOUSE, same order and names as the web. */
const OPEN_MODELS: [string, string, string][] = [["kimi", "Kimi K3", "Moonshot AI"], ["qwen", "Qwen 3.8 Max", "Alibaba"], ["zg", "0G Compute", "0G"]];
function Models() {
  const k = useC();
  const { token } = useSession();
  const [m, setM] = useState<{ default?: string; prefs?: { on: string[] }; keys?: { provider: string }[] } | null>(null);
  const [avail, setAvail] = useState<Record<string, boolean> | null>(null);
  useEffect(() => { if (token) api<typeof m>("/api/models", {}, token).then(setM).catch(() => setM({})); }, [token]);
  useEffect(() => { if (token) api<{ models: { available: Record<string, boolean> } }>("/api/billing", {}, token).then((b) => setAvail(b.models.available)).catch(() => setAvail({})); }, [token]);
  return (
    <>
      <Group title="Defaults">
        <Row last title="Account default" desc="Every agent without its own pick answers with this."><View style={{ height: 40, borderRadius: 20, backgroundColor: k.tint, paddingHorizontal: 16, justifyContent: "center" }}><T f="semi" s={14}>{m?.default === "lamina" ? "Lamina" : m?.default ?? "…"}</T></View></Row>
      </Group>
      <Group title="Models">
        {(m?.prefs?.on ?? []).map((id, i, a) => <Row key={id} last={i === a.length - 1} title={id} desc="Included" />)}
        {m && !(m.prefs?.on ?? []).length ? <Row last title="Lamina" desc="Included" /> : null}
      </Group>
      <Group title="Open models">
        {OPEN_MODELS.map(([id, label, maker], i, a) => (
          <Row key={id} last={i === a.length - 1} title={label} desc={avail ? (avail[id] ? `${maker} · included. Falls back to another open model if it's busy.` : `${maker} · unavailable on this server`) : maker}>
            {avail && !avail[id] ? <View style={{ borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 8, paddingVertical: 4 }}><T f="bold" s={10} c={k.ink60}>UNAVAILABLE</T></View> : null}
          </Row>
        ))}
      </Group>
      <Group title="API Keys">
        <Row last title={`${m?.keys?.length ?? 0} keys`} desc="Keys are encrypted on Lexari's server and never shown again. Replies on your key are billed by your provider and never use your Lexari balance." />
      </Group>
    </>
  );
}

const NOTIFS: [string, string, string][] = [
  ["replies", "Agent replies", "When an agent answers you and you're not looking."],
  ["groups", "Group mentions", "When someone names you or asks you in a group."],
  ["calls", "Missed calls", "When an agent tried to reach you."],
  ["wallet", "Wallet activity", "Money in or out of an agent's wallet."],
  ["cards", "Card purchases", "Every purchase an agent makes with its card."],
  ["digest", "Weekly email digest", "A short summary of what your team did."],
  ["product", "Product news", "New features and agents. Rarely."],
];
function DevicePush() {
  const k = useC();
  const { token } = useSession();
  const [on, setOn] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<Perm>("default");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { void pushOnHere().then(setOn); void pushPermission().then(setPerm); }, []);
  const flip = async (v: boolean) => {
    if (!token) return;
    setBusy(true);
    try {
      if (v) { const r = await enablePush(token); setOn(r.ok); setNote(r.ok ? "Notifications are on for this phone." : r.why || "Couldn't turn on notifications"); }
      else { await disablePush(token); setOn(false); setNote("Notifications are off for this phone"); }
      setPerm(await pushPermission());
    } finally { setBusy(false); }
  };
  const desc = perm === "unsupported" ? "This device can't show notifications."
    : perm === "denied" ? "Blocked for Lexari. Allow notifications in your phone's settings, then come back."
    : "Get replies, quest rewards, your daily box and payment updates even when Lexari is closed.";
  return (
    <Group title="This device">
      <Row last title="Push notifications" desc={desc}>
        {perm === "unsupported" || perm === "denied"
          ? <T f="semi" s={12} c={k.ink45}>Off</T>
          : <View style={{ opacity: busy ? 0.6 : 1 }} pointerEvents={busy ? "none" : "auto"}><Toggle label="Push notifications" on={!!on} set={(v) => void flip(v)} /></View>}
        {note ? <T s={12.5} c={k.brandInk}>{note}</T> : null}
      </Row>
    </Group>
  );
}

function Notifs() {
  const { me } = useData();
  const patch = usePatch();
  const n = ((me?.prefs as Record<string, unknown> | undefined)?.notif ?? {}) as Record<string, boolean>;
  const set = (key: string, v: boolean) => patch({ prefs: { notif: { ...n, [key]: v } } });
  return (
    <>
      <DevicePush />
      <Group title="Push and in-app">{NOTIFS.slice(0, 5).map(([key, t, d], i) => <Row key={key} last={i === 4} title={t} desc={d}><Toggle label={t} on={!!n[key]} set={(v) => set(key, v)} /></Row>)}</Group>
      <Group title="Email">{NOTIFS.slice(5).map(([key, t, d], i) => <Row key={key} last={i === 1} title={t} desc={d}><Toggle label={t} on={!!n[key]} set={(v) => set(key, v)} /></Row>)}</Group>
    </>
  );
}

function Data() {
  const { me } = useData();
  const patch = usePatch();
  const { token, signOut } = useSession();
  const p = (me?.prefs ?? {}) as Record<string, unknown>;
  return (
    <>
      <Group title="History">
        <Row title="Save chat history" desc="Keep your chats so you can come back to them."><Toggle label="Save chat history" on={p.history !== false} set={(v) => patch({ prefs: { history: v } })} /></Row>
        <Row last title="Help improve Lexari" desc="Share anonymous usage to make agents better. Off by default."><Toggle label="Help improve Lexari" on={!!p.improve} set={(v) => patch({ prefs: { improve: v } })} /></Row>
      </Group>
      <Group title="Your data">
        <Row title="Export data" desc="Download your account, agents, chats, memories and hires as a JSON file."><Small icon="download" label="Export" onPress={() => Linking.openURL("https://app.lexari.ai/settings#data")} /></Row>
        <Row last title="Clear all chats" desc="Removes every message. Agents and memory stay."><Small label="Clear" onPress={() => token && api("/api/chats", { method: "DELETE" }, token).catch(() => {})} /></Row>
      </Group>
      <Group title="Danger zone">
        <Row last danger title="Delete account" desc="Permanently removes your account, agents, chats and memories from Lexari. Onchain records and your wallet stay yours."><Small icon="trash" label="Delete" onPress={() => Linking.openURL("https://app.lexari.ai/settings#data")} /></Row>
      </Group>
      {void signOut}
    </>
  );
}

/** Port of webapp/components/security/MeraKeys.tsx, native: the passkey is made and used right here with Android's Credential Manager. */
function MeraKeys() {
  const k = useC();
  const { token } = useSession();
  const { me } = useData();
  const [keys, setKeys] = useState<MeraKeysT | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = passkeySupported();
  const agents = (me?.agents ?? []).map((a) => ({ slug: a.slug, name: a.name }));
  const load = useCallback(() => { if (token) loadKeys(token).then(setKeys, () => setKeys({ passkeys: [], keys: [] })); }, [token]);
  useEffect(() => { load(); }, [load]);
  const go = async (create: boolean) => {
    if (!token) return;
    setBusy(true); setErr("");
    try {
      await linkPasskey(agents.map((a) => a.slug), create, token, me?.user.email || me?.profile?.username || "Lexari");
      load(); toast(create ? "Passkey connected" : "Agent keys refreshed");
    } catch (e) { setErr(passkeyError(e)); }
    setBusy(false);
  };
  const linked = !!keys?.passkeys.length;
  const name = (sl: string) => agents.find((a) => a.slug === sl)?.name || sl;
  return (
    <View style={{ paddingVertical: 16, gap: 10 }}>
      <T s={13.5} c={k.ink60} style={{ lineHeight: 19 }}>One passkey, many keys. Link a passkey to this account to sign in with your fingerprint, face or a security key, and each agent gets its own key derived from it. Powered by Mera; nothing secret is stored.</T>
      {!ok ? <T s={13} c={k.ink60}>{"This phone doesn't support passkeys."}</T> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pill h={42} icon="lock" label={busy ? "Waiting for passkey…" : linked ? "Refresh agent keys" : "Connect a passkey"} disabled={busy || !ok} onPress={() => void go(!linked)} />
        {!linked ? <Pill h={42} kind="ghost" label="Use a passkey I have" disabled={busy || !ok} onPress={() => void go(false)} /> : null}
      </View>
      {err ? <T s={13} c="#e5484d">{err}</T> : null}
      {keys?.keys.length ? (
        <View style={{ borderRadius: 16, backgroundColor: k.tint, paddingHorizontal: 12 }}>
          {keys.keys.map((x, i) => <View key={x.agent} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: k.line }}><T f="bold" s={13.5}>{name(x.agent)}</T><T s={12} c={k.ink75} style={{ fontFamily: F.mono }}>{`${x.address.slice(0, 6)}…${x.address.slice(-4)}`}</T></View>)}
        </View>
      ) : null}
    </View>
  );
}

function Security() {
  const { me } = useData();
  const { signOut } = useSession();
  const google = me?.user.method === "google";
  return (
    <>
      <Group title="Sign-in protection">
        <Row title={google ? "Google or email" : "Wallet signature"} desc={google ? "Privy checks your Google account or a one-time email code. Your Lexari wallet is created and kept by Privy." : "You sign a one-time message with your wallet. Lexari never sees your keys."} />
        <Row last title="Session" desc="Sessions last up to 30 days on a device. See every device below and sign out the ones you don't know." />
      </Group>
      <Group title="Passkey"><MeraKeys /></Group>
      <Group title="App lock"><SecurityRows /></Group>
      <SecurityCenter />
      <Group title="This device"><Row last title="Sign out" desc="Ends this session."><Small icon="out" label="Sign out" onPress={() => signOut().then(() => router.replace("/(auth)/sign-in"))} /></Row></Group>
    </>
  );
}

function Accounts() {
  const { me } = useData();
  const k = useC();
  const google = me?.user.method === "google"; const addr = me?.user.wallet; const code = me?.user.referralCode;
  return (
    <>
      <Group title="Signed in with">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: k.line }}>
          <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: k.ink, alignItems: "center", justifyContent: "center" }}><Icon name={google ? "google" : "wallet"} size={20} color={k.bg} /></View>
          <View style={{ flex: 1 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><T f="semi" s={15}>{google ? "Google or email" : "Solana wallet"}</T><View style={{ backgroundColor: GRAPE, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}><Label s={8} c="#fff">Signed in</Label></View></View><T s={13} c={k.ink45}>{google ? me?.user.email ?? "Privy account" : short(addr)}</T></View>
        </View>
        <Row last title={google ? "Lexari wallet" : "Wallet"} desc={addr ? `${short(addr)} signs your check-ins, quests, ID cards and hires.` : "Your wallet is still loading."}>{addr ? <Small icon="copy" label="Copy" onPress={() => Clipboard.setStringAsync(addr)} /> : null}</Row>
      </Group>
      {code ? <Group title="Invite friends"><Row last title={`Your code · ${code}`} desc="Friends who sign up with your link count toward your referral tiers in the Hub."><Small icon="copy" label="Copy link" onPress={() => Clipboard.setStringAsync(`https://app.lexari.ai/signin?ref=${code}`)} /></Row></Group> : null}
    </>
  );
}

function Social() {
  const { token } = useSession();
  const [links, setLinks] = useState<{ provider: string; handle: string | null }[] | null>(null);
  useEffect(() => { if (token) api<{ links: { provider: string; handle: string | null }[] }>("/api/social", {}, token).then((r) => setLinks(r.links), () => setLinks([])); }, [token]);
  const NETS: [string, string][] = [["twitter", "X"], ["discord", "Discord"], ["telegram", "Telegram"]];
  return (
    <>
      <Group title="Accounts">
        {NETS.map(([id, n], i) => {
          const l = links?.find((x) => x.provider === id);
          // linking runs through Privy on lexari.ai (the same account), then shows here
          return <Row key={id} last={i === 2} title={n} desc={!links ? "Checking…" : l ? (l.handle ? `Linked · @${l.handle}` : "Linked") : id === "telegram" ? "Telegram linking opens once our Telegram sign-in is switched on." : "Not linked"}>{!l && id !== "telegram" ? <Small icon="link" label="Link" onPress={() => Linking.openURL("https://app.lexari.ai/settings#social")} /> : null}</Row>;
        })}
      </Group>
      <Group><Row last title="Privacy" desc="Privy checks the account and Lexari keeps only its ID and username. Lexari never posts for you or reads your messages." /></Group>
    </>
  );
}

type SecretInfo = { id: string; name: string; label?: string; service?: string; last4?: string };
/** Port of webapp/components/secrets/SecretsSection.tsx: vault list with add / delete sheets, and "How it works". */
function Secrets() {
  const { token } = useSession();
  const k = useC();
  const [list, setList] = useState<SecretInfo[] | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<{ kind: "add" } | { kind: "delete"; s: SecretInfo } | null>(null);
  const [name, setName] = useState(""); const [service, setService] = useState(""); const [value, setValue] = useState(""); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const load = () => { if (token) api<{ secrets: SecretInfo[] }>("/api/secrets", {}, token).then((r) => { setList(r.secrets); setErr(""); }).catch(() => setErr("Couldn't load your secrets.")); };
  useEffect(load, [token]);
  const save = async () => {
    setMsg("");
    if (!value.trim()) return setMsg("Paste the value first.");
    if (!SECRET_NAME_RE.test(toSecretName(name))) return setMsg("Give it a name like CLOUDFLARE_API_TOKEN.");
    const bad = (await findSecrets(value)).find((f) => isBlockedKind(f.kind));
    if (bad) { setValue(""); return setMsg(`That looks like ${bad.label}. Lexari never stores those. Keep it private.`); }
    setBusy(true);
    try { const r = await api<{ secret: SecretInfo }>("/api/secrets", { method: "POST", body: JSON.stringify({ name: toSecretName(name), value, service: service || undefined, label: service ? `${service} key` : undefined }) }, token); setList((l) => [r.secret, ...(l ?? [])]); setEdit(null); setName(""); setService(""); setValue(""); }
    catch (e) { setMsg(e instanceof Error ? e.message : "That didn't save."); } finally { setBusy(false); }
  };
  const del = async (x: SecretInfo) => { setBusy(true); try { await api(`/api/secrets/${x.id}`, { method: "DELETE" }, token); setList((l) => (l ?? []).filter((y) => y.id !== x.id)); setEdit(null); } catch { /* keep sheet */ } finally { setBusy(false); } };
  const field = { height: 44, borderRadius: 14, borderWidth: 1, borderColor: k.line, backgroundColor: k.tint, color: k.ink, paddingHorizontal: 12, fontSize: 14 };
  return (
    <>
      <View style={{ marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 6 }}>
        <Label s={9.5} c={k.ink45}>Vault</Label>
        <Pressable onPress={() => { setMsg(""); setEdit({ kind: "add" }); }} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: GRAPE, flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="plus" size={14} color="#fff" /><T f="bold" s={12.5} c="#fff">Add</T></Pressable>
      </View>
      <View style={{ borderRadius: 20, backgroundColor: k.card, borderWidth: 1, borderColor: k.line }}>
        {err ? <View style={{ padding: 16 }}><T s={14} c={k.ink60}>{err} </T><Pressable onPress={load}><T f="bold" s={14} c={k.brandInk}>Try again</T></Pressable></View>
          : list && !list.length ? <View style={{ padding: 16 }}><T s={13.5} c={k.ink60} style={{ lineHeight: 19 }}>Nothing saved yet. When an agent needs an API key or token it asks with a secure card in the chat, and it lands here.</T></View>
          : (list ?? []).map((x, i) => (
            <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: k.line }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="key" size={16} color={k.brandInk} /></View>
              <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={13.5} lines={1} style={{ fontFamily: F.mono }}>{x.name}</T><T s={11.5} c={k.ink60} lines={1}>{`${x.service || x.label || "Secret"}${x.last4 ? ` · ••••${x.last4}` : ""}`}</T></View>
              <Pressable accessibilityLabel={`Delete ${x.name}`} onPress={() => setEdit({ kind: "delete", s: x })} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={15} color={k.ink75} /></Pressable>
            </View>
          ))}
      </View>
      <Label s={9.5} c={k.ink45} style={{ marginTop: 18, marginBottom: 6, paddingHorizontal: 4 }}>How it works</Label>
      <View style={{ borderRadius: 20, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 16, gap: 10 }}>
        {[["lock", "Encrypted on our server (AES-256). Nobody, not even your agents, can read a saved value back."], ["terminal", "Agents use a secret by name. It's added to their command only while it runs, and blocked out of anything they see."], ["eyeoff", "Never paste keys in chat. If you do, Lexari catches it and offers to save it here. Recovery phrases and private keys are always refused."]].map(([ic, t]) => (
          <View key={ic} style={{ flexDirection: "row", gap: 10 }}><Icon name={ic} size={15} color={k.brandInk} /><T s={13} c={k.ink75} style={{ flex: 1, lineHeight: 18 }}>{t}</T></View>
        ))}
      </View>
      <WSheet open={edit?.kind === "add"} title="Add a secret" sub="The value is encrypted and never shown again." icon="key" onClose={() => setEdit(null)}
        footer={<Pill h={44} label={busy ? "Saving…" : "Save securely"} onPress={() => void save()} />}>
        <View style={{ gap: 8 }}>
          <TextInput value={name} onChangeText={(v) => setName(v.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 64))} placeholder="NAME" placeholderTextColor={k.ink45} autoCapitalize="characters" style={[field, { fontFamily: F.mono }]} />
          <TextInput value={service} onChangeText={(v) => setService(v.slice(0, 40))} placeholder="Service" placeholderTextColor={k.ink45} style={field} />
          <View style={[field, { flexDirection: "row", alignItems: "center", paddingHorizontal: 0 }]}>
            <TextInput value={value} onChangeText={setValue} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} placeholder="Paste the value" placeholderTextColor={k.ink45} style={{ flex: 1, color: k.ink, paddingHorizontal: 12, fontFamily: F.mono, fontSize: 14, height: 44 }} />
            <Pressable accessibilityLabel={show ? "Hide" : "Show"} onPress={() => setShow(!show)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name={show ? "eyeoff" : "eye"} size={16} color={k.ink60} /></Pressable>
          </View>
          {msg ? <T s={12.5} c="#e5484d">{msg}</T> : null}
        </View>
      </WSheet>
      <WSheet open={edit?.kind === "delete"} title={edit?.kind === "delete" ? `Delete ${edit.s.name}?` : ""} sub="Agents lose access right away. This can't be undone." icon="trash" onClose={() => setEdit(null)}
        footer={<View style={{ flexDirection: "row", gap: 8 }}><Pill kind="outline" h={44} label="Keep" style={{ flex: 1 }} onPress={() => setEdit(null)} /><Pill h={44} label="Delete" style={{ flex: 1, backgroundColor: "#e5484d" }} onPress={() => edit?.kind === "delete" && void del(edit.s)} /></View>}>
        <View />
      </WSheet>
    </>
  );
}

function Billing() {
  const { me } = useData();
  const [up, setUp] = useState(false);
  const plan = me?.plan;
  return (
    <>
      <Group title="Plan"><Row last title={`${plan?.name ?? "Free"} plan`} desc={`${plan?.seats ?? 1} seat${plan?.seats === 1 ? "" : "s"}`}><Small label="Upgrade plan" onPress={() => setUp(true)} /></Row></Group>
      <UpgradeSheet open={up} mode="plans" onClose={() => setUp(false)} onTopUp={() => { setUp(false); router.push({ pathname: "/(tabs)/wallets", params: { topup: "1" } }); }} />
      <Group title="Hires"><Row last title="Specialists" desc="Specialists are a one-time $1 hire each, paid from your Lexari balance."><Small label="Wallet" onPress={() => router.navigate("/(tabs)/wallets")} /></Row></Group>
    </>
  );
}

function About() {
  const { signOut } = useSession();
  return (
    <>
      <Group><Row last title="Version" desc="Lexari Android"><T s={13} style={{ fontFamily: F.mono }}>1.0.0</T></Row></Group>
      <Group title="Legal">
        <Row title="Terms of use"><Small label="Read" onPress={() => Linking.openURL("https://lexari.ai/legal/terms")} /></Row>
        <Row last title="Privacy policy"><Small label="Read" onPress={() => Linking.openURL("https://lexari.ai/legal/privacy")} /></Row>
      </Group>
      <Group><Row last title="Sign out" desc="You can sign back in with Google or a wallet."><Small icon="out" label="Sign out" onPress={() => signOut().then(() => router.replace("/(auth)/sign-in"))} /></Row></Group>
    </>
  );
}

export default function Settings() {
  const k = useC();
  const [sec, setSec] = useState<Sec | null>(null);
  // a deep link into one section (the Add a passkey prompt opens Security)
  const want = useLocalSearchParams<{ sec?: string }>().sec;
  useEffect(() => { if (want && SECTIONS.some((x) => x.id === want)) setSec(want as Sec); }, [want]);
  const cur = SECTIONS.find((x) => x.id === sec);
  const body: Record<Sec, ReactNode> = { general: <General />, personal: <Personal />, agents: <AgentsSec />, models: <Models />, notifications: <Notifs />, data: <Data />, security: <Security />, accounts: <Accounts />, social: <Social />, wallets: <WalletsSec />, integrations: <IntegrationsSec />, secrets: <Secrets />, billing: <Billing />, about: <About /> };
  if (!cur) return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 32 }}><Stage>
      <T f="display" s={22} style={{ letterSpacing: -0.99, lineHeight: 20.9 }}>Settings</T>
      <View style={{ marginTop: 16, gap: 2 }}>
        {SECTIONS.map((x) => (
          <Pressable key={x.id} onPress={() => setSec(x.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: pressed ? k.tint : "transparent" })}>
            <Icon name={x.icon} size={18} color={k.ink75} /><T f="semi" s={14.5} c={k.ink75} style={{ flex: 1, lineHeight: 21.75 }}>{x.label}</T><Icon name="right" size={16} color={k.ink45} />
          </Pressable>
        ))}
      </View>
    </Stage></ScrollView>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 16.5, paddingBottom: 32 }}><Stage key={cur.id}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable accessibilityLabel="All settings" onPress={() => setSec(null)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}><Icon name="back" size={19} color={k.ink} /></Pressable>
        <T f="display" s={22} style={{ letterSpacing: -0.99, lineHeight: 20.9 }}>{cur.label}</T>
      </View>
      <View style={{ marginTop: 1.5 }}>{body[cur.id]}</View>
    </Stage></ScrollView>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
