import { z } from "zod";
import { HttpError, isUuid, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { listIntegrations, removeIntegration, updateIntegration } from "@/server/integrations/grants";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const patchBody = z.object({
  agents: z.array(z.string().min(1).max(80)).max(50).optional(),
  enabled: z.boolean().optional(),
  perTxUsd: z.number().int().optional(),
  dailyUsd: z.number().int().optional(),
  maxSlippageBps: z.number().int().optional(),
}).strict();

/** Switch it on or off, change which agents may use it, or change its limits. */
export const PATCH = withUser<Ctx>(async (user, req, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, "That integration isn't added.");
  const body = await readJson(req, patchBody);
  if (body instanceof Response) return body;
  await updateIntegration(user.userId, id, body);
  return Response.json(await listIntegrations(user.userId));
});

/** Remove it. Allowed even without a linked account. */
export const DELETE = withUser<Ctx>(async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, "That integration isn't added.");
  await removeIntegration(user.userId, id);
  return Response.json(await listIntegrations(user.userId));
});
