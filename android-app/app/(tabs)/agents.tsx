/** Port of the web /agents phone view: AgentStrip (tiles with rings, Add, Search) + ConvoList (Chats, Messages, New group chat). */
import { UpgradeSheet } from "@/web/Plans";
import { useState } from "react";
import PasskeyPrompt from "@/components/PasskeyPrompt";
import { Linking, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { TourTarget } from "@/components/Tour";
import { AgentTile, F, Label, Pill, T, WSheet, ringOf, useC } from "@/web/kit";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { nameOf, primaryOf, useData, withHello, type Chat, type Me, type Msg } from "@/web/data";

function shortTime(ms: number, now: number) {
  if (!ms) return "";
  const d = new Date(ms), days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 864e5);
  if (days <= 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
function preview(m: Msg | undefined, me: Me | null, group: boolean) {
  if (!m) return "Say hi";
  const who = m.from === "you" ? "You: " : group && m.from !== "system" ? `${nameOf(me, m.from)}: ` : "";
  const body = m.call ? `Voice call · ${fmtSecs(m.call)}` : m.voice ? `Voice note · ${fmtSecs(m.voice)}` : m.file && !m.text ? `Sent ${m.file.name}` : m.text || "";
  return who + body.replace(/\s+/g, " ");
}

export default function Agents() {
  const k = useC();
  const { me, reload } = useData();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState(false);
  const [add, setAdd] = useState(false);
  const full = (me?.agents ?? []).filter((a) => !(a.meta as { free?: boolean } | undefined)?.free).length >= (me?.plan.seats ?? 1);
  const [group, setGroup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const now = Date.now();
  const primary = primaryOf(me);
  const agents = (me?.agents ?? []).slice().sort((a, b) => (a.slug === primary ? -1 : b.slug === primary ? 1 : (a.createdAt ?? 0) - (b.createdAt ?? 0)));
  const list = q.trim() ? agents.filter((a) => `${a.name} ${a.role}`.toLowerCase().includes(q.trim().toLowerCase())) : agents;
  const chats = me?.chats ?? [];
  const lastOf = (c?: Chat, slug = "") => { const m = withHello(me, slug, c?.messages ?? []); return m[m.length - 1]; };
  const convos = [
    ...agents.map((a) => { const c = chats.find((x) => x.slug === a.slug); return { id: a.slug, group: false, name: a.name, members: [a.slug], last: lastOf(c, a.slug), at: lastOf(c, a.slug)?.at ?? 0 }; }),
    ...chats.filter((c) => c.kind === "group").map((c) => ({ id: c.slug, group: true, name: c.title, members: c.members, last: lastOf(c), at: lastOf(c)?.at ?? c.createdAt ?? 0 })),
  ].sort((a, b) => (a.id === "home" && !a.last ? -1 : 0) || b.at - a.at);
  const look = (slug: string) => me?.agents.find((a) => a.slug === slug)?.look;

  return (
    <View style={{ flex: 1 }}>
      <PasskeyPrompt />
      <View style={{ flexDirection: "row", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: k.line, paddingHorizontal: 12, paddingVertical: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }}>
          {list.map((a) => (
            <TourTarget key={a.slug} id={`tile-${a.slug}`}>
              <Pressable onPress={() => router.push(`/chat/${a.slug}`)} style={{ width: 70, alignItems: "center", gap: 6, paddingTop: 6 }}>
                <View style={{ padding: 3 }}><AgentTile slug={a.slug} look={a.look} size={50} ring={ringOf(a.slug, a.kind, primary)} /></View>
                <T f="semi" s={12.5} c={k.ink60} lines={1}>{a.name}</T>
              </Pressable>
            </TourTarget>
          ))}
          {q && !list.length ? <T s={14} c={k.ink60} style={{ alignSelf: "center", paddingHorizontal: 12 }}>{`No agent matches “${q}”.`}</T> : null}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 4, borderLeftWidth: 1, borderLeftColor: k.line, paddingLeft: 8 }}>
          <Pressable accessibilityLabel="Add an agent" onPress={() => setAdd(true)} style={{ width: 60, alignItems: "center", gap: 6, paddingTop: 6 }}>
            <View style={{ padding: 3 }}><View style={{ width: 50, height: 50, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: k.dark ? "rgba(255,255,255,0.3)" : "rgba(10,10,10,0.3)", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={22} color={k.ink75} /></View></View>
            <T f="semi" s={12.5} c={k.ink60}>Add</T>
          </Pressable>
          {search ? (
            <View style={{ alignItems: "center", gap: 6, paddingTop: 6 }}>
              <View style={{ marginTop: 3, height: 50, width: 190, borderRadius: 16, backgroundColor: k.tint, borderWidth: 2, borderColor: "#5b2bff", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 }}>
                <Icon name="search" size={17} color={k.brandInk} />
                <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Find an agent" placeholderTextColor={k.ink45} style={{ flex: 1, color: k.ink, fontFamily: F.sans, fontSize: 15 }} />
                <Pressable accessibilityLabel="Close search" onPress={() => { setSearch(false); setQ(""); }}><Icon name="x" size={14} color={k.ink60} /></Pressable>
              </View>
              <T f="semi" s={12.5} c={k.ink60}>{q ? `${list.length} of ${agents.length}` : `${agents.length} agent${agents.length === 1 ? "" : "s"}`}</T>
            </View>
          ) : (
            <Pressable accessibilityLabel="Search agents" onPress={() => setSearch(true)} style={{ width: 60, alignItems: "center", gap: 6, paddingTop: 6 }}>
              <View style={{ padding: 3 }}><View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="search" size={21} color={k.ink75} /></View></View>
              <T f="semi" s={12.5} c={k.ink60}>Search</T>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={k.ink} />}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          <T f="display" s={24} style={{ letterSpacing: -1.1 }}>Chats</T>
          <Pressable accessibilityLabel="New group" onPress={() => setGroup(true)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}><Icon name="groupadd" size={20} color={k.ink75} /></Pressable>
        </View>
        <Label s={9} c={k.ink45} style={{ paddingHorizontal: 20, paddingBottom: 6, paddingTop: 8 }}>Messages</Label>
        <View style={{ paddingHorizontal: 10 }}>
          {convos.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}`)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: pressed ? k.tint : "transparent" })}>
              {c.group ? <GroupTile members={c.members} look={look} /> : <AgentTile slug={c.id} look={look(c.id)} size={44} ring={ringOf(c.id, me?.agents.find((a) => a.slug === c.id)?.kind, primary)} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}><T f="bold" s={15} lines={1}>{c.name}</T>{c.group ? <Icon name="users" size={13} color={k.ink45} /> : null}</View>
                  <Label s={8.5} c={k.ink45}>{c.last ? shortTime(c.last.at, now) : ""}</Label>
                </View>
                <T s={13.5} c={k.ink60} lines={1}>{preview(c.last, me, c.group)}</T>
              </View>
            </Pressable>
          ))}
          <Pressable onPress={() => setGroup(true)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 10, paddingVertical: 10, marginTop: 4 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 2, borderStyle: "dashed", borderColor: k.dark ? "rgba(255,255,255,0.25)" : "rgba(10,10,10,0.25)", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={18} color={k.ink60} /></View>
            <T f="semi" s={14.5} c={k.ink60}>New group chat</T>
          </Pressable>
        </View>
      </ScrollView>

      <UpgradeSheet open={add && full} mode="seats" onClose={() => setAdd(false)} />
      <WSheet open={add && !full} title="Add an agent." onClose={() => setAdd(false)}>
        <T s={13.5} c={k.ink60}>Make your own from scratch, or hire a specialist someone else built.</T>
        {[
          { icon: "plus", title: "Create an agent", body: "Name it, tell it what to do, pick its face and personality.", cta: "Start building", go: () => Linking.openURL("https://app.lexari.ai/agents?add=create") },
          { icon: "market", title: "Hire an agent", body: "Tell us what you need and get three picks from the marketplace.", cta: "Get recommendations", go: () => router.navigate("/(tabs)/marketplace") },
        ].map((o) => (
          <Pressable key={o.title} onPress={() => { setAdd(false); o.go(); }} style={{ marginTop: 12, borderRadius: 18, backgroundColor: k.tint, padding: 14, borderWidth: 1, borderColor: k.line }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#5b2bff", alignItems: "center", justifyContent: "center" }}><Icon name={o.icon} size={19} color="#fff" /></View>
            <T f="bold" s={16} style={{ marginTop: 10 }}>{o.title}</T>
            <T s={13} c={k.ink60} style={{ marginTop: 2 }}>{o.body}</T>
            <T f="bold" s={13.5} c={k.brandInk} style={{ marginTop: 8 }}>{`${o.cta} →`}</T>
          </Pressable>
        ))}
      </WSheet>
      <GroupSheet open={group} onClose={() => setGroup(false)} />
    </View>
  );
}

function GroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const k = useC();
  const { token } = useSession();
  const { me, reload } = useData();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const agents = me?.agents ?? [];
  const create = async () => {
    if (!token || picked.length < 2) return; setBusy(true);
    const id = `g-${Math.random().toString(36).slice(2, 12)}`; const title = name.trim().slice(0, 60) || "New group";
    try {
      await api("/api/chats", { method: "POST", body: JSON.stringify({ slug: id, title, members: picked }) }, token);
      await api("/api/messages", { method: "POST", body: JSON.stringify({ convo: id, clientId: id, from: "system", text: `You made the group “${title}”` }) }, token).catch(() => {});
      await reload(); onClose(); setName(""); setPicked([]); router.push(`/chat/${id}`);
    } finally { setBusy(false); }
  };
  return (
    <WSheet open={open} title="New group" onClose={onClose}>
      <Label s={9} c={k.ink45}>Group name</Label>
      <TextInput value={name} onChangeText={setName} placeholder="Launch crew" placeholderTextColor={k.ink45} style={{ marginTop: 6, height: 48, borderRadius: 14, backgroundColor: k.tint, paddingHorizontal: 14, color: k.ink, fontFamily: F.semi, fontSize: 15 }} />
      <Label s={9} c={k.ink45} style={{ marginTop: 16 }}>Add agents</Label>
      {agents.length < 2 ? <T s={13} c={k.ink60} style={{ marginTop: 6 }}>Add another agent with the + on the Agents page to start a group.</T> : null}
      <View style={{ marginTop: 6, gap: 6 }}>
        {agents.map((a) => { const on = picked.includes(a.slug); return (
          <Pressable key={a.slug} onPress={() => setPicked((p) => (on ? p.filter((x) => x !== a.slug) : [...p, a.slug]))} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 14, backgroundColor: on ? "rgba(91,43,255,0.15)" : k.tint, borderWidth: 1, borderColor: on ? "#5b2bff" : k.line }}>
            <AgentTile slug={a.slug} look={a.look} size={36} dot={false} />
            <T f="bold" s={14.5} style={{ flex: 1 }}>{a.name}</T>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? "#5b2bff" : "transparent", borderWidth: on ? 0 : 1.5, borderColor: k.ink45, alignItems: "center", justifyContent: "center" }}>{on ? <Icon name="check" size={13} stroke={3} color="#fff" /> : null}</View>
          </Pressable>
        ); })}
      </View>
      <Pill label={busy ? "Creating…" : "Create group"} h={48} style={{ marginTop: 14 }} disabled={busy || picked.length < 2} onPress={create} />
    </WSheet>
  );
}

function GroupTile({ members, look, size = 44 }: { members: string[]; look: (s: string) => unknown; size?: number }) {
  const k = useC();
  const m = members.slice(0, 2); const sub = Math.round(size * 0.66); const extra = members.length - 2;
  return (
    <View style={{ width: size, height: size }}>
      {m.map((id, i) => <View key={id} style={{ position: "absolute", left: i ? size - sub : 0, top: i ? size - sub : 0, borderRadius: Math.round(sub * 0.34), borderWidth: i ? 2 : 0, borderColor: k.bg }}><AgentTile slug={id} look={look(id)} size={sub} dot={false} /></View>)}
      {extra > 0 ? <View style={{ position: "absolute", right: -2, top: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: k.ink, alignItems: "center", justifyContent: "center" }}><T f="bold" s={9} c={k.bg}>{`+${extra}`}</T></View> : null}
    </View>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
