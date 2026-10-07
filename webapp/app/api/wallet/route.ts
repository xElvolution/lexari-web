import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { agents } from "@/server/db/schema";
import { balanceView } from "@/server/billing/balance";
import { CHAINS, FUND_AMOUNTS, MAX_FUND_USD, fundingHistory, fundingOn, walletsFor, type AgentWallet } from "@/server/agentWallets";
import { cluster } from "@/server/config";
import { withUser } from "@/server/route";
import { CARD_USD, HIRE_USD } from "@/lib/prices";

export const runtime = "nodejs";

/**
 * The Wallet tab: your Lexari balance in dollars with its history, then each of your agents' own wallets.
 * ?agent=slug returns just that agent's wallets (for the agent panel).
 */
export const GET = withUser(async (user, req) => {
  const only = new URL(req.url).searchParams.get("agent");
  const database = db();
  const rows = await database.select({ slug: agents.slug, kind: agents.kind, name: agents.name }).from(agents)
    .where(only ? and(eq(agents.userId, user.userId), eq(agents.slug, only)) : eq(agents.userId, user.userId));
  const team = [...rows].sort((a, b) => Number(b.slug === "home") - Number(a.slug === "home"));
  const wallets = await Promise.all(team.map(async (a) => ({ slug: a.slug, kind: a.kind, name: a.name, wallets: await walletsFor(user.userId, a.slug, a.kind).catch(() => [] as AgentWallet[]) })));
  const fundings = await fundingHistory(user.userId, only || undefined);
  const base = { agents: wallets, fundings, chains: CHAINS, funding: { on: fundingOn(), network: cluster(), amounts: FUND_AMOUNTS, max: MAX_FUND_USD }, prices: { hireUsd: HIRE_USD, cardUsd: CARD_USD } };
  if (only) return Response.json(base);
  return Response.json({ ...(await balanceView(user.userId)), ...base });
});
