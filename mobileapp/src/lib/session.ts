import * as SecureStore from "expo-secure-store";

const KEY = "lexari.session.v1";

export type SavedSession = { token: string; expires: string; wallet?: string };

export async function loadSession(): Promise<SavedSession | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedSession;
    if (!parsed.token) return null;
    if (parsed.expires && Date.parse(parsed.expires) < Date.now()) {
      await SecureStore.deleteItemAsync(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: SavedSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

const AUTH = "lexari.mwa.auth";
export async function loadAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH);
}
export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH, token);
}
