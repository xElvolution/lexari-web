/** Port of webapp/app/(app)/profile/page.tsx at phone width: cover + picture, Edit profile / Sign out, name with plan badge, stats, Account / Security / Preferences tabs. */
import { Stage } from "@/web/anim";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { Avatar, Cover, pickAndUpload, removeMedia, type MediaKind } from "@/web/media";
import { router } from "expo-router";
import { openSettings } from "@/lib/nav";
import Icon from "@/components/Icon";
import { SecurityRows } from "@/components/SecurityRows";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { AgentTile, F, GRAPE, Grad, Label, Pill, T, WSheet, short, useC } from "@/web/kit";
import { initialsOf, useData, youName } from "@/web/data";

const SOCIAL_NAME: Record<string, string> = { twitter: "X", discord: "Discord", telegram: "Telegram" };

function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const k = useC();
  return <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><T f="bold" s={16}>{title}</T>{right}</View>{children}</View>;
}
function Rows({ rows }: { rows: [string, string, string][] }) {
  const k = useC();
  return (
    <View style={{ marginTop: 6 }}>
      {rows.map(([ic, l, v], i) => (
        <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: k.line }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name={ic} size={16} color={k.ink60} /></View>
          <T s={14} c={k.ink60} style={{ flex: 1 }}>{l}</T>
          <T f="bold" s={14} style={l === "Wallet" || l === "Invite code" || l === "User ID" ? { fontFamily: F.monoB, fontSize: 13 } : undefined}>{v}</T>
        </View>
      ))}
    </View>
  );
}
function PillLink({ label, icon, onPress }: { label: string; icon?: string; onPress: () => void }) {
  const k = useC();
  return <Pressable onPress={onPress} style={{ height: 38, borderRadius: 19, backgroundColor: k.tint, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 }}>{icon ? <Icon name={icon} size={14} color={k.ink} /> : null}<T f="bold" s={13.5}>{label}</T></Pressable>;
}

