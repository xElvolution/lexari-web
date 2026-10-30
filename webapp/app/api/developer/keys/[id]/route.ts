import { withUser } from "@/server/route";
import { jsonError } from "@/server/http";
import { requireDeveloper, revokeKey } from "@/server/market/developers";
import { logEvent } from "@/server/security";

export const runtime = "nodejs";

/** Revoke a developer key. It stops working at once. */
export const DELETE = withUser<{ params: Promise<{ id: string }> }>(async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "There's no such active key.");
  const d = await requireDeveloper(user.userId);
  const k = await revokeKey(d.id, id);
  await logEvent(user, "settings", `Revoked developer key ${k.prefix}…`);
  return Response.json({ ok: true, view: k });
});
