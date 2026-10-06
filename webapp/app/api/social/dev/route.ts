import { z } from "zod";
import { jsonError, noStore, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { devLink, devSocialEnabled } from "@/server/social";
import { socialStatus } from "@/lib/socialInfo";

export const runtime = "nodejs";

/** Local testing only: links a pretend social account. 404 in production builds and unless LEXARI_DEV_SOCIAL=1. */
export const POST = withUser(async (user, req) => {
  if (!devSocialEnabled()) return jsonError(404, "Not found.");
  const body = await readJson(req, z.object({ provider: z.string(), handle: z.string().max(40) }));
  if (body instanceof Response) return body;
  const out = await devLink(user.userId, body.provider, body.handle);
  return Response.json({ ...out, status: socialStatus(out.links.length) }, { headers: noStore });
});
