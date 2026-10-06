import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { agents, chats } from "@/server/db/schema";
import { recordEvent } from "@/server/events";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

const PER_MINUTE = Number(process.env.CHAT_PER_MINUTE || 12);
const PER_DAY = Number(process.env.CHAT_PER_DAY || 300);
const sentBody = z.object({ convo: z.string().min(1).max(80), userMsgId: z.string().min(4).max(40) });

/**
 * You just sent a message: it counts for the message quests now, not when the agent's reply finishes
 * (a message sent while the agent is still answering waits its turn before /api/chat sees it).
 * /api/chat records the same message id again when it saves it; (user, kind, ref) is unique, so it counts once.
 */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, sentBody);
  if (body instanceof Response) return body;
  const [perMin, perDay] = await Promise.all([rateLimit(`sent:m:${user.userId}`, PER_MINUTE), rateLimit(`sent:d:${user.userId}`, PER_DAY, 86_400_000)]);
  if (!perMin || !perDay) return jsonError(429, "That's a lot of messages. Wait a minute.");
  const database = db();
  const known = body.convo.startsWith("g-")
    ? (await database.select({ id: chats.id }).from(chats).where(and(eq(chats.userId, user.userId), eq(chats.slug, body.convo))).limit(1))[0]
    : (await database.select({ id: agents.id }).from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, body.convo))).limit(1))[0];
  if (!known) return jsonError(404, "There is no such chat.");
  await recordEvent(user.userId, "message", { ref: body.userMsgId });
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
});