export default function Profile() {
  const k = useC();
  const { me, reload } = useData();
  const { token, signOut } = useSession();
  const { theme, setTheme } = usePrefs() as ReturnType<typeof usePrefs> & { theme?: string };
  const [tab, setTab] = useState<"account" | "security" | "prefs">("account");
  const [edit, setEdit] = useState(false);
  const [social, setSocial] = useState<{ links: { provider: string; handle: string | null }[] } | null>(null);
  useEffect(() => { if (token) api<{ links: { provider: string; handle: string | null }[] }>("/api/social", {}, token).then(setSocial, () => setSocial({ links: [] })); }, [token]);
  const p = me?.profile ?? {};
  const name = youName(me);
  const plan = me?.plan ?? { id: "free", name: "Free", seats: 1 };
  const team = me?.agents ?? [];
  const groups = (me?.chats ?? []).filter((c) => c.kind === "group").length;
  const since = me?.user.createdAt ? new Date(me.user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  // Tap the picture or cover: pick one, or with one already there, choose another or remove it (web profile tap()).
  const edit_ = (kind: MediaKind) => {
    const run = (f: () => Promise<unknown>) => f().then(() => reload()).catch((e: Error) => Alert.alert(kind === "avatar" ? "Profile picture" : "Cover photo", e.message || "That didn't save. Try again."));
    const has = kind === "avatar" ? !!p.avatar : !!p.cover;
    if (!has) return void run(() => pickAndUpload(kind, token));
    Alert.alert(kind === "avatar" ? "Profile picture" : "Cover photo", undefined, [
      { text: "Choose another", onPress: () => void run(() => pickAndUpload(kind, token)) },
      { text: "Remove", style: "destructive", onPress: () => void run(() => removeMedia(kind, token)) },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  const out = () => signOut().then(() => router.replace("/(auth)/sign-in"));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 14, paddingBottom: 32, gap: 16 }}><Stage>
      <View style={{ borderRadius: 26, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, overflow: "hidden" }}>
        <Pressable onPress={() => edit_("cover")} accessibilityLabel={p.cover ? "Edit cover photo" : "Add a cover photo"} style={{ height: 112 }}>
          <Grad angle={120} stops={[["#2a0f9a", 0], ["#5b2bff", 0.55], ["#8f6bff", 1]]} />
          <Cover at={p.cover} />
          <View style={{ position: "absolute", right: 10, bottom: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}><Icon name="camera" size={15} color="#fff" /></View>
        </Pressable>
        <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
          <Pressable onPress={() => edit_("avatar")} accessibilityLabel={p.avatar ? "Edit profile picture" : "Add a profile picture"} style={{ marginTop: -46, width: 92, height: 92, borderRadius: 46, borderWidth: 5, borderColor: k.card, backgroundColor: k.card }}>
            <Avatar at={p.avatar} size={82} fs={26} initials={initialsOf(me)} />
            <View style={{ position: "absolute", right: -4, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: GRAPE, borderWidth: 3, borderColor: k.card, alignItems: "center", justifyContent: "center" }}><Icon name="camera" size={12} color="#fff" /></View>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pill kind="ghost" icon="edit" label="Edit profile" h={42} style={{ flex: 1 }} onPress={() => setEdit(true)} />
            <Pill kind="outline" icon="out" label="Sign out" h={42} style={{ flex: 1 }} onPress={out} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 }}>
            <T f="display" s={28} style={{ letterSpacing: -1.2 }}>{name}</T>
            <View style={{ backgroundColor: GRAPE, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Label s={9} c="#fff">{plan.name}</Label></View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 12, marginTop: 6 }}>
            {p.username ? <T f="semi" s={15} c={k.ink45}>{`@${p.username}`}</T> : <Pressable onPress={() => setEdit(true)}><T f="semi" s={14} c={k.brandInk}>Add a username</T></Pressable>}
          {p.bio ? <T s={15} c={k.ink75} style={{ width: "100%", marginTop: 4, lineHeight: 21 }}>{p.bio}</T> : null}
          {/* as on the web: the link pill flows inline after "Add a username" and wraps when it doesn't fit */}
          {social?.links.length ? (
            <View style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {social.links.map((l) => <View key={l.provider} style={{ height: 32, borderRadius: 16, backgroundColor: k.tint, paddingLeft: 10, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="verified" size={13} color={k.ink} /><T f="semi" s={13}>{l.handle ? `@${l.handle}` : SOCIAL_NAME[l.provider] ?? l.provider}</T></View>)}
            </View>
          ) : social ? (
            <Pressable onPress={() => openSettings("social")} style={{ height: 32, borderRadius: 16, backgroundColor: k.tint, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="link" size={14} color={k.ink75} /><T f="semi" s={13} c={k.ink75}>Link X, Discord or Telegram</T></Pressable>
          ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 22, marginTop: 14 }}>
            {[[team.length, "agent", "agents"], [groups, "group", "groups"], [me?.memories?.length ?? 0, "memory", "memories"]].map(([n, one, many]) => [n, n === 1 ? one : many]).map(([n, l]) => <T key={String(l)} s={14} c={k.ink60}><T f="bold" s={14}>{String(n)}</T>{` ${l}`}</T>)}
          </View>
        </View>
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: k.line }}>
          {([["account", "Account"], ["security", "Security"], ["prefs", "Preferences"]] as const).map(([id, l]) => (
            <Pressable key={id} onPress={() => setTab(id)} style={{ flex: 1, paddingVertical: 14, alignItems: "center" }}>
              <T f="bold" s={14.5} c={tab === id ? k.ink : k.ink45}>{l}</T>
              {tab === id ? <View style={{ position: "absolute", left: 16, right: 16, bottom: 0, height: 3, borderRadius: 2, backgroundColor: GRAPE }} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      {tab === "account" ? (
        <>
          <Card title="Account">
            <Rows rows={[
              ...(me?.user.email ? [["google", "Email", me.user.email] as [string, string, string]] : []),
              ["wallet", "Wallet", me?.user.wallet ? short(me.user.wallet) : "Loading"],
              ["star", "Plan", `${plan.name} · ${plan.seats} seat${plan.seats === 1 ? "" : "s"}`],
              ...(me?.user.referralCode ? [["star", "Invite code", me.user.referralCode] as [string, string, string]] : []),
              ["spark", "Member since", since],
            ]} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}><PillLink label="Plan and billing" onPress={() => router.push("/settings/billing")} /><PillLink label="Wallet" onPress={() => router.navigate("/(tabs)/wallets")} /></View>
          </Card>
          <Card title="Your agents" right={<Pressable onPress={() => router.navigate("/(tabs)/team")}><T f="bold" s={13.5} c={k.brandInk}>Team</T></Pressable>}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {team.map((t) => <Pressable key={t.slug} onPress={() => router.push(`/agents/${t.slug}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: k.tint, paddingVertical: 4, paddingLeft: 4, paddingRight: 14 }}><AgentTile slug={t.slug} look={t.look} size={30} dot={false} /><T f="semi" s={13.5}>{t.name}</T></Pressable>)}
            </View>
          </Card>
        </>
      ) : tab === "security" ? (
        <>
          <Card title="Sign-in"><Rows rows={[["user", "Signed in with", me?.user.method === "google" ? "Google or email" : "Solana wallet"], ...(me?.user.email ? [["google", "Email", me.user.email] as [string, string, string]] : []), ["wallet", "Wallet", me?.user.wallet ? short(me.user.wallet) : "Loading"]]} /></Card>
          <Card title="App lock"><View style={{ marginTop: 6 }}><SecurityRows /></View></Card>
          <Card title="Session">
            <T s={14} c={k.ink60} style={{ marginTop: 4 }}>Signing out keeps your agents, chats and Brain saved for next time.</T>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}><PillLink icon="out" label="Sign out" onPress={out} /><PillLink label="Privacy and data" onPress={() => openSettings("data")} /></View>
          </Card>
        </>
      ) : (
        <>
          <Card title="Look">
            <View style={{ flexDirection: "row", alignSelf: "flex-start", backgroundColor: k.tint, borderRadius: 999, padding: 4, marginTop: 12 }}>
              {([["light", "Light", "sun"], ["dark", "Dark", "moon"], ["system", "Device", "laptop"]] as const).map(([id, l, ic]) => { const on = (theme ?? "dark") === id; return <Pressable key={id} onPress={() => setTheme(id)} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? k.card : "transparent" }}><Icon name={ic} size={14} color={on ? k.ink : k.ink60} /><T f="bold" s={13.5} c={on ? k.ink : k.ink60}>{l}</T></Pressable>; })}
            </View>
            <Rows rows={[["globe", "Time zone", Intl.DateTimeFormat().resolvedOptions().timeZone || "Not set"]]} />
          </Card>
          <Card title="Voices">
            <T s={14} c={k.ink60} style={{ marginTop: 4 }}>Each agent has its own voice on calls and when reading messages aloud.</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>{team.slice(0, 6).map((t) => <PillLink key={t.slug} icon="speaker" label={t.name} onPress={() => router.push(`/agents/${t.slug}`)} />)}</View>
          </Card>
          <Card title="More settings">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}><PillLink label="Notifications" onPress={() => openSettings("notifications")} /><PillLink label="All settings" onPress={() => router.navigate("/(tabs)/settings")} /><PillLink label={`${team.find((a) => a.slug === "home")?.name ?? "Your agent"}'s Brain`} onPress={() => router.navigate("/(tabs)/brain")} /></View>
          </Card>
        </>
      )}
      <EditSheet open={edit} onClose={() => setEdit(false)} initial={{ name: p.name ?? name, username: p.username ?? "", bio: (p as { bio?: string }).bio ?? "" }} onSave={async (v) => { if (token) await api("/api/me", { method: "PATCH", body: JSON.stringify({ profile: v }) }, token).catch(() => {}); await reload(); setEdit(false); }} />
    </Stage></ScrollView>
  );
}

function EditSheet({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: { name: string; username: string; bio: string }; onSave: (v: { name: string; username: string; bio: string }) => void }) {
  const k = useC();
  const [v, setV] = useState(initial);
  const ok = !v.username || /^[A-Za-z0-9_]{3,20}$/.test(v.username);
  const field = { marginTop: 6, height: 46, borderRadius: 14, backgroundColor: k.tint, paddingHorizontal: 14, color: k.ink, fontFamily: F.semi, fontSize: 15 } as const;
  return (
    <WSheet open={open} title="Edit profile" onClose={onClose}>
      <T s={13} c={k.ink60}>Tap your picture or cover on your profile to change it.</T>
      <Label s={9.5} c={k.ink60} style={{ marginTop: 14 }}>Display name</Label>
      <TextInput value={v.name} onChangeText={(name) => setV({ ...v, name: name.slice(0, 60) })} style={field} />
      <Label s={9.5} c={k.ink60} style={{ marginTop: 14 }}>Username</Label>
      <TextInput value={v.username} autoCapitalize="none" onChangeText={(username) => setV({ ...v, username: username.slice(0, 20) })} style={field} />
      <T s={12} c={ok ? k.ink45 : "#e5484d"} style={{ marginTop: 4 }}>3 to 20 letters, numbers or underscores.</T>
      <TextInput value={v.bio} multiline onChangeText={(bio) => setV({ ...v, bio: bio.slice(0, 300) })} placeholder="A line about you" placeholderTextColor={k.ink45} style={{ ...field, height: 90, paddingTop: 12, textAlignVertical: "top", marginTop: 14 }} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Pill kind="ghost" label="Cancel" h={44} style={{ flex: 1 }} onPress={onClose} />
        <Pill label="Save" h={44} style={{ flex: 1 }} disabled={!ok || !v.name.trim()} onPress={() => onSave(v)} />
      </View>
    </WSheet>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
