import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Screen, Title, Muted, Loading, ErrorText, Money, Face } from "@/components/ui";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { api } from "@/lib/api";
import { biometricGate } from "@/components/Gates";
import { grape } from "@/theme/colors";

type Quest = { id: string; goal: number; progress: number; reward: number; claimed: boolean; period?: string };
type Hub = {
  player?: { coins: number; streak: number; checkedInToday: boolean; lifetime?: number } | null;
  quests?: Quest[];
  levels?: { slug: string; name: string; level: number; xp: number }[];
};

export default function Hub() {
  const { token } = useSession();
  const { palette } = usePrefs();
  const [hub, setHub] = useState<Hub | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try { setHub(await api<Hub>("/api/hub/state", {}, token)); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "The Hub did not load."); }
  }, [token]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const checkIn = async () => {
    if (!token || hub?.player?.checkedInToday) return;
    if (!(await biometricGate("Sign today's check-in"))) return;
    setBusy(true);
    try {
      await api("/api/hub/act", { method: "POST", body: JSON.stringify({ kind: "checkin" }) }, token);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Check-in failed.");
    } finally { setBusy(false); }
  };

  const claim = async (id: string) => {
    if (!token) return;
    if (!(await biometricGate("Claim this quest"))) return;
    try {
      await api("/api/hub/act", { method: "POST", body: JSON.stringify({ kind: "quest", id }) }, token);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "That quest was not claimed."); }
  };

  const level = hub?.levels?.[0];
  return (
    <Screen>
      <Title>Hub</Title>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />} contentContainerStyle={{ paddingBottom: 24 }}>
        {!hub && !err ? <Loading /> : null}
        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Face color={grape} mood="happy" />
          <View>
            <Money amount={hub?.player ? String(hub.player.coins) : "—"} unit="coins" />
            <Muted>Streak {hub?.player?.streak ?? 0} · {level ? `Lv ${level.level} ${level.name}` : "Your floor"}</Muted>
          </View>
        </View>
        <Pressable disabled={busy || !!hub?.player?.checkedInToday} onPress={checkIn} style={{ marginTop: 16, backgroundColor: hub?.player?.checkedInToday ? palette.tint : grape, borderRadius: 16, padding: 14 }}>
          <Text style={{ color: hub?.player?.checkedInToday ? palette.ink : "#fff", textAlign: "center", fontSize: 14, fontWeight: "700" }}>
            {hub?.player?.checkedInToday ? "Checked in today" : "Daily check-in"}
          </Text>
        </Pressable>
        <Text style={{ color: palette.ink, marginTop: 18, fontSize: 13, fontWeight: "700" }}>Quests</Text>
        {(hub?.quests || []).map((q) => {
          const ready = q.progress >= q.goal && !q.claimed;
          return (
            <Pressable key={q.id} disabled={!ready} onPress={() => claim(q.id)} style={{ marginTop: 8, padding: 12, borderRadius: 14, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line }}>
              <Text style={{ color: palette.ink, fontSize: 14 }}>{q.id}</Text>
              <Muted>{q.progress}/{q.goal} · {q.reward} coins · {q.claimed ? "claimed" : ready ? "Tap to claim" : "in progress"}</Muted>
            </Pressable>
          );
        })}
        {err ? <ErrorText text={err} /> : null}
      </ScrollView>
    </Screen>
  );
}
