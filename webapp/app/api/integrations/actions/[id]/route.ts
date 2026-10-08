import { z } from "zod";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { actionCard, cancelAction, confirmAction } from "@/server/integrations/actions";

export const runtime = "nodejs";
export const maxDuration = 90;
type Ctx = { params: Promise<{ id: string }> };

/** The latest state of a confirm card (a sent transaction is checked on chain). */
export const GET = withUser<Ctx>(async (user, _req, ctx) => Response.json({ action: await actionCard(user.userId, (await ctx.params).id) }, { headers: { "cache-control": "no-store" } }));

const body = z.object({ op: z.enum(["confirm", "cancel"]) }).strict();

/** Confirm runs it from the agent's own wallet after every rule is checked again on the server; Cancel drops it. */
export const POST = withUser<Ctx>(async (user, req, ctx) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const { id } = await ctx.params;
  const action = b.op === "confirm" ? await confirmAction(user.userId, id) : await cancelAction(user.userId, id);
  return Response.json({ action });
});
