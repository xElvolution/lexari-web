import { useEffect, useState } from "react";
import { AppState, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { openSettings, type SettingsSection } from "@/lib/nav";
import Icon from "@/components/Icon";
import { F, GRAPE, Round, useC } from "@/web/kit";
import { toast } from "@/web/anim";
import { enablePush, pushOnHere, pushPermission } from "@/lib/push";
import { Skeleton, T } from "./ui";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";

type Item = { id: string; kind?: string; title: string; body?: string; url?: string; read: boolean; at: number };

function ago(at: number) {
  const m = Math.max(1, Math.round((Date.now() - at) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

const KIND: Record<string, string> = { quest: "star", box: "box", hire: "team", payment: "check", card: "wallet", reply: "chat", faucet: "wallet", mail: "mail", security: "lock" };

function go(url?: string) {
  if (!url) return;
  if (url.startsWith("/agents/")) router.push(`/chat/${url.slice("/agents/".length)}`);
  else if (url.startsWith("/marketplace/")) router.push(url);
  else if (url.startsWith("/wallets")) router.navigate({ pathname: "/(tabs)/wallets", params: /tab=cards/.test(url) ? { tab: "cards" } : {} });
  else if (url.startsWith("/settings")) { const sec = url.split("#")[1]; if (sec) openSettings(sec as SettingsSection); else router.push("/(tabs)/settings"); }
  else if (url.startsWith("/hub")) router.push("/(tabs)/hub");
  else if (url.startsWith("/team")) router.push("/(tabs)/team");
  else if (url.startsWith("/brain")) router.push("/(tabs)/brain");
  else router.push("/(tabs)/agents");
}

/** Bell with an unread badge. Opens the same notification card the phone website drops down, not a bottom sheet. */
export function NotifyBell() {
  const { token } = useSession();
  const { palette } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [canPush, setCanPush] = useState(false);
  const k = useC();

  const load = async () => {
    if (!token) return;
    try { const r = await api<{ unread: number; items: Item[] }>("/api/notifications", {}, token); setItems(r.items || []); setUnread(r.unread || 0); }
    catch { setItems([]); }
  };
  useEffect(() => { load().catch(() => {}); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  // web: refreshes every 45s while the app is in front, and when you come back to it
  useEffect(() => {
    const t = setInterval(() => { if (AppState.currentState === "active") load().catch(() => {}); }, 45_000);
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") load().catch(() => {}); });
    return () => { clearInterval(t); sub.remove(); };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) return; pushOnHere().then(setPushOn, () => setPushOn(null)); pushPermission().then((p) => setCanPush(p !== "unsupported"), () => setCanPush(false)); }, [open]);

  const read = (ids?: string[]) => {
    setItems((cur) => (cur || []).map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((n) => (ids ? Math.max(0, n - ids.length) : 0));
    if (token) api("/api/notifications", { method: "POST", body: JSON.stringify(ids ? { ids } : {}) }, token).catch(() => {});
  };

  return (
    <>
      <Round label={unread ? `Notifications, ${unread} new` : "Notifications"} icon="bell" badge={unread ? (unread > 9 ? "9+" : String(unread)) : undefined} onPress={() => { setOpen(true); load().catch(() => {}); }} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable accessibilityLabel="Close notifications" onPress={() => setOpen(false)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.28)" }} />
          <View style={{ position: "absolute", top: insets.top + 62, right: 12, width: Math.min(360, width - 24), maxHeight: Math.min(560, height - insets.top - 120), borderRadius: 22, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
              <Text style={{ color: palette.ink, fontSize: 16, fontFamily: F.bold }}>Notifications</Text>
              {unread > 0 ? <Pressable onPress={() => read()}><Text style={{ color: k.brandInk, fontSize: 12.5, fontFamily: F.semi }}>Mark all read</Text></Pressable> : null}
            </View>
            {pushOn === false && canPush ? (
              <Pressable accessibilityRole="button" onPress={async () => { if (!token) return; const r = await enablePush(token); toast(r.ok ? "Notifications are on for this device" : r.why || "Couldn't turn on notifications"); setPushOn(r.ok); }} style={{ marginHorizontal: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: palette.tint, paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="bell" size={16} color="#fff" /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: palette.ink, fontSize: 13, fontFamily: F.semi }}>Get notified on this device</Text>
                  <Text style={{ color: palette.muted, fontSize: 11.5, fontFamily: F.sans }}>Replies, rewards and payments, even when Lexari is closed.</Text>
                </View>
                <Text style={{ color: k.brandInk, fontSize: 12, fontFamily: F.bold }}>Turn on</Text>
              </Pressable>
            ) : null}
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}>
              {items === null ? <View style={{ gap: 10, padding: 8 }}><Skeleton h={56} r={16} /><Skeleton h={56} r={16} /></View> : null}
              {items?.length === 0 ? <Text style={[T.body, { color: palette.muted, textAlign: "center", paddingVertical: 36, paddingHorizontal: 16 }]}>Nothing yet. Quests, boxes, hires and payments show up here.</Text> : null}
              {(items || []).map((n) => (
                <Pressable key={n.id} onPress={() => { setOpen(false); if (!n.read) read([n.id]); go(n.url); }} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: n.read ? "transparent" : palette.tint }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: n.read ? palette.alt : "#5b2bff" }}>
                    <Icon name={(n.kind && KIND[n.kind]) || "bell"} size={16} color={n.read ? palette.muted : "#fff"} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                      <Text style={{ flex: 1, color: palette.ink, fontSize: 13.5, fontFamily: F.semi }} numberOfLines={1}>{n.title}</Text>
                      <Text style={{ color: palette.muted, fontSize: 11, fontFamily: F.sans }}>{ago(n.at)}</Text>
                    </View>
                    {n.body ? <Text style={{ color: palette.muted, fontSize: 12.5, lineHeight: 17, marginTop: 2, fontFamily: F.sans }} numberOfLines={2}>{n.body}</Text> : null}
                  </View>
                  {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 8, backgroundColor: "#5b2bff" }} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
