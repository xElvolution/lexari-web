import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Title, Muted } from "@/components/ui";
import { usePrefs } from "@/state/prefs";
import { PLANS } from "@/content/roster";
import { grape } from "@/theme/colors";
import { env } from "@/lib/env";
import { networkBadge } from "@/lib/network";

export default function Billing() {
  const { palette } = usePrefs();
  const badge = networkBadge(env.cluster);
  return (
    <Screen>
      <Title>Plans</Title>
      <Text style={{ color: badge.tone === "real" ? "#f5c542" : palette.brand, fontSize: 12 }}>{badge.label}</Text>
      <Muted>A plan can be paid in SKR. You sign the transfer. It is not staking.</Muted>
      {PLANS.map((p) => (
        <View key={p.id} style={{ marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line }}>
          <Text style={{ color: palette.ink, fontSize: 16, fontWeight: "700" }}>{p.name}{p.usd ? ` · $${p.usd}` : ""}</Text>
          {p.points.map((line) => <Muted key={line}>{line}</Muted>)}
          {p.usd > 0 ? (
            <Pressable onPress={() => router.push("/topup?coin=SKR")} style={{ marginTop: 8, backgroundColor: grape, borderRadius: 12, padding: 8 }}>
              <Text style={{ color: "#fff", textAlign: "center", fontSize: 13 }}>Pay in SKR</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}
