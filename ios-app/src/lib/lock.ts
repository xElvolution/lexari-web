/** App lock, backed by the server like webapp/components/lock/AppLock.tsx: the PIN is hashed and rate limited there. */
import { api } from "./api";

export const PIN_LENGTH = 4;
/** Ask again after this long away (web: 5 minutes). */
export const IDLE_MS = 5 * 60_000;

let unlockedAt = 0;
export const markUnlocked = () => { unlockedAt = Date.now(); };
export const wasUnlocked = () => unlockedAt > 0;
export const forgetUnlock = () => { unlockedAt = 0; };

/** POST /api/lock. Throws with the server's plain message ("That PIN isn't right.", "Too many tries..."). */
export async function verifyPin(pin: string, token: string) {
  await api("/api/lock", { method: "POST", body: JSON.stringify({ pin }) }, token);
}
/** PUT /api/lock. Changing an existing PIN needs the current one. */
export async function savePin(pin: string, token: string, current?: string) {
  await api<{ on: boolean }>("/api/lock", { method: "PUT", body: JSON.stringify({ pin, ...(current ? { current } : {}) }) }, token);
}
/** DELETE /api/lock. Turning the lock off needs the PIN. */
export async function removePin(pin: string, token: string) {
  await api<{ on: boolean }>("/api/lock", { method: "DELETE", body: JSON.stringify({ pin }) }, token);
}
