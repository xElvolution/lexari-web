import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { agents, chats } from "@/server/db/schema";
import { jsonError, readJson } from "@/server/http";
import { agentNotes } from "@/server/validate";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Remove an agent you made, or release a hired specialist. Your home agent stays. */
export const DELETE = withUser<{ params: Promise<{ slug: string }> }>(async (user, _req, ctx) => {
  const { slug } = await ctx.params;
  if (slug === "home") return jsonError(400, "Your home agent can't be removed.");
  const database = db();
  const [row] = await database.select().from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, slug))).limit(1);
  if (!row) return jsonError(404, "There is no such agent.");
  if (row.asset) return jsonError(400, "This agent has an onchain ID card. Transfer the card instead.");
  await database.delete(agents).where(eq(agents.id, row.id));
  await database.delete(chats).where(and(eq(chats.userId, user.userId), eq(chats.slug, slug)));
  return Response.json({ ok: true });
});

/** Your own nickname, notes and memory switch for any agent on your team, hired ones included. */
export const PATCH = withUser<{ params: Promise<{ slug: string }> }>(async (user, req, ctx) => {
  const { slug } = await ctx.params;
  const body = await readJson(req, agentNotes);
  if (body instanceof Response) return body;
  const database = db();
  const [row] = await database.select().from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, slug))).limit(1);
  if (!row) return jsonError(404, "There is no such agent.");
  const { memoryOn, ...meta } = body;
  await database.update(agents).set({ meta: sql`coalesce(${agents.meta}, '{}'::jsonb) || ${JSON.stringify(meta)}::jsonb`, ...(memoryOn === undefined ? {} : { memoryOn }), updatedAt: new Date() }).where(eq(agents.id, row.id));
  return Response.json({ ok: true });
});
