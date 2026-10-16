import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { connection } from "@/server/hub/chain";
import { FAUCET_CAP, drip, faucetOn, granted } from "@/server/faucet";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";

import { FAUCETS_ENABLED } from "@/lib/network";

export const runtime = "nodejs";

/** Faucets do not exist on a mainnet build (lib/network.ts). */
const gone = () => Response.json({ error: "There is no faucet on mainnet." }, { status: 404 });

/** Your devnet balance and how much the faucet can still send you. */
const getHandler = withUser(async (user) => {
  const [bal, got] = await Promise.all([connection().getBalance(new PublicKey(user.wallet), "confirmed").catch(() => null), granted(user.userId, user.wallet)]);
  return Response.json({ balance: bal, on: faucetOn(), left: Math.max(0, FAUCET_CAP - got), cap: FAUCET_CAP, sol: LAMPORTS_PER_SOL });
});

/** Sends devnet SOL from the Lexari faucet wallet to your wallet (capped per person). */
const postHandler = withUser(async (user, req) => {
  const body = await readJson(req, z.object({ need: z.number().int().min(0).max(1_000_000_000).optional() }).strict());
  if (body instanceof Response) return body;
  const r = await drip(user.userId, user.wallet, body.need);
  const balance = await connection().getBalance(new PublicKey(user.wallet), "confirmed").catch(() => null);
  return Response.json({ ...r, balance });
});

export const GET: typeof getHandler = (...a) => (FAUCETS_ENABLED ? getHandler(...a) : Promise.resolve(gone()));
export const POST: typeof postHandler = (...a) => (FAUCETS_ENABLED ? postHandler(...a) : Promise.resolve(gone()));
