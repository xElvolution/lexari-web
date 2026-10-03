import { confirmSignature } from "@/server/hub/confirm";
import { hubState } from "@/server/hub/state";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { signatureBody } from "@/server/validate";

export const runtime = "nodejs";

/** Records a confirmed Lexari transaction (check-in, level-up, claim, mint, memory) and returns the new Hub state. */
export const POST = withUser(async (user, req) => {
  if (!(await rateLimit(`confirm:${user.userId}`, 60))) return jsonError(429, "Too many requests. Wait a minute.");
  const body = await readJson(req, signatureBody);
  if (body instanceof Response) return body;
  const result = await confirmSignature(user, body.signature);
  return Response.json({ ...result, state: await hubState(user) });
});
