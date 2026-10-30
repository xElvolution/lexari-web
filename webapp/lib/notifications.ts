"use client";
import { useSyncExternalStore } from "react";
import { api } from "./api";
import { moneyChanged, startMoneySync } from "./money";

export type Notice = { id: string; kind: string; title: string; body: string; url: string; read: boolean; at: number };
type S = { items: Notice[]; unread: number; loaded: boolean };
let state: S = { items: [], unread: 0, loaded: false };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };
export const useNotices = () => useSyncExternalStore(subscribe, () => state, () => state);

export async function loadNotices() {
  try {
    const r = await api<{ items: Notice[]; unread: number }>("/api/notifications");
    // A payment notice we haven't seen (a top up confirmed by a webhook, a plan, a hire): balances refetch.
    const fresh = state.loaded && r.items.some((n) => n.kind === "payment" && !state.items.some((o) => o.id === n.id));
    state = { items: r.items, unread: r.unread, loaded: true }; emit();
    if (fresh) moneyChanged();
  } catch { /* signed out or offline */ }
}

export async function markRead(ids?: string[]) {
  state = { ...state, items: state.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)), unread: ids ? state.items.filter((n) => !n.read && !ids.includes(n.id)).length : 0 }; emit();
  try { await api("/api/notifications", { method: "POST", body: ids ? { ids } : {} }); } catch {}
}

/* ---------- web push ---------- */
/** The Lexari desktop app (Electron) has no web push service, so pushManager.subscribe always fails there.
 *  It shows native notifications itself instead (the shell polls the bell), and this switch lives in a cookie it reads. */
export const isDesktopApp = () => typeof navigator !== "undefined" && /LexariDesktop\//.test(navigator.userAgent);
const DESKTOP_COOKIE = "lexari_desktop_notify";
const desktopOn = () => typeof document !== "undefined" && !document.cookie.split("; ").includes(`${DESKTOP_COOKIE}=off`);
const setDesktop = (on: boolean) => { document.cookie = `${DESKTOP_COOKIE}=${on ? "on" : "off"}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`; };

export const pushSupported = () => typeof window !== "undefined" && "Notification" in window && (isDesktopApp() || ("serviceWorker" in navigator && "PushManager" in window));
export const pushPermission = (): NotificationPermission | "unsupported" => (pushSupported() ? Notification.permission : "unsupported");

let reg: Promise<ServiceWorkerRegistration | null> | null = null;
export function registerSW() {
  if (!pushSupported() || isDesktopApp()) return Promise.resolve(null);
  reg ??= navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
  return reg;
}

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
/** True when a saved subscription was made with a different server key (the keys changed): it can never receive our pushes. */
function staleKey(sub: PushSubscription, key: string) {
  const had = sub.options?.applicationServerKey;
  if (!had) return false;
  const a = new Uint8Array(had), b = keyBytes(key);
  return a.length !== b.length || a.some((x, i) => x !== b[i]);
}

/** Asks the browser for permission (only call from a tap), subscribes, and saves it. */
export async function enablePush(test = true): Promise<{ ok: boolean; why?: string }> {
  try { return await enablePushInner(test); } catch (e) {
    const m = `${(e as Error)?.name || ""} ${(e as Error)?.message || ""}`;
    if (typeof console !== "undefined") console.warn("[push] enable failed:", m);
    // e.g. "Registration failed - permission denied" (push service blocked, as in Brave or some Android browsers): a plain message, not an error.
    if (/permission|denied|NotAllowed/i.test(m)) return { ok: false, why: "This browser blocked notifications for Lexari. Allow them in your browser's site settings (in Brave, turn on Google push messaging), then try again." };
    if (/push service|AbortError/i.test(m)) return { ok: false, why: "This browser has no push service for Lexari. Try Chrome, Edge, Firefox or Safari, or the Lexari desktop app." };
    return { ok: false, why: "Couldn't turn on notifications on this device. Reload and try again." };
  }
}
async function enablePushInner(test: boolean): Promise<{ ok: boolean; why?: string }> {
  if (!pushSupported()) return { ok: false, why: "This browser can't show notifications. On iPhone, add Lexari to your Home Screen first." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, why: perm === "denied" ? "Notifications are blocked for Lexari. Allow them in your system settings." : "Notifications weren't allowed." };
  if (isDesktopApp()) {
    setDesktop(true);
    if (test) new Notification("Notifications are on", { body: "This is how Lexari will reach you.", icon: "/icon-192.png" });
    return { ok: true };
  }
  const r = await registerSW();
  if (!r) return { ok: false, why: "Couldn't start notifications. Reload and try again." };
  await navigator.serviceWorker.ready;
  const { key } = await api<{ key: string }>("/api/push");
  if (!key) return { ok: false, why: "Push isn't set up on the server yet." };
  let sub = await r.pushManager.getSubscription();
  if (sub && staleKey(sub, key)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await api("/api/push", { method: "POST", body: { sub: sub.toJSON(), test } });
  return { ok: true };
}

export async function disablePush() {
  if (isDesktopApp()) { setDesktop(false); return; }
  const r = await registerSW();
  const sub = await r?.pushManager.getSubscription();
  if (sub) { await api("/api/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
}

export async function pushOnHere() {
  if (pushPermission() !== "granted") return false;
  if (isDesktopApp()) return desktopOn();
  const r = await registerSW();
  return !!(await r?.pushManager.getSubscription());
}

/** App start: keep the bell fresh and re-save an existing subscription (browsers rotate them). */
let started = false;
export function startNotices() {
  if (started || typeof window === "undefined") return;
  started = true;
  startMoneySync();
  void loadNotices();
  setInterval(() => { if (document.visibilityState === "visible") void loadNotices(); }, 45_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void loadNotices(); });
  if (pushSupported() && !isDesktopApp()) {
    navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.type === "lexari-notify") void loadNotices(); });
    if (Notification.permission === "granted") void registerSW().then(async (r) => {
      const sub = await r?.pushManager.getSubscription();
      if (!sub) return;
      // The server keys changed since this browser subscribed: make a fresh subscription so pushes reach it again.
      const { key } = await api<{ key: string }>("/api/push").catch(() => ({ key: "" }));
      if (key && staleKey(sub, key)) { await sub.unsubscribe().catch(() => {}); await enablePushInner(false).catch(() => {}); return; }
      await api("/api/push", { method: "POST", body: { sub: sub.toJSON() } }).catch(() => {});
    });
  }
}
