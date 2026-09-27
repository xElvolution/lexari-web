"use client";

import { useSyncExternalStore } from "react";

/** App-wide popups that any page can open: the agent panel (ID card + edit) and the add-agent chooser. */
type O = { agent: string | null; add: null | { mode: "choose" | "create" | "hire"; cat?: string } };
let o: O = { agent: null, add: null };
const subs = new Set<() => void>();
const emit = (n: O) => { o = n; subs.forEach((f) => f()); };
export const openAgent = (id: string) => emit({ ...o, agent: id });
export const closeAgent = () => emit({ ...o, agent: null });
export const openAdd = (mode: "choose" | "create" | "hire" = "choose", cat?: string) => emit({ ...o, add: { mode, cat } });
export const closeAdd = () => emit({ ...o, add: null });
const server: O = { agent: null, add: null };
export function useOverlays() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => o, () => server);
}
