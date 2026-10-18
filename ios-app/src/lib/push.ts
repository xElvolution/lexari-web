/** Phone side of webapp/lib/notifications.ts: Expo push registered with POST /api/push/expo, removed with DELETE. */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Store from "@/lib/storage";
import { api } from "@/lib/api";

const KEY = "lexari.push.v1";
const CHANNELS = [
  ["approvals", "Approvals", Notifications.AndroidImportance.HIGH],
  ["receipts", "Receipts", Notifications.AndroidImportance.DEFAULT],
  ["replies", "Agent replies", Notifications.AndroidImportance.DEFAULT],
  ["tasks", "Meetings and tasks", Notifications.AndroidImportance.DEFAULT],
  ["quests", "Quests", Notifications.AndroidImportance.DEFAULT],
] as const;

export type Perm = "granted" | "denied" | "default" | "unsupported";

export async function pushPermission(): Promise<Perm> {
  if (Platform.OS === "web" || !Device.isDevice) return "unsupported";
  const p = await Notifications.getPermissionsAsync().catch(() => null);
  if (!p) return "unsupported";
  return p.granted ? "granted" : p.canAskAgain ? "default" : "denied";
}

/** True when this phone has a token registered with the server. */
export async function pushOnHere(): Promise<boolean> {
  if ((await pushPermission()) !== "granted") return false;
  return !!(await Store.getItem(KEY).catch(() => null));
}

export async function enablePush(token: string): Promise<{ ok: boolean; why?: string }> {
  if ((await pushPermission()) === "unsupported") return { ok: false, why: "This device can't show notifications." };
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return { ok: false, why: "Notifications are blocked. Allow them for Lexari in your phone's settings." };
  if (Platform.OS === "android") for (const [id, name, importance] of CHANNELS) await Notifications.setNotificationChannelAsync(id, { name, importance }).catch(() => {});
  const expo = await Notifications.getExpoPushTokenAsync().catch(() => null);
  const push = expo?.data;
  if (!push) return { ok: false, why: "This build can't get a push token yet." };
  try {
    await api("/api/push/expo", { method: "POST", body: JSON.stringify({ token: push, platform: "android", model: Device.modelName || "Android" }) }, token);
    await Store.setItem(KEY, push);
    return { ok: true };
  } catch { return { ok: false, why: "Couldn't reach Lexari. Try again." }; }
}

export async function disablePush(token: string): Promise<void> {
  const push = await Store.getItem(KEY).catch(() => null);
  if (push) await api("/api/push/expo", { method: "DELETE", body: JSON.stringify({ token: push }) }, token).catch(() => {});
  await Store.deleteItem(KEY).catch(() => {});
}
