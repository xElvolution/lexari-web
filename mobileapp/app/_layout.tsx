import { Stack } from "expo-router";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PrivyProvider } from "@privy-io/expo";
import { PrefsProvider, usePrefs } from "@/state/prefs";
import { SessionProvider } from "@/state/session";
import { LockGate, NetworkBanner } from "@/components/Gates";
import { env } from "@/lib/env";

function Navigator() {
  const { palette } = usePrefs();
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <LockGate>
        <NetworkBanner />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }} />
      </LockGate>
    </View>
  );
}

export default function Root() {
  const nav = <Navigator />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrefsProvider>
          <SessionProvider>
            {env.privyOn ? <PrivyProvider appId={env.privyAppId} clientId={env.privyClientId || undefined}>{nav}</PrivyProvider> : nav}
          </SessionProvider>
        </PrefsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
