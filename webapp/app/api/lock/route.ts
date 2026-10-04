import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { jsonError, readJson } from "@/server/http";
import { checkPin, hashPin, lockHashOf } from "@/server/lock";
import { withUser } from "@/server/route";
import { lockBody, lockCheckBody } from "@/server/validate";
import { z } from "zod";

export const runtime = "nodejs";

export const GET = withUser(async (user) => Response.json({ on: !!(await lockHashOf(user.userId)) }));

/** Set or change the PIN. Changing needs the current PIN. */
export const PUT = withUser(async (user, req) => {
  const body = await readJson(req, lockBody);
  if (body instanceof Response) return body;
  if (await lockHashOf(user.userId)) {
    if (!body.current) return jsonError(400, "Enter your current PIN first.");
    await checkPin(user.userId, body.current);
  }
  await db().update(users).set({ lockHash: await hashPin(body.pin) }).where(eq(users.id, user.userId));
  return Response.json({ on: true });
});

/** Check the PIN (unlock). */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, lockCheckBody);
  if (body instanceof Response) return body;
  await checkPin(user.userId, body.pin);
  return Response.json({ ok: true });
});

/** Turn the lock off (needs the PIN). */
export const DELETE = withUser(async (user, req) => {
  const body = await readJson(req, z.object({ pin: z.string().regex(/^[0-9]{4,6}$/) }).strict());
  if (body instanceof Response) return body;
  await checkPin(user.userId, body.pin);
  await db().update(users).set({ lockHash: null, lockCreds: [] }).where(eq(users.id, user.userId));
  return Response.json({ on: false });
});
