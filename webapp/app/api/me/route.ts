import { eq } from "drizzle-orm";
import { loadAccount } from "@/server/account";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { mePatch } from "@/server/validate";

export const runtime = "nodejs";

export const GET = withUser(async (user) => Response.json(await loadAccount(user), { headers: { "cache-control": "no-store" } }));

/** Profile and preferences. Merged into what is stored. */
export const PATCH = withUser(async (user, req) => {
  const body = await readJson(req, mePatch);
  if (body instanceof Response) return body;
  const [me] = await db().select({ profile: users.profile, prefs: users.prefs }).from(users).where(eq(users.id, user.userId)).limit(1);
  const profile = body.profile ? { ...(me?.profile || {}), ...body.profile } : me?.profile;
  // boxReset is set by support only (a fresh mystery box today); people cannot set it themselves.
  const incoming = body.prefs ? Object.fromEntries(Object.entries(body.prefs).filter(([k]) => k !== "boxReset")) : null;
  const prefs = incoming ? { ...(me?.prefs || {}), ...incoming } : me?.prefs;
  if (JSON.stringify(prefs || {}).length > 20_000) return Response.json({ error: "Too many settings." }, { status: 400 });
  await db().update(users).set({ profile: profile || {}, prefs: prefs || {} }).where(eq(users.id, user.userId));
  return Response.json({ ok: true });
});
