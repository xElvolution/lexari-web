import { cookies } from "next/headers";
import { redeemDesktopCode } from "@/server/auth/desktop";
import { SESSION_COOKIE, sessionCookieOptions, startSession } from "@/server/auth/session";
import { clientIp, configError, jsonError, rateLimit, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The desktop app trades a one-time code for its own session cookie. Codes are single use and live 60 seconds. */
export async function POST(req: Request) {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    if (!(await rateLimit(`desktop-exchange:${clientIp(req)}`, 20))) return jsonError(429, "Too many sign-in attempts. Wait a minute.");
    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const userId = typeof body.code === "string" ? await redeemDesktopCode(body.code) : null;
    if (!userId) return jsonError(401, "That sign-in link expired or was already used. Sign in again.");
    const session = await startSession(userId, { ua: req.headers.get("user-agent") || "", ip: clientIp(req) });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expires));
    return Response.json({ ok: true, wallet: session.wallet }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
