import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { pushDevices } from "@/server/db/schema";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  token: z.string().min(20).max(200).startsWith("ExponentPushToken"),
  platform: z.literal("android").default("android"),
  model: z.string().max(40).default(""),
}).strict();

export const POST = withUser(async (user, req) => {
  const parsed = await readJson(req, body);
  if (parsed instanceof Response) return parsed;
  await db().insert(pushDevices).values({
    userId: user.userId, expoPushToken: parsed.token, platform: parsed.platform, model: parsed.model, lastSeenAt: new Date(),
  }).onConflictDoUpdate({
    target: pushDevices.expoPushToken,
    set: { userId: user.userId, model: parsed.model, lastSeenAt: new Date() },
  });
  return Response.json({ ok: true });
});

export const DELETE = withUser(async (user, req) => {
  const parsed = await readJson(req, z.object({ token: z.string().min(20).max(200) }).strict());
  if (parsed instanceof Response) return parsed;
  await db().delete(pushDevices).where(and(eq(pushDevices.userId, user.userId), eq(pushDevices.expoPushToken, parsed.token)));
  return Response.json({ ok: true });
});
