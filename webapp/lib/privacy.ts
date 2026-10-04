"use client";

import { useSyncExternalStore } from "react";

/** Hide balances on this device (wallet and Hub). Remembered in localStorage. */
const KEY = "lexari-hide-balance";
const subs = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
export function setHideBalance(v: boolean) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {} subs.forEach((f) => f()); }
export function useHideBalance() {
  return useSyncExternalStore((f) => { subs.add(f); const st = (e: StorageEvent) => { if (e.key === KEY) f(); }; window.addEventListener("storage", st); return () => { subs.delete(f); window.removeEventListener("storage", st); }; }, read, () => false);
}
export const MASK = "••••";
