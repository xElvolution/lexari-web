"use client";

import { useEffect, useSyncExternalStore } from "react";

/** Agent presence: online when the model can answer. Polled once a minute while the app is open. */
let online: boolean | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
async function poll() {
  try { const r = await fetch("/api/presence", { cache: "no-store" }); const j = await r.json(); online = !!j.online; }
  catch { online = navigator.onLine === false ? false : online; }
  emit();
}
export function setOffline() { online = false; emit(); }
export function usePresence() {
  const v = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => online, () => null);
  useEffect(() => {
    if (!timer) { void poll(); timer = setInterval(() => { if (!document.hidden) void poll(); }, 60_000); }
    const off = () => { online = false; emit(); }; const on = () => void poll();
    window.addEventListener("offline", off); window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);
  return v;
}
