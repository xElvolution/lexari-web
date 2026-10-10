import { Pressable, Text, View } from "react-native";
import { usePrefs } from "@/state/prefs";
import { env } from "@/lib/env";
import { networkBadge } from "@/lib/network";
import { grape } from "@/theme/colors";

export function ConfirmCard({ title, amount, to, phrase, onReview }: {
  title: string; amount: string; to: string; phrase?: string; onReview: () => void;
}) {
  const { palette } = usePrefs();
  const badge = networkBadge(env.cluster);
  return (
    <View style={{ marginTop: 8, backgroundColor: palette.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: palette.line, gap: 4 }}>
      <Text style={{ color: badge.tone === "real" ? "#f5c542" : palette.brand, fontSize: 11 }}>{badge.label}</Text>
      <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: palette.ink, fontSize: 14 }}>{amount}</Text>
      <Text style={{ color: palette.muted, fontSize: 12 }}>To {to}</Text>
      {phrase ? <Text style={{ color: palette.ink, fontSize: 12 }}>Phrase: {phrase}</Text> : null}
      <Pressable onPress={onReview} style={{ marginTop: 6, backgroundColor: grape, borderRadius: 12, paddingVertical: 8 }}>
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 13 }}>Review</Text>
      </Pressable>
    </View>
  );
}
