import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { agentCards } from "@/server/db/schema";
import { jsonError, readJson } from "@/server/http";
import { checkPin, checkSignedConfirm, lockHashOf } from "@/server/lock";
import { withUser } from "@/server/route";
import { view } from "@/server/cards/view";

export const runtime = "nodejs";

const body = z.object({
  agent: z.string().min(1).max(60),
  pin: z.string().regex(/^[0-9]{4,6}$/).optional(),
  message: z.string().max(200).optional(),
  signature: z.string().max(200).optional(),
}).strict();

/** Full card details: needs the app PIN when one is set, otherwise a fresh message signed by your wallet. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (await lockHashOf(user.userId)) {
    if (!b.pin) return jsonError(401, "Enter your PIN to view the card.");
    await checkPin(user.userId, b.pin);
  } else {
    if (!b.message || !b.signature) return jsonError(401, "Confirm with your wallet to view the card.");
    checkSignedConfirm(user.wallet, b.message, b.signature, `view card ${b.agent}`);
  }
  const [c] = await db().select().from(agentCards).where(and(eq(agentCards.userId, user.userId), eq(agentCards.agentKey, b.agent))).limit(1);
  if (!c) return jsonError(404, "There's no card for that agent.");
  return Response.json({ card: view(c, true) }, { headers: { "cache-control": "no-store" } });
});
