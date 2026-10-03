import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { chats, messages } from "@/server/db/schema";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { messageBody, reactionBody } from "@/server/validate";

export const runtime = "nodejs";

async function chatFor(userId: string, slug: string) {
  const database = db();
  const [found] = await database.select().from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, slug))).limit(1);
  if (found) return found;
  const [made] = await database.insert(chats).values({ userId, kind: slug.startsWith("g-") ? "group" : "dm", slug, title: slug }).onConflictDoNothing().returning();
  return made || (await database.select().from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, slug))).limit(1))[0];
}

/** A system line in a chat (a call log). Agent and user messages are saved by /api/chat. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, messageBody);
  if (body instanceof Response) return body;
  const chat = await chatFor(user.userId, body.convo);
  await db().insert(messages).values({ chatId: chat.id, fromId: "system", text: body.text, metaJson: body.meta, clientId: body.clientId }).onConflictDoNothing();
  return Response.json({ ok: true });
});

/** Reactions on a message. */
export const PATCH = withUser(async (user, req) => {
  const body = await readJson(req, reactionBody);
  if (body instanceof Response) return body;
  const [chat] = await db().select().from(chats).where(and(eq(chats.userId, user.userId), eq(chats.slug, body.convo))).limit(1);
  if (!chat) return jsonError(404, "There is no such chat.");
  await db().update(messages).set({ metaJson: sql`coalesce(${messages.metaJson}, '{}'::jsonb) || ${JSON.stringify({ re: body.re })}::jsonb` })
    .where(and(eq(messages.chatId, chat.id), eq(messages.clientId, body.clientId)));
  return Response.json({ ok: true });
});
