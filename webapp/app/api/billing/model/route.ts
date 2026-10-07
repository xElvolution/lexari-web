import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { isModelId, LAMINA } from "@/content/models";
import { db } from "@/server/db";
import { agents, chats } from "@/server/db/schema";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

const slug = z.string().min(1).max(80).regex(/^[\w-]+$/);
const body = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("agent"), agent: slug, model: z.string().max(40) }),
  /** model null: the chat follows its agent again */
  z.object({ scope: z.literal("chat"), convo: slug, model: z.string().max(40).nullable() }),
]);

/** Picks the model for one agent (all its chats) or for one chat. Lamina is stored as null (the default). */
export const PUT = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (b.model !== null && !isModelId(b.model)) return jsonError(400, "Pick a model from the list.");
  const database = db();
  if (b.scope === "agent") {
    const r = await database.update(agents).set({ model: b.model === LAMINA.id ? null : b.model, updatedAt: new Date() }).where(and(eq(agents.userId, user.userId), eq(agents.slug, b.agent))).returning({ id: agents.id });
    if (!r.length) return jsonError(404, "That agent is not on your team.");
    return Response.json({ ok: true });
  }
  const kind = b.convo.startsWith("g-") ? "group" : "dm";
  await database.insert(chats).values({ userId: user.userId, kind, slug: b.convo, title: b.convo, model: b.model })
    .onConflictDoUpdate({ target: [chats.userId, chats.slug], set: { model: b.model } });
  return Response.json({ ok: true });
});
