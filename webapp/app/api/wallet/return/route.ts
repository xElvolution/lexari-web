import { returnToBalance } from "@/server/agentWallets";
import { balanceView } from "@/server/billing/balance";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { agentReturnBody } from "@/server/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Sends what's left in an agent's wallet back to your Lexari balance. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, agentReturnBody);
  if (body instanceof Response) return body;
  const r = await returnToBalance(user.userId, body.agent);
  const { balance } = await balanceView(user.userId);
  return Response.json({ ...r, balance });
});
