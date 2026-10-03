import { currentSession } from "@/server/auth/session";
import { configError, jsonError, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const s = await currentSession();
    if (!s) return jsonError(401, "Not signed in.");
    return Response.json({ wallet: s.wallet, referralCode: s.referralCode, method: s.privyDid ? "google" : "wallet", email: s.email }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
