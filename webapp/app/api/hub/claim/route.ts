import { buildClaim } from "@/server/hub/claims";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { claimBody } from "@/server/validate";

export const runtime = "nodejs";

/** A quest, box or referral-tier claim, built and attested by the server, for your wallet to sign. */
export const POST = withUser(async (user, req) => {
  if (!(await rateLimit(`claim:${user.userId}`, 20))) return jsonError(429, "Too many claims at once. Wait a minute.");
  const body = await readJson(req, claimBody);
  if (body instanceof Response) return body;
  return Response.json(await buildClaim(user, body));
});
