import { z } from "zod";
import { lockHashOf } from "@/server/lock";
import { noStore, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { grantStepUp, securityOf } from "@/server/security";

export const runtime = "nodejs";

/** What the confirm sheet needs: PIN or wallet, and your anti-phishing phrase. */
export const GET = withUser(async (user) => {
  const [pin, s] = await Promise.all([lockHashOf(user.userId), securityOf(user.userId)]);
  return Response.json({ method: pin ? "pin" : "wallet", phrase: s.phrase, session: user.sessionId.replace(/-/g, "").slice(0, 8), until: user.stepupUntil?.getTime() ?? 0 }, { headers: noStore });
});

const body = z.object({
  pin: z.string().regex(/^[0-9]{4,6}$/).optional(),
  message: z.string().max(200).optional(),
  signature: z.string().max(200).optional(),
}).strict();

/** Re-confirm it's you: high-risk actions on this device are allowed for the next 5 minutes. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  return Response.json(await grantStepUp(user, b), { headers: noStore });
});
