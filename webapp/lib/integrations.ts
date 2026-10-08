"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { onSignOut } from "./walletBridge";
import type { ActionCard, AddedIntegration } from "@/content/integrations";

export type IntegrationsState = { locked: boolean; added: AddedIntegration[]; agents: { slug: string; kind: string; name: string }[]; loaded: boolean; error?: string };
type Reply = Omit<IntegrationsState, "loaded" | "error">;

const EMPTY: IntegrationsState = { locked: true, added: [], agents: [], loaded: false };
let state: IntegrationsState = EMPTY;
let inflight: Promise<void> | null = null;
const subs = new Set<() => void>();
const set = (next: Partial<IntegrationsState>) => { state = { ...state, ...next }; subs.forEach((f) => f()); };
const take = (r: Reply) => set({ ...r, loaded: true, error: undefined });

export function loadIntegrations(force = false) {
  if (inflight && !force) return inflight;
  inflight = api<Reply>("/api/integrations").then(take).catch((e: Error) => set({ loaded: true, error: e.message })).finally(() => { inflight = null; });
  return inflight;
}
export function useIntegrations(): IntegrationsState {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => EMPTY);
  useEffect(() => { if (!state.loaded) void loadIntegrations(); }, []);
  return s;
}

export type GrantInput = { agents?: string[]; enabled?: boolean; perTxUsd?: number; dailyUsd?: number; maxSlippageBps?: number };
export async function addIntegration(connector: string, input: GrantInput) { take(await api<Reply>("/api/integrations", { body: { connector, ...input } })); }
export async function updateIntegration(id: string, input: GrantInput) { take(await api<Reply>(`/api/integrations/${id}`, { method: "PATCH", body: input })); }
export async function removeIntegration(id: string) { take(await api<Reply>(`/api/integrations/${id}`, { method: "DELETE" })); }

export async function actOn(id: string, op: "confirm" | "cancel") {
  const r = await api<{ action: ActionCard }>(`/api/integrations/actions/${id}`, { body: { op } });
  if (state.loaded) void loadIntegrations(true); // the card's activity row and today's spend
  return r.action;
}
export async function actionNow(id: string) { return (await api<{ action: ActionCard }>(`/api/integrations/actions/${id}`)).action; }

onSignOut("integrations", () => { state = EMPTY; subs.forEach((f) => f()); });
