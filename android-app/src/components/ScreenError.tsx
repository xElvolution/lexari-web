/** Route error boundary (expo-router `ErrorBoundary` export): a screen that throws shows this instead of closing the app. */
import { Pressable, Text, View } from "react-native";
import { router, type ErrorBoundaryProps } from "expo-router";

export default function ScreenError({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) console.warn("screen error", error);
  const back = () => { if (router.canGoBack()) router.back(); else router.replace("/"); };
  return (
    <View accessibilityRole="alert" style={{ flex: 1, backgroundColor: "#0b0614", alignItems: "center", justifyContent: "center", padding: 28 }}>
      <Text style={{ fontFamily: "Figtree_800ExtraBold", fontSize: 22, color: "#fff", textAlign: "center" }}>This screen hit a snag</Text>
      <Text style={{ fontFamily: "Figtree_400Regular", fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 8 }}>The rest of the app is fine. Try again, or go back.</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
        <Pressable accessibilityRole="button" onPress={back} style={{ height: 48, paddingHorizontal: 22, borderRadius: 24, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", justifyContent: "center" }}><Text style={{ fontFamily: "Figtree_700Bold", fontSize: 15, color: "#fff" }}>Go back</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void retry()} style={{ height: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: "#6b3cff", justifyContent: "center" }}><Text style={{ fontFamily: "Figtree_700Bold", fontSize: 15, color: "#fff" }}>Try again</Text></Pressable>
      </View>
    </View>
  );
}
