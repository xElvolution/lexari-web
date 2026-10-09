import { z } from "zod";
import { dripTestToken } from "@/server/topup/testTokens";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Devnet: about $3 of a Lexari test token (SKR, ORE, USDT, BONK, JUP) to your wallet, once a day per token. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, z.object({ rail: z.string().max(24).regex(/^[A-Z]+:solana$/) }).strict());
  if (b instanceof Response) return b;
  return Response.json(await dripTestToken(user.userId, user.wallet, b.rail));
});
