import { z } from "zod";
import { startCheckout } from "@/server/billing/checkout";
import { jsonError, rateLimit, readJson, requestOrigin } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

const body = z.object({ rail: z.enum(["card", "crypto"]), product: z.enum(["plan", "credits"]), id: z.string().min(1).max(20) });

/** Starts paying Lexari for a plan or extra credits. Card returns a hosted checkout URL; crypto returns a USDC request. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (!(await rateLimit(`checkout:${user.userId}`, 30, 3_600_000))) return jsonError(429, "Too many payment attempts. Try again in a while.");
  return Response.json(await startCheckout(user, b, requestOrigin(req).uri));
});
