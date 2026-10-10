import { useLocalSearchParams, router } from "expo-router";
import { Pressable, Text } from "react-native";
import { Screen, Title, Face } from "@/components/ui";
import { grape } from "@/theme/colors";

export default function AgentDeepLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <Screen>
      <Face />
      <Title>{slug || "Agent"}</Title>
      <Pressable onPress={() => router.push(`/chat/${slug}`)}><Text style={{ color: grape, marginTop: 12 }}>Open chat</Text></Pressable>
    </Screen>
  );
}
