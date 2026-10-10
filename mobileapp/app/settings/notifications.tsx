import { useState } from "react";
import { Pressable, Text } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Screen, Title, Muted, ErrorText } from "@/components/ui";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";
import { grape } from "@/theme/colors";

const channels = [
  ["approvals", "Approvals", Notifications.AndroidImportance.HIGH],
  ["receipts", "Receipts", Notifications.AndroidImportance.DEFAULT],
  ["replies", "Agent replies", Notifications.AndroidImportance.DEFAULT],
  ["tasks", "Meetings and tasks", Notifications.AndroidImportance.DEFAULT],
  ["quests", "Quests", Notifications.AndroidImportance.DEFAULT],
] as const;

export default function NotificationsScreen() {
  const { token } = useSession();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const enable = async () => {
    if (!token) return;
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) { setErr("Notifications are off."); return; }
    for (const [id, name, importance] of channels) {
      await Notifications.setNotificationChannelAsync(id, { name, importance });
    }
    const expo = await Notifications.getExpoPushTokenAsync().catch(() => null);
    const push = expo?.data;
    if (!push) { setErr("This build needs FCM credentials in EAS before a push token exists."); return; }
    try {
      await api("/api/push/expo", { method: "POST", body: JSON.stringify({ token: push, platform: "android", model: Device.modelName || "Android" }) }, token);
      setMsg("Registered. A tap opens the link. It never approves a payment.");
    } catch (e) { setErr(e instanceof Error ? e.message : "The server does not have Expo push yet."); }
  };

  return (
    <Screen>
      <Title>Notifications</Title>
      <Muted>Ask after the first agent exists. Approvals open the confirm sheet.</Muted>
      <Pressable onPress={enable} style={{ marginTop: 16, backgroundColor: grape, borderRadius: 12, padding: 12 }}><Text style={{ color: "#fff", textAlign: "center" }}>Register this phone</Text></Pressable>
      {msg ? <Muted>{msg}</Muted> : null}
      {err ? <ErrorText text={err} /> : null}
    </Screen>
  );
}
