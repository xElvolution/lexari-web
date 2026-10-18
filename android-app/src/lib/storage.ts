import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Key/value store. Native uses the OS keystore (expo-secure-store).
 * Expo web has no SecureStore, so the browser preview falls back to localStorage.
 */
const web = Platform.OS === "web";

function ls(): Storage | null {
  try { return typeof window !== "undefined" && window.localStorage ? window.localStorage : null; } catch { return null; }
}

export async function getItem(key: string): Promise<string | null> {
  if (web) return ls()?.getItem(key) ?? null;
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (web) { ls()?.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (web) { ls()?.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}
