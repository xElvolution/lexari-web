"use client";
/**
 * Computer use in the chat (client side). While the agent operates its desktop the reply stream carries
 * {cu: {step, max, label}} progress lines (shown as a "Working on your computer…" row with Stop) and, at the end,
 * {shots: {id, n}}: the screenshots attached to the reply (served by /api/computer/shot/<id>/<n>).
 */
import { useSyncExternalStore } from "react";
import { set } from "./store";

export type CuProgress = { step: number; max: number; label: string; at: number };
const work = new Map<string, CuProgress>();
const subs = new Set<() => void>();
const ping = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

/** Progress of the computer task running in this conversation, or null. A row with no news for 2 minutes goes away. */
export function useComputer(convo: string) {
  return useSyncExternalStore(subscribe, () => { const p = work.get(convo); return p && Date.now() - p.at < 120_000 ? p : null; }, () => null);
}

/** Handles one SSE "data:" line of a chat reply. Returns true when it was a computer-use event (nothing else in it). */
export function computerEvent(convo: string, bubble: string, line: string) {
  if (!line.startsWith("data:") || !/"(cu|shots)"/.test(line)) return false;
  let p: { cu?: Omit<CuProgress, "at"> | null; shots?: { id: string; n: number[] }; token?: string; done?: boolean; error?: string };
  try { p = JSON.parse(line.slice(5).trim()); } catch { return false; }
  if ("cu" in p) { if (p.cu) work.set(convo, { ...p.cu, at: Date.now() }); else work.delete(convo); ping(); }
  if (p.shots?.n?.length) {
    const n = p.shots.n;
    set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((m) => (m.id === bubble ? { ...m, shots: n } : m)) } }));
  }
  if (p.done || p.error) { work.delete(convo); ping(); }
  return !("token" in p) && !p.done && !p.error;
}

export async function stopComputer(convo: string) {
  await fetch("/api/computer/stop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ convo }) }).catch(() => {});
}

export const shotUrl = (replyId: string, n: number) => `/api/computer/shot/${encodeURIComponent(replyId)}/${n}`;
