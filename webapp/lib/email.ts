"use client";

/** Agent email in the app: which mailbox sheet is open, unread counts, and the API calls. */
import { useSyncExternalStore } from "react";
import type { EmailCard, EmailMode, Mailbox, MailItem } from "@/content/email";
import { api } from "./api";

type Store = { open: string | null; mode: EmailMode | null; unread: Record<string, number> };
let store: Store = { open: null, mode: null, unread: {} };
const subs = new Set<() => void>();
const set = (p: Partial<Store>) => { store = { ...store, ...p }; subs.forEach((f) => f()); };
const SERVER: Store = { open: null, mode: null, unread: {} };
export const useEmail = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => store, () => SERVER);

export const openMail = (agent: string) => set({ open: agent });
export const closeMail = () => set({ open: null });

let loading: Promise<void> | null = null;
export function refreshUnread() {
  if (loading) return loading;
  loading = api<{ mode: EmailMode; unread: Record<string, number> }>("/api/email").then((r) => set({ mode: r.mode, unread: r.unread }), () => {}).finally(() => { loading = null; });
  return loading;
}

export type MailState = { box: Mailbox; inbox: MailItem[]; sent: MailItem[] };
export const loadMailbox = (agent: string) => api<MailState>(`/api/email/${encodeURIComponent(agent)}`);
export const readMail = (id: string) => api<{ mail: MailItem & { text: string; cc: string[]; replyTo: string | null } }>(`/api/email/item/${id}`).then((r) => r.mail);
export const saveMailbox = (agent: string, patch: { senderMode?: "agent" | "user"; replyTo?: string | null }) => api<{ box: Mailbox }>(`/api/email/${encodeURIComponent(agent)}`, { method: "PUT", body: patch }).then((r) => r.box);
export const testMail = (agent: string, kind: "mail" | "gmail_verify") => api(`/api/email/${encodeURIComponent(agent)}/test`, { body: { kind } });
export const actOnEmail = (id: string, op: "send" | "cancel", edits?: { subject?: string; text?: string }) => api<{ email: EmailCard }>(`/api/email/item/${id}`, { body: { op, ...edits } }).then((r) => r.email);
export const setUnread = (agent: string, n: number) => set({ unread: { ...store.unread, [agent]: n } });

/** Your email name: agents are <agent>.<handle>@domain. Chosen once in Settings > Account. */
export type HandleInfo = { handle: string; chosen: boolean; domain: string; check?: { handle: string; available: boolean; reason: string | null } };
export const loadHandle = (check?: string) => api<HandleInfo>(`/api/email/handle${check !== undefined ? `?check=${encodeURIComponent(check)}` : ""}`);
export const chooseHandle = (handle: string) => api<HandleInfo>("/api/email/handle", { method: "PUT", body: { handle } });
