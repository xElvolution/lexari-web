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
    const session = await verifySignIn(body, { ua: req.headers.get("user-agent") || "", ip: clientIp(req) });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expires));
    const mobile = new URL(req.url).searchParams.get("client") === "mobile"
      || (req.headers.get("x-lexari-client") || "").toLowerCase() === "android";
    return Response.json({
      wallet: session.wallet,
      referralCode: session.referralCode,
      ...(mobile ? { token: session.token, expires: session.expires.toISOString() } : {}),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
