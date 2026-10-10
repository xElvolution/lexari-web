import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { Screen, Title, Muted } from "@/components/ui";
import { grape } from "@/theme/colors";

const steps = [
  "Sign in with Seed Vault, Phantom, or Google.",
  "Check in on the Hub.",
  "Chat with an agent and approve a Confirm card.",
  "Top up with SKR. It is a payment, not staking.",
  "Lock the app with biometrics and hide balances.",
];

export default function Onboarding() {
  return (
    <Screen>
      <Title>Welcome</Title>
      {steps.map((s) => <Muted key={s}>{s}</Muted>)}
      <Pressable onPress={() => router.replace("/(tabs)/hub")} style={{ marginTop: 16, backgroundColor: grape, borderRadius: 12, padding: 12 }}>
        <Text style={{ color: "#fff", textAlign: "center" }}>Go to the Hub</Text>
      </Pressable>
    </Screen>
  );
}
