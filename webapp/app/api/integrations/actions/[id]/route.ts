import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { integrationActions } from "@/server/db/integrationsSchema";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { actionCard, cancelAction, confirmAction } from "@/server/integrations/actions";
import { checkMoney, logEvent, requireStepUp } from "@/server/security";

export const runtime = "nodejs";
export const maxDuration = 90;
type Ctx = { params: Promise<{ id: string }> };

/** The latest state of a confirm card (a sent transaction is checked on chain). */
export const GET = withUser<Ctx>(async (user, _req, ctx) => Response.json({ action: await actionCard(user.userId, (await ctx.params).id) }, { headers: { "cache-control": "no-store" } }));

const body = z.object({ op: z.enum(["confirm", "cancel"]) }).strict();

/**
 * Confirm runs it from the agent's own wallet after every rule is checked again on the server; Cancel drops it.
 * Settings > Security is checked again at Confirm: the daily money limit, saved-addresses-only, and a fresh PIN or
 * wallet confirm for a first-time address or a large amount.
 */
export const POST = withUser<Ctx>(async (user, req, ctx) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const { id } = await ctx.params;
  if (b.op === "confirm" && /^[0-9a-f-]{36}$/i.test(id)) {
    const [a] = await db().select().from(integrationActions).where(and(eq(integrationActions.userId, user.userId), eq(integrationActions.id, id))).limit(1);
    if (a?.status === "prepared") {
      const to = ((a.preview as { plan?: { to?: string } } | null)?.plan?.to) ?? null;
      const check = await checkMoney(user.userId, { usdMicros: a.usdMicros, to });
      if (check.needsStepUp) requireStepUp(user, check.firstTime ? "send to a new address" : "confirm a large amount");
      const action = await confirmAction(user.userId, id);
      if (check.firstTime || check.needsStepUp) await logEvent(user, "send", `Confirmed ${action.title}${to ? ` to ${to.slice(0, 4)}…${to.slice(-4)}` : ""}`);
      return Response.json({ action });
    }
  }
  const action = b.op === "confirm" ? await confirmAction(user.userId, id) : await cancelAction(user.userId, id);
  return Response.json({ action });
});
