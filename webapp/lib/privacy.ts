"use client";

import { useSyncExternalStore } from "react";

/**
 * Hide balances (the eye icon): your Lexari balance, agent wallets, history amounts, card spend and Hub coins show ••••.
 * Saved to your account (prefs.hideBalance) so it follows you to every device, and cached in localStorage so the
 * first paint is already hidden.
 */
const KEY = "lexari-hide-balance";
const subs = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const local = (v: boolean) => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {} subs.forEach((f) => f()); };
/** From the account on load: the saved choice wins over this device's cache. */
export function applyServerHide(v: unknown) { if (typeof v === "boolean" && v !== read()) local(v); }
export function setHideBalance(v: boolean) {
  local(v);
  // saved for the account; a failure only means other devices don't follow yet
  void fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ prefs: { hideBalance: v } }) }).catch(() => {});
}
export function useHideBalance() {
  return useSyncExternalStore((f) => { subs.add(f); const st = (e: StorageEvent) => { if (e.key === KEY) f(); }; window.addEventListener("storage", st); return () => { subs.delete(f); window.removeEventListener("storage", st); }; }, read, () => false);
}
export const MASK = "••••";
/** `mask(text)` is •••• while balances are hidden. */
export function useMask() {
  const hide = useHideBalance();
  return (s: string | number) => (hide ? MASK : String(s));
}
