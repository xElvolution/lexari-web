"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { onSignOut } from "./walletBridge";
import { socialStatus, type Social, type SocialLink, type SocialStatus } from "./socialInfo";

export type SocialState = { links: SocialLink[]; status: SocialStatus; dev?: boolean; verifier?: string; loaded: boolean; error?: string };
type Reply = { links: SocialLink[]; status: SocialStatus; conflicts?: string[]; dev?: boolean; verifier?: string };

const EMPTY: SocialState = { links: [], status: socialStatus(0, false), loaded: false };
let state: SocialState = EMPTY;
let inflight: Promise<void> | null = null;
const subs = new Set<() => void>();
const set = (next: Partial<SocialState>) => { state = { ...state, ...next }; subs.forEach((f) => f()); };

/** Local test accounts: only in `next dev` with NEXT_PUBLIC_LEXARI_DEV_SOCIAL=1 (the server also needs LEXARI_DEV_SOCIAL=1). */
export const DEV_SOCIAL = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LEXARI_DEV_SOCIAL === "1";

export function loadSocial(force = false) {
  if (inflight && !force) return inflight;
  inflight = api<Reply>("/api/social")
    .then((r) => set({ links: r.links, status: r.status, dev: r.dev, verifier: r.verifier, loaded: true, error: undefined }))
    .catch((e: Error) => set({ loaded: true, error: e.message }))
    .finally(() => { inflight = null; });
  return inflight;
}

function take(r: Reply) { set({ links: r.links, status: r.status, loaded: true, error: undefined }); return r.conflicts ?? []; }

/** Sends Privy tokens; the server reads the linked accounts from them. Returns any conflict messages. */
export async function syncSocial(tokens: { idToken?: string | null; accessToken?: string | null }) {
  return take(await api<Reply>("/api/social", { body: { idToken: tokens.idToken || undefined, accessToken: tokens.accessToken || undefined } }));
}
export async function forgetSocial(provider: Social) {
  return take(await api<Reply>(`/api/social?provider=${provider}`, { method: "DELETE" }));
}
export async function devLinkSocial(provider: Social, handle: string) {
  return take(await api<Reply>("/api/social/dev", { body: { provider, handle } }));
}

export function useSocial(): SocialState {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => EMPTY);
  useEffect(() => { if (!state.loaded) void loadSocial(); }, []);
  return s;
}
export function resetSocial() { state = EMPTY; subs.forEach((f) => f()); }

// A different person may sign in next on this device.
onSignOut("social", resetSocial);
