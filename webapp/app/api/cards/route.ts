import { notify } from "@/server/notify";
import { and, eq, like, sql } from "drizzle-orm";
import { creditLedger } from "@/server/db/billingSchema";
import { db } from "@/server/db";
import { agentCards, agents, hires, planPurchases } from "@/server/db/schema";
import { cardIssuer } from "@/server/cards/issuer";
import { view } from "@/server/cards/view";
import { CARD_LAMPORTS } from "@/server/config";
import { verifyPayment } from "@/server/hires";
import { fetchConfirmed } from "@/server/hub/confirm";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { requireStepUp } from "@/server/security";
import { cardBuyBody, cardPatchBody } from "@/server/validate";
import { charge, credit } from "@/server/billing/balance";
import { CARD_USD } from "@/lib/prices";

export const runtime = "nodejs";

/** Your agents' cards. */
export const GET = withUser(async (user) => {
  const rows = await db().select().from(agentCards).where(eq(agentCards.userId, user.userId));
  return Response.json({ cards: rows.map((r) => view(r)), priceUsd: CARD_USD });
});

/**
 * Buys a card for one agent, paid in dollars from your Lexari balance (one debit per agent, so retries never charge
 * twice). If the card can't be issued, the same dollars go straight back to your balance. Older clients may still
 * send an on-chain payment.
 */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, cardBuyBody);
  if (body instanceof Response) return body;
  const database = db();
  // Cards are for agents you made (your personal agent and the ones you created). Hired specialists use their own task wallet.
  if (body.agent !== "home" && !body.agent.startsWith("c-")) return jsonError(403, "Hired agents can't get a card. They ask you to fund their own task wallet when a task needs money.");
  if (body.agent !== "home") {
    const [own] = await database.select({ id: agents.id }).from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, body.agent))).limit(1);
    if (!own) return jsonError(404, "That agent is not on your team.");
  }
  const [already] = await database.select().from(agentCards).where(and(eq(agentCards.userId, user.userId), eq(agentCards.agentKey, body.agent))).limit(1);
  if ("pay" in body) {
    if (already) return Response.json({ card: view(already), already: true });
    const micros = Math.round(CARD_USD * 1_000_000);
    // One charge per agent; after a refunded attempt the next try is a fresh charge.
    const base = `card:${user.userId}:${body.agent}`;
    const [{ n }] = await database.select({ n: sql<number>`count(*)::int` }).from(creditLedger).where(like(creditLedger.ref, `refund:${base}%`));
    const ref = n ? `${base}:r${n}` : base;
    const paid = await database.transaction((tx) => charge(tx, user.userId, micros, "card", ref, "An agent card"));
    let issued;
    try { issued = await cardIssuer().issue({ holder: body.agent, limit: body.limit }); }
    catch (e) {
      console.error("[cards] issue failed, refunding:", (e as Error).message?.slice(0, 160));
      await database.transaction((tx) => credit(tx, user.userId, micros, "refund", `refund:${ref}:${paid.ledgerId}`));
      return jsonError(502, "The card couldn't be issued, so the money went back to your balance.", { refunded: true });
    }
    const inserted = await database.insert(agentCards).values({
      userId: user.userId, agentKey: body.agent, issuer: issued.issuer, externalId: issued.externalId, number: issued.number, last4: issued.number.slice(-4),
      expMonth: issued.expMonth, expYear: issued.expYear, cvv: issued.cvv, spendLimit: body.limit, payTx: `balance:${ref}`, amount: micros,
    }).onConflictDoNothing().returning();
    if (!inserted.length) {
      const [now] = await database.select().from(agentCards).where(and(eq(agentCards.userId, user.userId), eq(agentCards.agentKey, body.agent))).limit(1);
      return now ? Response.json({ card: view(now), already: true }) : jsonError(409, "This agent already has a card.");
    }
    await notify(user.userId, { kind: "card", title: "Your agent's card is ready", body: `Paid from your balance. Card ending ${inserted[0].last4} is active.`, url: "/wallets", key: `card:${ref}` });
    return Response.json({ card: view(inserted[0]), charged: paid.already ? 0 : micros });
  }
  if (already) return already.payTx === body.tx ? Response.json({ card: view(already) }) : jsonError(409, "This agent already has a card.");
  const [usedCard] = await database.select({ id: agentCards.id }).from(agentCards).where(eq(agentCards.payTx, body.tx)).limit(1);
  const [usedHire] = await database.select({ id: hires.id }).from(hires).where(eq(hires.tx, body.tx)).limit(1);
  const [usedPlan] = await database.select({ id: planPurchases.id }).from(planPurchases).where(eq(planPurchases.tx, body.tx)).limit(1);
  if (usedCard || usedHire || usedPlan) return jsonError(409, "That payment was already used.");
  const tx = await fetchConfirmed(body.tx);
  const paid = verifyPayment(tx, user.wallet, "SOL", CARD_LAMPORTS);
  const issued = await cardIssuer().issue({ holder: body.agent, limit: body.limit });
  const inserted = await database.insert(agentCards).values({
    userId: user.userId, agentKey: body.agent, issuer: issued.issuer, externalId: issued.externalId, number: issued.number, last4: issued.number.slice(-4),
    expMonth: issued.expMonth, expYear: issued.expYear, cvv: issued.cvv, spendLimit: body.limit, payTx: body.tx, amount: paid.amount,
  }).onConflictDoNothing().returning();
  if (!inserted.length) return jsonError(409, "That payment was already used, or this agent already has a card.");
  await notify(user.userId, { kind: "card", title: "Your agent's card is ready", body: `Payment confirmed. Card ending ${inserted[0].last4} is active.`, url: "/wallets", key: `card:${body.tx}` });
  return Response.json({ card: view(inserted[0]) });
});

/** Freeze, unfreeze, or change the monthly limit. */
export const PATCH = withUser(async (user, req) => {
  const body = await readJson(req, cardPatchBody);
  if (body instanceof Response) return body;
  const database = db();
  const [card] = await database.select().from(agentCards).where(and(eq(agentCards.userId, user.userId), eq(agentCards.agentKey, body.agent))).limit(1);
  if (!card) return jsonError(404, "This agent has no card.");
  if ((body.limit !== undefined && body.limit > card.spendLimit) || (body.frozen === false && card.frozen)) requireStepUp(user, body.limit !== undefined ? "raise a card limit" : "unfreeze a card");
  const issuer = cardIssuer();
  if (card.externalId && body.frozen !== undefined) await issuer.setFrozen?.(card.externalId, body.frozen);
  if (card.externalId && body.limit !== undefined) await issuer.setLimit?.(card.externalId, body.limit);
  const [row] = await database.update(agentCards).set({
    ...(body.frozen === undefined ? {} : { frozen: body.frozen }),
    ...(body.limit === undefined ? {} : { spendLimit: body.limit }),
    updatedAt: new Date(),
  }).where(eq(agentCards.id, card.id)).returning();
  return Response.json({ card: view(row) });
});
