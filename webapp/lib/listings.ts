"use client";
/**
 * The marketplace list from the database (/api/market/listings). Starts from the house specialists the app ships
 * with, so the first paint is identical, then swaps in the server list (same cards, plus any approved third-party
 * agents) and registers third-party cards so faces and chats can find them.
 */
import { useEffect, useState } from "react";
import { SPECIALISTS, registerListings, type Specialist } from "@/content/appData";

let list: Specialist[] | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<(l: Specialist[]) => void>();

export function loadListings(force = false): Promise<void> {
  if (loading) return loading;
  if (list && !force) return Promise.resolve();
  loading = (async () => {
    try {
      const r = await fetch("/api/market/listings", { credentials: "same-origin" });
      if (!r.ok) return;
      const j = (await r.json()) as { listings?: Specialist[] };
      if (!Array.isArray(j.listings) || !j.listings.length) return;
      registerListings(j.listings);
      list = j.listings;
      for (const f of subs) f(list);
    } catch {
      // offline or a blip: keep showing what we have
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Every listed agent, house specialists first. */
export function useListings(): Specialist[] {
  const [l, setL] = useState<Specialist[]>(list ?? SPECIALISTS);
  useEffect(() => {
    subs.add(setL);
    if (list) setL(list); else void loadListings();
    return () => { subs.delete(setL); };
  }, []);
  return l;
}
