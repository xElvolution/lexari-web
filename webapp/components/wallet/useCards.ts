"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { Card } from "@/lib/pay";

/** Your agents' cards, shared by every screen that shows them. */
let cards: Card[] | null = null;
let loading = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export async function refreshCards() {
  if (loading) return;
  loading = true;
  try { cards = (await api<{ cards: Card[] }>("/api/cards")).cards; } catch { cards = cards ?? []; } finally { loading = false; emit(); }
}
export function putCard(card: Card) {
  cards = [...(cards ?? []).filter((c) => c.agent !== card.agent), card];
  emit();
}
export async function updateCard(agent: string, patch: { frozen?: boolean; limit?: number }) {
  const r = await api<{ card: Card }>("/api/cards", { method: "PATCH", body: { agent, ...patch } });
  putCard(r.card);
  return r.card;
}
export function useCards() {
  const list = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => cards, () => null);
  useEffect(() => { if (cards === null) void refreshCards(); }, []);
  return list;
}
export const cardFor = (list: Card[] | null, agent: string) => list?.find((c) => c.agent === agent) ?? null;
