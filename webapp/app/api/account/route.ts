import { eq } from "drizzle-orm";
import { loadAccount } from "@/server/account";
import { destroySession } from "@/server/auth/session";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { withUser } from "@/server/route";
import { listSocial } from "@/server/social";

export const runtime = "nodejs";

/** Export everything we store for this person (memories stay encrypted). */
export const GET = withUser(async (user) => {
  const [data, socialLinks] = await Promise.all([loadAccount(user), listSocial(user.userId)]);
  return new Response(JSON.stringify({ exported: new Date().toISOString(), ...data, socialLinks }, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="lexari-export.json"', "cache-control": "no-store" },
  });
});

/** Delete the account and everything tied to it. Onchain records stay onchain and stay yours. */
export const DELETE = withUser(async (user) => {
  await db().delete(users).where(eq(users.id, user.userId));
  await destroySession().catch(() => {});
  return Response.json({ ok: true });
});
