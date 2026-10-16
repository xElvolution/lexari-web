import { z } from "zod";
import { dripTestToken } from "@/server/topup/testTokens";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";

import { FAUCETS_ENABLED } from "@/lib/network";

export const runtime = "nodejs";

/** Faucets do not exist on a mainnet build (lib/network.ts). */
const gone = () => Response.json({ error: "There is no faucet on mainnet." }, { status: 404 });

/** Devnet: about $3 of a Lexari test token (SKR, ORE, USDT, BONK, JUP) to your wallet, once a day per token. */
const postHandler = withUser(async (user, req) => {
  const b = await readJson(req, z.object({ rail: z.string().max(24).regex(/^[A-Z]+:solana$/) }).strict());
  if (b instanceof Response) return b;
  return Response.json(await dripTestToken(user.userId, user.wallet, b.rail));
});
export const POST: typeof postHandler = (...a) => (FAUCETS_ENABLED ? postHandler(...a) : Promise.resolve(gone()));
