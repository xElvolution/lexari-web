"use client";

import { specialistBySlug } from "@/content/appData";
import { api, friendly } from "@/lib/api";
import { payForHire } from "@/lib/pay";
import { hirePriceLabel } from "@/lib/prices";
import { get, hire, toast } from "@/lib/store";
import { burst, flyToSeats } from "./fly";

const inflight = new Set<string>();

/** Hire: pay on Solana (or re-add one you already paid for), have the server verify it, then the flying face, burst and toast. */
export async function hireWithFx(slug: string, faceEl: HTMLElement | null, _goPlans?: () => void): Promise<"ok" | "full" | "already" | "unpaid"> {
  if (inflight.has(slug)) return "unpaid";
  inflight.add(slug);
  try { return await run(slug, faceEl); } finally { inflight.delete(slug); }
}

async function run(slug: string, faceEl: HTMLElement | null): Promise<"ok" | "full" | "already" | "unpaid"> {
  const sp = specialistBySlug(slug)!;
  const s = get();
  if (s.hired.includes(slug)) {
    toast({ text: `${sp.name} is already on your team`, face: sp.seed, color: sp.color });
    return "already";
  }
  const before = s.paid.includes(slug);
  if (before) {
    try { await api("/api/hires", { method: "PUT", body: { slug } }); }
    catch (e) { toast({ text: friendly(e, "Could not add them back."), face: "home" }); return "unpaid"; }
  } else {
    const paid = await payForHire(slug);
    if (!paid.ok) { toast({ text: paid.error, face: "home" }); return "unpaid"; }
  }
  const r = hire(slug);
  if (r === "ok") {
    flyToSeats(faceEl); burst(faceEl, 16);
    toast({ text: before ? `${sp.name} is back on your team` : `${sp.name} joined your team · ${hirePriceLabel()}`, face: sp.seed, color: sp.color });
  } else {
    toast({ text: `${sp.name} is already on your team`, face: sp.seed, color: sp.color });
  }
  return r;
}
