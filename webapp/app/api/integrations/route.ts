import { z } from "zod";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { addIntegration, listIntegrations } from "@/server/integrations/grants";

export const runtime = "nodejs";

/** Settings > Integrations: whether it's unlocked (a linked social account), what you added, and your agents. */
export const GET = withUser(async (user) => Response.json(await listIntegrations(user.userId), { headers: { "cache-control": "no-store" } }));

const addBody = z.object({
  connector: z.string().min(2).max(30),
  agents: z.array(z.string().min(1).max(80)).max(50).default([]),
  enabled: z.boolean().optional(),
  perTxUsd: z.number().int().optional(),
  dailyUsd: z.number().int().optional(),
  maxSlippageBps: z.number().int().optional(),
}).strict();

/** Add an integration with the agents that may use it and its limits. Needs a linked X, Discord or Telegram account. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, addBody);
  if (body instanceof Response) return body;
  const { connector, ...rest } = body;
  await addIntegration(user.userId, connector, rest);
  return Response.json(await listIntegrations(user.userId));
});
