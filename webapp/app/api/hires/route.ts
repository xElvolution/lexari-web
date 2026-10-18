import { notify } from "@/server/notify";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { agents, hires, planPurchases } from "@/server/db/schema";
import { hireEvents } from "@/server/db/marketSchema";
import { recordEvent } from "@/server/events";
import { verifyPayment } from "@/server/hires";
import { fetchConfirmed } from "@/server/hub/confirm";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { assertSeat, currentPlan } from "@/server/plans";
import { hireBody, rehireBody } from "@/server/validate";
import { charge } from "@/server/billing/balance";
import { HIRE_USD } from "@/lib/prices";
import { listingBySlug } from "@/server/market/listings";
import { splitRevenue } from "@/server/market/config";

export const runtime = "nodejs";

/** What a hire needs to know about a listing (database-backed, server/market/listings.ts). */
async function specialistFor(slug: string) {
  const l = await listingBySlug(slug);
  if (!l?.card) return null;
  const sp = l.card;
  const manifest = l.version?.manifest ?? null;
  return { sp, listing: l, priceUsd: l.house ? HIRE_USD : (manifest?.pricing.usd ?? 0), model: manifest?.model ?? null };
}

/** Puts a specialist you paid for before back on your team, without paying again. */
export const PUT = withUser(async (user, req) => {
  const body = await readJson(req, rehireBody);
  if (body instanceof Response) return body;
  const found = await specialistFor(body.slug);
  if (!found) return jsonError(404, "There is no such specialist.");
  const { sp, model } = found;
  const database = db();
  const [paid] = await database.select({ id: hires.id }).from(hires).where(and(eq(hires.buyerId, user.userId), eq(hires.slug, sp.slug))).limit(1);
  if (!paid) return jsonError(402, "Hire this specialist first.");
  const [on] = await database.select({ id: agents.id }).from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, sp.slug))).limit(1);
  if (on) return Response.json({ ok: true });
  if (!sp.free) await assertSeat(user.userId);
  await database.insert(agents).values({ userId: user.userId, slug: sp.slug, kind: "hired", name: sp.name, role: sp.job, tone: "", ...(model ? { model } : {}) }).onConflictDoNothing();
  return Response.json({ ok: true });
});

