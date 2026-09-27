"use client";

import { specialistBySlug } from "@/content/appData";
import { get, hire, toast } from "@/lib/store";
import { burst, flyToSeats } from "./fly";

/** Hire with all the feedback: a flying face, a burst and a toast. Returns the result. */
export function hireWithFx(slug: string, faceEl: HTMLElement | null, goPlans: () => void) {
  const sp = specialistBySlug(slug)!;
  const r = hire(slug);
  if (r === "ok") {
    flyToSeats(faceEl); burst(faceEl, 16);
    toast({ text: `${sp.name} took seat ${String(get().hired.length + 1).padStart(2, "0")}`, face: sp.seed, color: sp.color });
  } else if (r === "full") {
    toast({ text: "Every seat is taken. Move up a plan for more.", face: "home", action: { label: "See plans", run: goPlans } });
  } else {
    toast({ text: `${sp.name} is already on your team`, face: sp.seed, color: sp.color });
  }
  return r;
}
