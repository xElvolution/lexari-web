import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { agents, memories } from "@/server/db/schema";
import { recordEvent } from "@/server/events";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { memoryBody } from "@/server/validate";

export const runtime = "nodejs";

export const GET = withUser(async (user) => Response.json({
  memories: await db().select().from(memories).where(and(eq(memories.userId, user.userId), isNull(memories.deletedAt))),
}));

/** Stores an encrypted memory. The same content (hash) is stored once per person. */
export const POST = withUser(async (user, req) => {
  if (!(await rateLimit(`memory:${user.userId}`, 60))) return jsonError(429, "That's a lot of memories at once. Wait a minute.");
  const body = await readJson(req, memoryBody);
  if (body instanceof Response) return body;
  const database = db();
  const [agent] = await database.select().from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, body.agentSlug))).limit(1);
  if (!agent) return jsonError(404, "There is no such agent.");
  const [dupe] = await database.select({ id: memories.id }).from(memories)
    .where(and(eq(memories.userId, user.userId), eq(memories.contentHash, body.contentHash), isNull(memories.deletedAt))).limit(1);
  if (dupe) return Response.json({ id: dupe.id, duplicate: true });
  const [row] = await database.insert(memories).values({
    userId: user.userId, agentId: agent.id, tag: body.tag, source: body.source, ciphertext: body.ciphertext, iv: body.iv, contentHash: body.contentHash,
  }).returning({ id: memories.id });
  await recordEvent(user.userId, "memory", { ref: body.contentHash });
  return Response.json({ id: row?.id });
});
