import { withUser } from "@/server/route";
import { readJson } from "@/server/http";
import { developerOf, joinBody, joinWithInvite, listKeys, profileBody, requireDeveloper, updateProfile } from "@/server/market/developers";
import { developerListings } from "@/server/market/listings";
import { isAdmin } from "@/server/market/config";
import { logEvent } from "@/server/security";

export const runtime = "nodejs";

const view = (d: NonNullable<Awaited<ReturnType<typeof developerOf>>>) => ({ handle: d.handle, name: d.name, bio: d.bio, url: d.url, verified: d.verified, status: d.status, since: d.createdAt.getTime() });

/** Your developer account: profile, keys and listings, or null when you haven't joined the alpha. */
export const GET = withUser(async (user) => {
  const d = await developerOf(user.userId);
  const admin = isAdmin(user.wallet);
  if (!d) return Response.json({ developer: null, admin }, { headers: { "cache-control": "no-store" } });
  const [keys, listings] = await Promise.all([listKeys(d.id), developerListings(d.id)]);
  return Response.json({ developer: view(d), keys, listings, admin }, { headers: { "cache-control": "no-store" } });
});

/** Join the developer alpha with an invite code. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, joinBody);
  if (body instanceof Response) return body;
  const d = await joinWithInvite(user.userId, body);
  await logEvent(user, "settings", `Joined the developer alpha as @${d.handle}`);
  return Response.json({ developer: view(d) });
});

/** Update your public developer profile. */
export const PATCH = withUser(async (user, req) => {
  const body = await readJson(req, profileBody);
  if (body instanceof Response) return body;
  const d = await updateProfile(await requireDeveloper(user.userId), body);
  return Response.json({ developer: view(d) });
});
