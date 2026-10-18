import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PrivyRoot } from "@/lib/privyRoot";
import { PrefsProvider, usePrefs } from "@/state/prefs";
import { SessionProvider } from "@/state/session";
import { LockGate } from "@/components/Gates";
import StepUpSheet from "@/components/StepUpSheet";
import { PrivacySync } from "@/lib/privacy";
import Tour from "@/components/Tour";
import { env } from "@/lib/env";
import { DataProvider } from "@/web/data";
import { Toaster } from "@/web/anim";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { setUserAgent } from "@/lib/api";
import { userAgent } from "@/lib/device";

// every API call names the app and the phone (the server spots Seeker and Saga from it)
setUserAgent(userAgent(Constants.expoConfig?.version || "1.0.0", Device.modelName || "Android"));
import { useFonts } from "expo-font";
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold } from "@expo-google-fonts/figtree";
import { MartianMono_400Regular, MartianMono_500Medium } from "@expo-google-fonts/martian-mono";

function Navigator() {
  const { palette, isDark } = usePrefs();
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <LockGate>
        <Stack screenOptions={{ headerShown: false, animation: "fade_from_bottom", contentStyle: { backgroundColor: palette.bg } }}>
          <Stack.Screen name="index" options={{ animation: "none", contentStyle: { backgroundColor: "#14072e" } }} />
          <Stack.Screen name="settings/billing" options={{ presentation: "transparentModal", animation: "fade", contentStyle: { backgroundColor: "transparent" } }} />
          <Stack.Screen name="welcome" options={{ animation: "fade", contentStyle: { backgroundColor: "#14072e" } }} />
          <Stack.Screen name="(auth)/sign-in" options={{ animation: "fade", contentStyle: { backgroundColor: "#14072e" } }} />
          <Stack.Screen name="security-setup" options={{ animation: "fade", contentStyle: { backgroundColor: "#14072e" } }} />
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="chat/[slug]" options={{ animation: "slide_from_right" }} />
        </Stack>
        <Tour />
        <StepUpSheet />
        <PrivacySync />
        <Toaster />
      </LockGate>
    </View>
  );
}

export default function Root() {
  // display type is the web's Bricolage Grotesque: 96pt ExtraBold at width 88 ("wdth" 88 in webapp CSS), instanced from the variable font
  const [fonts] = useFonts({ Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold, BricolageGrotesque_800ExtraBold: require("../assets/fonts/BricolageGrotesque-ExtraBold-wdth88.ttf"), MartianMono_400Regular, MartianMono_500Medium });
  const nav = fonts ? <Navigator /> : <View style={{ flex: 1, backgroundColor: "#000" }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
      <SafeAreaProvider>
        <PrefsProvider>
          <SessionProvider>
          <DataProvider>
            <PrivyRoot appId={env.privyAppId} clientId={env.privyClientId}>{nav}</PrivyRoot>
          </DataProvider>
          </SessionProvider>
        </PrefsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
