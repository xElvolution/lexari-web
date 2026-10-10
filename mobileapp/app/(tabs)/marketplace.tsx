import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Title, Muted, Face } from "@/components/ui";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { api } from "@/lib/api";
import { ROSTER } from "@/content/roster";

type Hire = { slug: string };

export default function Marketplace() {
  const { token } = useSession();
  const { palette } = usePrefs();
  const [hired, setHired] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const rows = await api<Hire[]>("/api/hires", {}, token);
      setHired(new Set((Array.isArray(rows) ? rows : []).map((r) => r.slug)));
    } catch { setHired(new Set()); }
  }, [token]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  return (
    <Screen>
      <Title>Marketplace</Title>
      <Muted>Hires can be paid in SKR. You still approve the transfer on this phone.</Muted>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        {ROSTER.map((s) => (
          <Pressable key={s.slug} onPress={() => router.push(`/marketplace/${s.slug}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10 }}>
            <Face color={s.color} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "600" }}>{s.name}</Text>
              <Muted>{s.job} · {s.quip}</Muted>
            </View>
            <Text style={{ color: palette.muted, fontSize: 11 }}>{s.free ? "Free" : hired.has(s.slug) ? "Hired" : "Hire"}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
