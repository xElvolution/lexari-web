import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { chats, messages } from "@/server/db/schema";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { groupBody } from "@/server/validate";

export const runtime = "nodejs";

/** Create or update a group chat. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, groupBody);
  if (body instanceof Response) return body;
  const database = db();
  const [existing] = await database.select().from(chats).where(and(eq(chats.userId, user.userId), eq(chats.slug, body.slug))).limit(1);
  if (existing) await database.update(chats).set({ title: body.title, memberSlugs: body.members, updatedAt: new Date() }).where(eq(chats.id, existing.id));
  else await database.insert(chats).values({ userId: user.userId, kind: "group", slug: body.slug, title: body.title, memberSlugs: body.members });
  return Response.json({ ok: true });
});

/** Clear every chat's messages. Agents, groups and memory stay. */
export const DELETE = withUser(async (user) => {
  const mine = db().select({ id: chats.id }).from(chats).where(eq(chats.userId, user.userId));
  await db().delete(messages).where(inArray(messages.chatId, mine));
  return Response.json({ ok: true });
});
