import { z } from "zod";
import { capFor, costReport, setAgentCap } from "@/server/billing/costs";
import { noStore, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { requireStepUp } from "@/server/security";

export const runtime = "nodejs";

/** Settings > Billing > Costs: this cycle's model spend by agent, model and day, with each agent's cap. */
export const GET = withUser(async (user) => Response.json(await costReport(user.userId), { headers: noStore }));

const body = z.object({ agent: z.string().trim().min(1).max(60), capUsd: z.number().min(0).max(500).nullable() });

/** Sets or removes one agent's cap for a billing cycle. Raising or removing a cap asks for the same step-up as raising the spend limit. */
export const PUT = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const next = b.capUsd === null ? null : Math.round(b.capUsd * 100) * 10_000;
  const cur = await capFor(user.userId, b.agent);
  if (cur !== null && (next === null || next > cur)) requireStepUp(user, "raise an agent's model cap");
  await setAgentCap(user.userId, b.agent, next);
  return Response.json(await costReport(user.userId), { headers: noStore });
});
