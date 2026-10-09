import { z } from "zod";
import { removeCustom, testCustom } from "@/server/models";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
export const maxDuration = 40;
type Ctx = { params: Promise<{ id: string }> };

const body = z.object({ op: z.literal("test") }).strict();

/** Test connection: one tiny real call to your provider with your key. */
export const POST = withUser<Ctx>(async (user, req, ctx) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (!(await rateLimit(`byo:test:${user.userId}`, 30, 3_600_000))) return jsonError(429, "That's a lot of tests. Try again in a bit.");
  const id = decodeURIComponent((await ctx.params).id);
  return Response.json(await testCustom(user.userId, id));
});

/** Removes the model and its key. Anything that used it goes back to Lamina. */
export const DELETE = withUser<Ctx>(async (user, _req, ctx) => {
  await removeCustom(user.userId, decodeURIComponent((await ctx.params).id));
  return Response.json({ ok: true });
});
