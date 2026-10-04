import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { pushSubs } from "@/server/db/schema";
import { readJson } from "@/server/http";
import { push, vapidPublicKey } from "@/server/notify";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subBody = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "https only"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
}).passthrough();

/** The public key the browser needs to subscribe, and how many of your browsers have push on. */
export const GET = withUser(async (user) => {
  const subs = await db().select({ id: pushSubs.id }).from(pushSubs).where(eq(pushSubs.userId, user.userId));
  return Response.json({ key: vapidPublicKey(), devices: subs.length }, { headers: { "cache-control": "no-store" } });
});

/** Save this browser's push subscription. With test: true, also sends a test notification. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, z.object({ sub: subBody, test: z.boolean().optional() }).strict());
  if (body instanceof Response) return body;
  const { endpoint, keys } = body.sub;
  await db().insert(pushSubs).values({ userId: user.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: pushSubs.endpoint, set: { userId: user.userId, p256dh: keys.p256dh, auth: keys.auth } });
  const sent = body.test ? await push(user.userId, { kind: "test", title: "Notifications are on", body: "This is how Lexari will reach you.", url: "/app" }) : 0;
  return Response.json({ ok: true, sent });
});

/** Turn push off for this browser. */
export const DELETE = withUser(async (user, req) => {
  const body = await readJson(req, z.object({ endpoint: z.string().max(1000) }).strict());
  if (body instanceof Response) return body;
  await db().delete(pushSubs).where(and(eq(pushSubs.userId, user.userId), eq(pushSubs.endpoint, body.endpoint)));
  return Response.json({ ok: true });
});
