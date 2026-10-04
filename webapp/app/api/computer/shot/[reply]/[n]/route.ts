import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { userMedia } from "@/server/db/schema";
import { jsonError } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ reply: string; n: string }> };

/** A screenshot your agent attached to a reply (only yours). */
export const GET = withUser<Ctx>(async (user, _req, ctx) => {
  const { reply, n } = await ctx.params;
  if (!/^[\w-]{1,80}$/.test(reply) || !/^\d{1,2}$/.test(n)) return jsonError(404, "Not found.");
  const [row] = await db().select({ mime: userMedia.mime, data: userMedia.data }).from(userMedia).where(and(eq(userMedia.userId, user.userId), eq(userMedia.kind, `cu:${reply}:${n}`))).limit(1);
  if (!row) return jsonError(404, "That screenshot is gone.");
  return new Response(new Uint8Array(row.data), { headers: { "content-type": row.mime, "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
});
