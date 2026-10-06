import { PLANS } from "@/content/appData";
import { jsonError } from "@/server/http";
import { currentPlan, seatsUsed } from "@/server/plans";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

export const GET = withUser(async (user) => {
  const [plan, used] = await Promise.all([currentPlan(user.userId), seatsUsed(user.userId)]);
  return Response.json({ plan, used, plans: PLANS });
});

/** Plans are priced in USD now and bought through /api/billing/checkout (card or USDC). The old devnet SOL purchase is closed. */
export const POST = withUser(async () => jsonError(410, "Plans are paid by card or USDC now. Open Settings, then Billing."));
