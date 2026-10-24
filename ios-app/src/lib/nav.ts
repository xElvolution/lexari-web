import { router } from "expo-router";

export type SettingsSection = "general" | "personal" | "agents" | "models" | "notifications" | "data" | "security" | "accounts" | "social" | "wallets" | "integrations" | "secrets" | "billing" | "about";

/**
 * Open one Settings section directly (the web's /settings#social). `at` changes on every call so the
 * Settings tab opens the section again even when it is already mounted with the same `sec`.
 */
export function openSettings(sec: SettingsSection) {
  router.navigate({ pathname: "/(tabs)/settings", params: { sec, at: String(Date.now()) } });
}

/** Open the "Add an agent." sheet on the Agents tab (the web's openAdd()). `at` reopens it on repeat taps. */
export function openAdd() {
  router.navigate({ pathname: "/(tabs)/agents", params: { add: "1", at: String(Date.now()) } });
}
