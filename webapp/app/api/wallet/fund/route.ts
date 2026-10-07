import { fundAgent } from "@/server/agentWallets";
import { balanceView } from "@/server/billing/balance";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { fundAgentBody } from "@/server/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Fund agent: dollars from your balance become test USDC in the agent's Solana wallet (devnet only). */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, fundAgentBody);
  if (body instanceof Response) return body;
  const { funding, already } = await fundAgent(user.userId, body.agent, body.usd, body.key);
  const { balance } = await balanceView(user.userId);
  return Response.json({ funding: { id: funding.id, status: funding.status, sig: funding.txSig, amount: funding.amount, address: funding.address }, already, balance });
});
