import { and, eq } from "drizzle-orm";
import { currentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { memories } from "@/server/db/schema";
import { configError, jsonError, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const session = await currentSession();
    if (!session) return jsonError(401, "Not signed in.");
    const { id } = await ctx.params;
    await db().update(memories).set({ deletedAt: new Date(), revoked: true }).where(and(eq(memories.id, id), eq(memories.userId, session.userId)));
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
