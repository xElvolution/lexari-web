import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { chats } from "@/server/db/schema";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

export const DELETE = withUser<{ params: Promise<{ slug: string }> }>(async (user, _req, ctx) => {
  const { slug } = await ctx.params;
  await db().delete(chats).where(and(eq(chats.userId, user.userId), eq(chats.slug, slug)));
  return Response.json({ ok: true });
});
