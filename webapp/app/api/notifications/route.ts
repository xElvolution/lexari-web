import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { readJson } from "@/server/http";
import { unreadCount } from "@/server/notify";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The bell: your latest 40 notifications and how many are unread. */
export const GET = withUser(async (user) => {
  const rows = await db().select().from(notifications).where(eq(notifications.userId, user.userId)).orderBy(desc(notifications.createdAt)).limit(40);
  return Response.json({
    unread: await unreadCount(user.userId),
    items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, url: r.url, read: !!r.readAt, at: r.createdAt.getTime() })),
  }, { headers: { "cache-control": "no-store" } });
});

/** Mark some (ids) or all as read. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, z.object({ ids: z.array(z.string().uuid()).max(100).optional(), url: z.string().max(300).optional(), keys: z.array(z.string().max(120)).max(20).optional() }).strict());
  if (body instanceof Response) return body;
  const where = body.keys?.length
    ? and(eq(notifications.userId, user.userId), inArray(notifications.key, body.keys), isNull(notifications.readAt))
    : body.url
    ? and(eq(notifications.userId, user.userId), eq(notifications.url, body.url), isNull(notifications.readAt))
    : body.ids?.length
    ? and(eq(notifications.userId, user.userId), inArray(notifications.id, body.ids), isNull(notifications.readAt))
    : and(eq(notifications.userId, user.userId), isNull(notifications.readAt));
  await db().update(notifications).set({ readAt: new Date() }).where(where);
  return Response.json({ unread: await unreadCount(user.userId) });
});
