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
  if (body.re) await db().update(messages).set({ metaJson: sql`coalesce(${messages.metaJson}, '{}'::jsonb) || ${JSON.stringify({ re: body.re })}::jsonb` })
    .where(and(eq(messages.chatId, chat.id), eq(messages.clientId, body.clientId)));
  if (body.send) {
    const [row] = await db().select().from(messages).where(and(eq(messages.chatId, chat.id), eq(messages.clientId, body.clientId))).limit(1);
    const cur = (row?.metaJson as { send?: { to: string; sol: number; status: string } } | null)?.send;
    if (!row || !cur) return jsonError(404, "There is no such transfer.");
    if (cur.status !== "pending") return jsonError(409, "That transfer was already handled.");
    const send = { ...cur, ...body.send };
    await db().update(messages).set({ metaJson: sql`coalesce(${messages.metaJson}, '{}'::jsonb) || ${JSON.stringify({ send })}::jsonb` }).where(eq(messages.id, row.id));
  }
  return Response.json({ ok: true });
});
