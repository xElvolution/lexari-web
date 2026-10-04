"use client";

import { useSyncExternalStore } from "react";

/** App-wide popups that any page can open: the agent panel (ID card + edit) and the add-agent chooser. */
export type UpgradeWhy = "add" | "hire" | "full" | "plans";
type O = { agent: string | null; add: null | { mode: "choose" | "create" | "hire"; cat?: string }; upgrade: UpgradeWhy | null };
let o: O = { agent: null, add: null, upgrade: null };
const subs = new Set<() => void>();
const emit = (n: O) => { o = n; subs.forEach((f) => f()); };
export const openAgent = (id: string) => emit({ ...o, agent: id });
export const closeAgent = () => emit({ ...o, agent: null });
/** Opens "add an agent", or the upgrade sheet when the plan has no free seat. */
export const openAdd = (mode: "choose" | "create" | "hire" = "choose", cat?: string) => {
  if (seatGate && !seatGate()) { emit({ ...o, upgrade: "add" }); return; }
  emit({ ...o, add: { mode, cat } });
};
let seatGate: (() => boolean) | null = null;
export const setSeatGate = (f: () => boolean) => { seatGate = f; };
export const openUpgrade = (why: UpgradeWhy = "plans") => emit({ ...o, add: null, upgrade: why });
export const closeUpgrade = () => emit({ ...o, upgrade: null });
export const closeAdd = () => emit({ ...o, add: null });
const server: O = { agent: null, add: null, upgrade: null };
export function useOverlays() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => o, () => server);
}
