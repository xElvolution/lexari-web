"use client";

import { specialistBySlug } from "@/content/appData";
import { api, friendly } from "@/lib/api";
import { payFromBalance } from "@/lib/balance";
import { HIRE_USD, hirePriceLabel } from "@/lib/prices";
import { get, hire, refreshHub, seatsLeft, toast } from "@/lib/store";
import { openUpgrade } from "./overlays";
import { flyToSeats } from "./fly";
import { createElement } from "react";
import { celebrate } from "./Celebrate";
import { AgentTile } from "./faces";

const inflight = new Set<string>();

/** Hire: pay from your Lexari balance (or re-add one you already paid for), then the flying face and toast. */
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
  if (seatsLeft(s) <= 0) { openUpgrade(s.plan === "free" ? "hire" : "full"); return "full"; }
  const before = s.paid.includes(slug);
  let paidNow = false;
  if (before) {
    try { await api("/api/hires", { method: "PUT", body: { slug } }); }
    catch (e) { if ((e as { status?: number }).status === 402) { openUpgrade("hire"); return "full"; } toast({ text: friendly(e, "Could not add them back."), face: "home" }); return "unpaid"; }
  } else {
    const paid = await payFromBalance({
      kind: "hire", title: `Hire ${sp.name}`, doing: `Hiring ${sp.name}`, what: `${sp.job}. A one-time hire; release and rehire for free.`, usd: HIRE_USD,
      art: createElement(AgentTile, { id: slug, look: null, size: 72, radius: 24 }),
      cta: () => `Hire for ${hirePriceLabel()}`,
      run: () => api("/api/hires", { body: { slug, pay: "balance" } }).then((r) => { void refreshHub(); return r; }),
    });
    if (!paid.ok) return "unpaid";
    paidNow = true;
  }
  const r = hire(slug);
  if (r === "ok") {
    flyToSeats(faceEl);
    if (paidNow) celebrate({ title: `${sp.name} joined your team`, body: `${sp.job}. Paid ${hirePriceLabel()} from your balance.`, art: createElement(AgentTile, { id: slug, look: null, size: 96, radius: 30 }), cta: { label: "Say hi", href: `/agents/${slug}` } });
    toast({ text: before ? `${sp.name} is back on your team` : `${sp.name} joined your team · ${hirePriceLabel()}`, face: sp.seed, color: sp.color });
  } else {
    toast({ text: `${sp.name} is already on your team`, face: sp.seed, color: sp.color });
  }
  return r;
}
