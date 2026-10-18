import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { usePrefs } from "@/state/prefs";
import { Pill, T, useC } from "@/web/kit";

/** Port of webapp/components/security/PasskeyPrompt.tsx: "Add a passkey" once, right after a new account. */
export default function PasskeyPrompt() {
  const k = useC();
  const { passkeyAsk, dismissPasskey } = usePrefs();
  if (!passkeyAsk) return null;
  return (
    <View style={{ margin: 16, borderRadius: 20, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 14, gap: 8 }}>
      <T f="bold" s={15}>Add a passkey</T>
      <T s={13} c={k.ink60}>Sign in faster next time. Link a passkey to this account in Settings, Security.</T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pill label="Add a passkey" h={40} style={{ flex: 1 }} onPress={() => { dismissPasskey(); router.navigate({ pathname: "/(tabs)/settings", params: { sec: "security" } }); }} />
        <Pressable onPress={dismissPasskey} style={{ justifyContent: "center", paddingHorizontal: 12 }}><T f="bold" s={13} c={k.ink60}>Not now</T></Pressable>
      </View>
    </View>
  );
}
