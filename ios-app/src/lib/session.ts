import * as SecureStore from "./storage";

const KEY = "lexari.session.v1";

export type SavedSession = { token: string; expires: string; wallet?: string };

export async function loadSession(): Promise<SavedSession | null> {
  const raw = await SecureStore.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedSession;
    if (!parsed.token) return null;
    if (parsed.expires && Date.parse(parsed.expires) < Date.now()) {
      await SecureStore.deleteItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: SavedSession): Promise<void> {
  await SecureStore.setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItem(KEY);
}

const AUTH = "lexari.mwa.auth";
export async function loadAuthToken(): Promise<string | null> {
  return SecureStore.getItem(AUTH);
}
export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItem(AUTH, token);
}
