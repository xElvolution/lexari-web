/** Plans open as the web's upgrade sheet over the current screen (web: Settings · Billing / "Upgrade plan" sheet). */
import { View } from "react-native";
import { router } from "expo-router";
import { UpgradeSheet } from "@/web/Plans";

export default function Billing() {
  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/settings"));
  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <UpgradeSheet open mode="plans" onClose={close} onTopUp={() => router.replace({ pathname: "/(tabs)/wallets", params: { topup: "1" } })} />
    </View>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
