import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Screen, Title, Muted, ErrorText } from "@/components/ui";
import { useSession } from "@/state/session";
import { env } from "@/lib/env";
import { networkBadge, solscanTx } from "@/lib/network";
import { api } from "@/lib/api";
import { biometricGate } from "@/components/Gates";
import { grape } from "@/theme/colors";

export default function Confirm() {
  const { id, payload, phrase } = useLocalSearchParams<{ id: string; payload?: string; phrase?: string }>();
  const { token } = useSession();
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");
  let body: Record<string, unknown> = {};
  try { body = payload ? JSON.parse(payload) as Record<string, unknown> : {}; } catch { body = {}; }
  const badge = networkBadge(env.cluster);

  const approve = async () => {
    if (!token) return;
    const ok = await biometricGate("Approve this payment");
    if (!ok) return;
    setErr("Sign the transaction in your wallet. This screen never approves by itself.");
    try {
      const res = await api<{ signature?: string; tx?: string }>("/api/tx", { method: "POST", body: JSON.stringify({ id, ...body, client: "mobile" }) }, token);
      const found = res.signature || res.tx || "";
      if (found) {
        setSig(found);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/receipt/${found}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The payment was not sent.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <Screen>
      <Title>Confirm</Title>
      <Muted>{badge.label}</Muted>
      {phrase ? <Text style={{ marginTop: 8, fontSize: 13 }}>Phrase: {phrase}</Text> : <Muted>Your security phrase appears here when Settings has one.</Muted>}
      <Text style={{ marginTop: 12, fontSize: 13 }}>{JSON.stringify(body).slice(0, 400)}</Text>
      <Pressable onPress={approve} style={{ marginTop: 16, backgroundColor: grape, borderRadius: 14, padding: 12 }}>
        <Text style={{ color: "#fff", textAlign: "center" }}>Approve</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={{ marginTop: 8 }}><Text style={{ textAlign: "center" }}>Cancel</Text></Pressable>
      {sig ? <Muted>{solscanTx(sig, env.cluster)}</Muted> : null}
      {err ? <ErrorText text={err} /> : null}
    </Screen>
  );
}
