import { z } from "zod";
import { finishSecretRequest } from "@/server/secrets";
import { isUuid, jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** Cancel a secure card in chat (Save goes through POST /api/secrets with requestId). */
export const POST = withUser<Ctx>(async (user, req, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "That request is gone.");
  const b = await readJson(req, z.object({ op: z.literal("cancel") }).strict());
  if (b instanceof Response) return b;
  return Response.json({ card: await finishSecretRequest(user.userId, id, "cancelled") });
});
