import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Title, Row, Face } from "@/components/ui";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { grape } from "@/theme/colors";

const links = [
  ["/settings/security", "Security"],
  ["/settings/secrets", "Secrets"],
  ["/settings/models", "Models"],
  ["/settings/billing", "Plans"],
  ["/settings/integrations", "Integrations"],
  ["/settings/notifications", "Notifications"],
  ["/brain", "Brain"],
  ["/team", "Team"],
  ["/tasks", "Tasks and meetings"],
  ["/miner", "ORE Miner"],
  ["/onboarding", "Tour"],
] as const;

export default function Me() {
  const { signOut, wallet } = useSession();
  const { theme, setTheme, palette } = usePrefs();
  return (
    <Screen>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Face color={grape} />
        <View>
          <Title>Me</Title>
          <Text style={{ color: palette.muted, fontSize: 11 }}>{wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "Signed in"}</Text>
        </View>
      </View>
      <ScrollView>
        {links.map(([href, label]) => <Row key={href} title={label} onPress={() => router.push(href)} />)}
        <Row title={`Theme · ${theme}`} detail="Light or dark" onPress={() => setTheme(theme === "dark" ? "light" : "dark")} />
        <Row title="Sign out" onPress={() => signOut().then(() => router.replace("/(auth)/sign-in"))} />
      </ScrollView>
    </Screen>
  );
}
