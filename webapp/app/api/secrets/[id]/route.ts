import { z } from "zod";
import { deleteSecret, replaceSecret, setSecretAgents } from "@/server/secrets";
import { isUuid, jsonError, noStore, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { findSecrets, isBlockedKind } from "@/lib/secretScan";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** Replace the value, or change which agents may use it. */
export const PATCH = withUser<Ctx>(async (user, req, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "That secret is gone.");
  if (!(await rateLimit(`secrets:edit:${user.userId}`, 60, 3_600_000))) return jsonError(429, "That's a lot of changes. Try again later.");
  const b = await readJson(req, z.object({ value: z.string().min(1).max(8192).optional(), agents: z.array(z.string().min(1).max(80).regex(/^[a-z0-9-]+$/)).max(40).optional() }).strict());
  if (b instanceof Response) return b;
  if (b.value !== undefined) {
    const blocked = (await findSecrets(b.value)).find((f) => isBlockedKind(f.kind));
    if (blocked) return jsonError(400, `That looks like ${blocked.label}. Lexari never stores those.`);
    const s = await replaceSecret(user.userId, id, b.value);
    if (!b.agents) return Response.json({ secret: s }, { headers: noStore });
  }
  if (b.agents) return Response.json({ secret: await setSecretAgents(user.userId, id, b.agents) }, { headers: noStore });
  return jsonError(400, "Nothing to change.");
});

export const DELETE = withUser<Ctx>(async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "That secret is gone.");
  await deleteSecret(user.userId, id);
  return Response.json({ ok: true });
});
