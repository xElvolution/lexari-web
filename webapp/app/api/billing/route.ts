import { billingState } from "@/server/billing/state";
import { noStore } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Plan, usage meters, credits, spend limit, models per agent and chat, payment rails and recent payments. */
export const GET = withUser(async (user) => Response.json(await billingState(user.userId), { headers: noStore }));
