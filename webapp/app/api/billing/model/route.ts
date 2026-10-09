import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { pickable } from "@/server/models";
import { db } from "@/server/db";
import { agents, chats } from "@/server/db/schema";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

const slug = z.string().min(1).max(80).regex(/^[\w-]+$/);
const body = z.discriminatedUnion("scope", [
  /** model null: the agent follows the account default (Settings > Models) */
  z.object({ scope: z.literal("agent"), agent: slug, model: z.string().max(160).nullable() }),
  /** model null: the chat follows its agent again */
  z.object({ scope: z.literal("chat"), convo: slug, model: z.string().max(160).nullable() }),
]);

/** Picks the model for one agent (all its chats) or for one chat. null = follow the account default. */
export const PUT = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (b.model !== null && !(await pickable(user.userId, b.model))) return jsonError(400, "Pick a model from the list.");
  const database = db();
  if (b.scope === "agent") {
    const r = await database.update(agents).set({ model: b.model, updatedAt: new Date() }).where(and(eq(agents.userId, user.userId), eq(agents.slug, b.agent))).returning({ id: agents.id });
    if (!r.length) return jsonError(404, "That agent is not on your team.");
    return Response.json({ ok: true });
  }
  const kind = b.convo.startsWith("g-") ? "group" : "dm";
  await database.insert(chats).values({ userId: user.userId, kind, slug: b.convo, title: b.convo, model: b.model })
    .onConflictDoUpdate({ target: [chats.userId, chats.slug], set: { model: b.model } });
  return Response.json({ ok: true });
});
