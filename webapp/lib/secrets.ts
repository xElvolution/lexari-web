"use client";

import { api } from "./api";
import type { SecretCard, SecretInfo } from "@/content/secrets";

/**
 * The secrets vault from the browser. A value is sent once, straight to the server over HTTPS, and is never kept in
 * app state, the chat, localStorage or analytics; callers clear their input as soon as the request leaves.
 */
export const listSecrets = () => api<{ secrets: SecretInfo[] }>("/api/secrets").then((r) => r.secrets);
export const saveSecret = (b: { name: string; value: string; label?: string; service?: string; agents?: string[]; requestId?: string }) =>
  api<{ secret: SecretInfo; card?: SecretCard }>("/api/secrets", { body: b });
export const replaceSecret = (id: string, value: string) => api<{ secret: SecretInfo }>(`/api/secrets/${id}`, { method: "PATCH", body: { value } }).then((r) => r.secret);
export const setSecretAgents = (id: string, agents: string[]) => api<{ secret: SecretInfo }>(`/api/secrets/${id}`, { method: "PATCH", body: { agents } }).then((r) => r.secret);
export const deleteSecret = (id: string) => api(`/api/secrets/${id}`, { method: "DELETE" });
export const cancelSecretRequest = (id: string) => api<{ card: SecretCard }>(`/api/secrets/requests/${id}`, { body: { op: "cancel" } }).then((r) => r.card);

/** Ask the open chat to show the agent's desktop (Home listens). */
export const openDesktop = () => window.dispatchEvent(new CustomEvent("lexari:desktop"));
