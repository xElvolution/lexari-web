import { z } from "zod";
import { checkDeposit, depositInfo } from "@/server/topup/deposits";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

const body = z.object({ rail: z.string().max(24).regex(/^[A-Z]+:[a-z]+$/), check: z.boolean().optional() }).strict();

/** Your deposit address for a coin on a network (content/topup.ts), and what has arrived. check: true only re-checks the chain. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (!(await rateLimit(`topup:dep:${user.userId}`, 240, 3_600_000))) return jsonError(429, "Checking a lot. Wait a minute and try again.");
  return Response.json(b.check ? await checkDeposit(user.userId, b.rail) : await depositInfo(user.userId, b.rail));
});
