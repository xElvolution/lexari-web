import { StyleSheet, Text, View } from "react-native";
import { env } from "@/lib/env";
import { networkBadge } from "@/lib/network";

/** Thin TESTNET pill. Sits in screen headers, never a full-width bar. */
export function NetworkBanner() {
  const badge = networkBadge(env.cluster);
  if (badge.tone === "real") return null;
  return (
    <View accessibilityLabel="Testnet, not real money" style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(245,165,36,0.12)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(245,165,36,0.4)" }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#F5A524" }} />
      <Text style={{ color: "#F5C26B", fontSize: 9, fontWeight: "700", letterSpacing: 0.8 }}>TESTNET</Text>
    </View>
  );
}

