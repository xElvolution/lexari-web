import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { agentCards, agents, hires } from "@/server/db/schema";
import { cardIssuer } from "@/server/cards/issuer";
import { CARD_LAMPORTS } from "@/server/config";
import { verifyPayment } from "@/server/hires";
import { fetchConfirmed } from "@/server/hub/confirm";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { cardBuyBody, cardPatchBody } from "@/server/validate";

export const runtime = "nodejs";

type Row = typeof agentCards.$inferSelect;
const view = (c: Row) => ({
  agent: c.agentKey, issuer: c.issuer, test: c.issuer === "devnet-test", number: c.number, last4: c.last4,
  expMonth: c.expMonth, expYear: c.expYear, cvv: c.cvv, limit: c.spendLimit, spent: c.spent, frozen: c.frozen, tx: c.payTx, createdAt: c.createdAt,
});

/** Your agents' cards. */
export const GET = withUser(async (user) => {
  const rows = await db().select().from(agentCards).where(eq(agentCards.userId, user.userId));
  return Response.json({ cards: rows.map(view), priceLamports: CARD_LAMPORTS });
});

/** Buys a card for one agent: verifies the SOL payment to the treasury on chain, then issues the card. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, cardBuyBody);
  if (body instanceof Response) return body;
  const database = db();
  if (body.agent !== "home" && !body.agent.startsWith("c-")) {
    const [own] = await database.select({ id: agents.id }).from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, body.agent))).limit(1);
    if (!own) return jsonError(404, "That agent is not on your team.");
  }
  const [already] = await database.select().from(agentCards).where(and(eq(agentCards.userId, user.userId), eq(agentCards.agentKey, body.agent))).limit(1);
  if (already) return already.payTx === body.tx ? Response.json({ card: view(already) }) : jsonError(409, "This agent already has a card.");
  const [usedCard] = await database.select({ id: agentCards.id }).from(agentCards).where(eq(agentCards.payTx, body.tx)).limit(1);
  const [usedHire] = await database.select({ id: hires.id }).from(hires).where(eq(hires.tx, body.tx)).limit(1);
  if (usedCard || usedHire) return jsonError(409, "That payment was already used.");
  const tx = await fetchConfirmed(body.tx);
  const paid = verifyPayment(tx, user.wallet, "SOL", CARD_LAMPORTS);
  const issued = await cardIssuer().issue({ holder: body.agent, limit: body.limit });
  const inserted = await database.insert(agentCards).values({
    userId: user.userId, agentKey: body.agent, issuer: issued.issuer, externalId: issued.externalId, number: issued.number, last4: issued.number.slice(-4),
    expMonth: issued.expMonth, expYear: issued.expYear, cvv: issued.cvv, spendLimit: body.limit, payTx: body.tx, amount: paid.amount,
  }).onConflictDoNothing().returning();
  if (!inserted.length) return jsonError(409, "That payment was already used, or this agent already has a card.");
  return Response.json({ card: view(inserted[0]) });
});

/** Freeze, unfreeze, or change the monthly limit. */
export const PATCH = withUser(async (user, req) => {
  const body = await readJson(req, cardPatchBody);
  if (body instanceof Response) return body;
  const database = db();
  const [card] = await database.select().from(agentCards).where(and(eq(agentCards.userId, user.userId), eq(agentCards.agentKey, body.agent))).limit(1);
  if (!card) return jsonError(404, "This agent has no card.");
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
