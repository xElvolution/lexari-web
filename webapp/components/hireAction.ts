"use client";

import { specialistBySlug } from "@/content/appData";
import { payForHire } from "@/lib/pay";
import { hirePriceLabel } from "@/lib/prices";
import { get, hire, toast } from "@/lib/store";
import { burst, flyToSeats } from "./fly";

/** Hire with a devnet payment, then the flying face, burst and toast. */
export async function hireWithFx(slug: string, faceEl: HTMLElement | null, goPlans: () => void): Promise<"ok" | "full" | "already" | "unpaid"> {
  const sp = specialistBySlug(slug)!;
  const paid = await payForHire(slug);
  if (!paid.ok) {
    toast({ text: paid.error, face: "home" });
    return "unpaid";
  }
  const r = hire(slug);
  if (r === "ok") {
    flyToSeats(faceEl); burst(faceEl, 16);
    toast({ text: `${sp.name} took seat ${String(get().hired.length + 1).padStart(2, "0")} · ${hirePriceLabel()}`, face: sp.seed, color: sp.color });
  } else if (r === "full") {
    toast({ text: "Every seat is taken. Move up a plan for more.", face: "home", action: { label: "See plans", run: goPlans } });
  } else {
    toast({ text: `${sp.name} is already on your team`, face: sp.seed, color: sp.color });
  }
  return r;
}
