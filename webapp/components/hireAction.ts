"use client";

import { specialistBySlug } from "@/content/appData";
import { api, friendly } from "@/lib/api";
import { payFromBalance } from "@/lib/balance";
import { hirePriceLabel, hirePriceOf } from "@/lib/prices";
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
  const usd = hirePriceOf(sp);
  const price = hirePriceLabel(usd);
  if (s.hired.includes(slug)) {
    toast({ text: `${sp.name} is already on your team`, face: sp.seed, color: sp.color });
    return "already";
  }
  if (!sp.free && seatsLeft(s) <= 0) { openUpgrade(s.plan === "free" ? "hire" : "full"); return "full"; }
  const before = s.paid.includes(slug);
  let paidNow = false;
  if (sp.free && !before) {
    // Free with any paid plan: on Free, open the upgrade instead.
    if (s.plan === "free") { openUpgrade("hire"); toast({ text: `${sp.name} is free with any paid plan`, face: sp.seed, color: sp.color }); return "full"; }
    try { await api("/api/hires", { body: { slug, pay: "balance" } }); void refreshHub(); }
    catch (e) { if ((e as { status?: number }).status === 402) { openUpgrade("hire"); return "full"; } toast({ text: friendly(e, "Could not hire them."), face: "home" }); return "unpaid"; }
  } else if (before) {
    try { await api("/api/hires", { method: "PUT", body: { slug } }); }
    catch (e) { if ((e as { status?: number }).status === 402) { openUpgrade("hire"); return "full"; } toast({ text: friendly(e, "Could not add them back."), face: "home" }); return "unpaid"; }
  } else if (usd === 0) {
    // A free third-party agent: no charge, but it takes a seat like any hire.
    try { await api("/api/hires", { body: { slug, pay: "balance" } }); void refreshHub(); }
    catch (e) { if ((e as { status?: number }).status === 402) { openUpgrade("hire"); return "full"; } toast({ text: friendly(e, "Could not hire them."), face: "home" }); return "unpaid"; }
  } else {
    const paid = await payFromBalance({
      kind: "hire", title: `Hire ${sp.name}`, doing: `Hiring ${sp.name}`, what: `${sp.job}. A one-time hire; release and rehire for free.`, usd,
      art: createElement(AgentTile, { id: slug, look: null, size: 72, radius: 24 }),
      cta: () => `Hire for ${price}`,
      run: () => api("/api/hires", { body: { slug, pay: "balance" } }).then((r) => { void refreshHub(); return r; }),
    });
    if (!paid.ok) return "unpaid";
    paidNow = true;
  }
  const r = hire(slug);
  if (r === "ok") {
    flyToSeats(faceEl);
    if (sp.free && !before) celebrate({ title: `${sp.name} joined your team`, body: `${sp.job}. Free, and it doesn't take a seat.`, art: createElement(AgentTile, { id: slug, look: null, size: 96, radius: 30 }), cta: { label: "Say hi", href: `/agents/${slug}` } });
    else if (paidNow) celebrate({ title: `${sp.name} joined your team`, body: `${sp.job}. Paid ${price} from your balance.`, art: createElement(AgentTile, { id: slug, look: null, size: 96, radius: 30 }), cta: { label: "Say hi", href: `/agents/${slug}` } });
    toast({ text: before ? `${sp.name} is back on your team` : `${sp.name} joined your team · ${sp.free || usd === 0 ? "Free" : price}`, face: sp.seed, color: sp.color });
  } else {
    toast({ text: `${sp.name} is already on your team`, face: sp.seed, color: sp.color });
  }
  return r;
}
