import { currentSession } from "@/server/auth/session";
import { configError, jsonError, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const session = await currentSession();
    if (!session) return jsonError(401, "Not signed in.");
    return Response.json({ wallet: session.wallet, referralCode: session.referralCode });
  } catch (error) {
    return toErrorResponse(error);
  }
}