/**
 * Hires a specialist. New hires are paid in dollars from your Lexari balance: one ledger debit and the team seat in
 * one transaction, idempotent per (you, specialist), so a double tap or a retry never charges twice. A short balance
 * answers 402 with the shortfall so the app can open Top up. Older clients may still send an on-chain payment.
 * Third-party listings charge their own price and record the developer / Lexari split in hire_events.
 */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, hireBody);
  if (body instanceof Response) return body;
  const found = await specialistFor(body.slug);
  if (!found) return jsonError(404, "There is no such specialist.");
  const { sp, listing, priceUsd, model } = found;
  const database = db();
  if ("pay" in body) {
    const [on] = await database.select({ id: agents.id }).from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, sp.slug))).limit(1);
    if (on) return Response.json({ ok: true, already: true });
    if (!listing.live) return jsonError(410, `${sp.name} isn't on the marketplace right now.`);
    if (sp.free) {
      // Free specialists (the ORE Miner): no charge and no seat, but only with an active paid plan.
      if ((await currentPlan(user.userId)).id === "free") return jsonError(402, `${sp.name} is free with any paid plan. Upgrade to hire it.`, { reason: "plan_required", upgrade: "/settings#billing" });
      await database.insert(hires).values({ buyerId: user.userId, tx: `free:${user.userId}:${sp.slug}`, slug: sp.slug, mint: "USD", amount: 0, payer: "free" }).onConflictDoNothing();
      await database.insert(agents).values({ userId: user.userId, slug: sp.slug, kind: "hired", name: sp.name, role: sp.job, tone: "" }).onConflictDoNothing();
      await recordEvent(user.userId, "hire", { ref: `free:${sp.slug}` });
      await notify(user.userId, { kind: "hire", title: `${sp.name} joined your team`, body: `Free. Say hi to ${sp.name}, your ${sp.job.toLowerCase()} agent.`, url: `/agents/${sp.slug}`, key: `hire:free:${user.userId}:${sp.slug}` });
      return Response.json({ ok: true, charged: 0 });
    }
    await assertSeat(user.userId);
    const micros = Math.round(priceUsd * 1_000_000);
    const ref = `hire:${user.userId}:${sp.slug}`;
    const split = splitRevenue(micros);
    const out = await database.transaction(async (tx) => {
      const c = micros > 0 ? await charge(tx, user.userId, micros, "hire", ref, `Hiring ${sp.name}`) : { already: false, balance: undefined };
      const [fresh] = await tx.insert(hires).values({ buyerId: user.userId, tx: `balance:${ref}`, slug: sp.slug, mint: "USD", amount: micros, payer: micros > 0 ? "balance" : "free" }).onConflictDoNothing().returning({ id: hires.id });
      await tx.insert(agents).values({ userId: user.userId, slug: sp.slug, kind: "hired", name: sp.name, role: sp.job, tone: "", ...(model ? { model } : {}) }).onConflictDoNothing();
      if (fresh && !listing.house) {
        await tx.insert(hireEvents).values({ listingId: listing.id, versionId: listing.version?.id ?? null, buyerId: user.userId, ref, grossMicros: split.gross, developerMicros: split.developer, lexariMicros: split.lexari, splitBps: split.bps }).onConflictDoNothing();
      }
      return { ...c, already: c.already || !fresh };
    });
    if (!out.already) {
      await recordEvent(user.userId, "hire", { ref });
      await notify(user.userId, { kind: "hire", title: `${sp.name} joined your team`, body: micros > 0 ? `Paid from your balance. Say hi to ${sp.name}, your new ${sp.job.toLowerCase()}.` : `Free. Say hi to ${sp.name}, your new ${sp.job.toLowerCase()}.`, url: `/agents/${sp.slug}`, key: `hire:${ref}` });
    }
    return Response.json({ ok: true, charged: out.already ? 0 : micros, balance: out.balance });
  }
  // Legacy on-chain payments only ever bought house specialists at the house price.
  if (!listing.house) return jsonError(400, "Pay from your Lexari balance to hire this agent.");
  const [used] = await database.select().from(hires).where(eq(hires.tx, body.tx)).limit(1);
  if (used) return used.buyerId === user.userId && used.slug === body.slug ? Response.json({ ok: true }) : jsonError(409, "That payment was already used.");
  const [usedPlan] = await database.select({ id: planPurchases.id }).from(planPurchases).where(eq(planPurchases.tx, body.tx)).limit(1);
  if (usedPlan) return jsonError(409, "That payment was already used.");
  const tx = await fetchConfirmed(body.tx);
  const paid = verifyPayment(tx, user.wallet, body.mint);
  const inserted = await database.insert(hires).values({ buyerId: user.userId, tx: body.tx, slug: sp.slug, mint: paid.mint, amount: paid.amount, payer: paid.payer }).onConflictDoNothing().returning({ id: hires.id });
  if (!inserted.length) return jsonError(409, "That payment was already used.");
  const [have] = await database.select().from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, sp.slug))).limit(1);
  if (!have) await database.insert(agents).values({ userId: user.userId, slug: sp.slug, kind: "hired", name: sp.name, role: sp.job, tone: "" }).onConflictDoNothing();
  await recordEvent(user.userId, "hire", { ref: body.tx });
  await notify(user.userId, { kind: "hire", title: `${sp.name} joined your team`, body: `Payment confirmed. Say hi to ${sp.name}, your new ${sp.job.toLowerCase()}.`, url: `/agents/${sp.slug}`, key: `hire:${body.tx}` });
  return Response.json({ ok: true });
});
