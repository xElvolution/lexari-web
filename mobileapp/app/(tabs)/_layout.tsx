import { Tabs } from "expo-router";
import { Bot, Compass, Store, User, Wallet } from "lucide-react-native";
import { usePrefs } from "@/state/prefs";
import { grape } from "@/theme/colors";

export default function TabsLayout() {
  const { palette } = usePrefs();
  const icon = (Icon: typeof Bot) => ({ color, size }: { focused: boolean; color: string | { toString(): string }; size: number }) => (
    <Icon color={typeof color === "string" ? color : grape} size={size} />
  );
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarShowLabel: false, tabBarActiveTintColor: grape, tabBarInactiveTintColor: palette.muted, tabBarStyle: { backgroundColor: palette.card, borderTopColor: palette.line } }}>
      <Tabs.Screen name="hub" options={{ title: "Hub", tabBarIcon: icon(Compass), tabBarAccessibilityLabel: "Hub" }} />
      <Tabs.Screen name="agents" options={{ title: "Agents", tabBarIcon: icon(Bot), tabBarAccessibilityLabel: "Agents" }} />
      <Tabs.Screen name="marketplace" options={{ title: "Marketplace", tabBarIcon: icon(Store), tabBarAccessibilityLabel: "Marketplace" }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet", tabBarIcon: icon(Wallet), tabBarAccessibilityLabel: "Wallet" }} />
      <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: icon(User), tabBarAccessibilityLabel: "Me" }} />
    </Tabs>
  );
}
