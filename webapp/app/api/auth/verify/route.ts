import { cookies } from "next/headers";
import { isWallet } from "@/server/auth/siws";
import { SESSION_COOKIE, sessionCookieOptions, verifySignIn } from "@/server/auth/session";
import { clientIp, configError, jsonError, rateLimit, readJson, toErrorResponse } from "@/server/http";
import { verifyBody } from "@/server/validate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  const body = await readJson(req, verifyBody);
  if (body instanceof Response) return body;
  if (!isWallet(body.wallet)) return jsonError(400, "That is not a Solana wallet address.");
  try {
    if (!(await rateLimit(`verify:${clientIp(req)}`, 20))) return jsonError(429, "Too many sign-in attempts. Wait a minute.");
    const session = await verifySignIn(body);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expires));
    return Response.json({ wallet: session.wallet, referralCode: session.referralCode });
  } catch (error) {
    return toErrorResponse(error);
  }
}
