import { desktopReturnUrl, mintDesktopCode } from "@/server/auth/desktop";
import { jsonError, rateLimit } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed in on the web with ?desktop=1: get the lexari:// URL that carries a one-time code back to the desktop app. */
export const POST = withUser(async (user, req) => {
  const body = (await req.json().catch(() => ({}))) as { return?: unknown };
  const ret = desktopReturnUrl(body.return);
  if (!ret) return jsonError(400, "Only lexari:// return links are allowed.");
  if (!(await rateLimit(`desktop-code:${user.userId}`, 10))) return jsonError(429, "Too many tries. Wait a minute.");
  const code = await mintDesktopCode(user.userId);
  const url = new URL(ret);
  url.searchParams.set("code", code);
  return Response.json({ url: url.toString(), expiresIn: 60 }, { headers: { "cache-control": "no-store" } });
});
