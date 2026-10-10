import { Linking, Pressable, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, Title, Muted } from "@/components/ui";
import { env } from "@/lib/env";
import { solscanTx } from "@/lib/network";

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const url = id && id !== "address" ? solscanTx(id, env.cluster) : "";
  return (
    <Screen>
      <Title>Receipt</Title>
      <Muted>{env.cluster === "mainnet-beta" ? "Real money · Solana mainnet" : "Testnet · not real money"}</Muted>
      {url ? <Pressable onPress={() => Linking.openURL(url)}><Text style={{ color: "#5b2bff", marginTop: 12, fontSize: 14 }}>{url}</Text></Pressable> : <Muted>Open a payment receipt from chat after it is signed.</Muted>}
    </Screen>
  );
}
