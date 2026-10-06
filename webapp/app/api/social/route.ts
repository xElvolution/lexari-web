import { z } from "zod";
import { jsonError, noStore, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { devSocialEnabled, socialSummary, socialVerifier, syncSocial, unlinkSocial } from "@/server/social";
import { isSocial, socialStatus } from "@/lib/socialInfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Your linked X, Discord and Telegram accounts and the status they give you. */
export const GET = withUser(async (user) => {
  const summary = await socialSummary(user.userId);
  return Response.json({ ...summary, verifier: socialVerifier(), dev: devSocialEnabled() }, { headers: noStore });
});

const syncBody = z.object({ idToken: z.string().min(20).max(20_000).optional(), accessToken: z.string().min(20).max(8_000).optional() })
  .refine((b) => b.idToken || b.accessToken, "idToken or accessToken is required");

/** Re-reads your linked accounts from Privy (verified on the server) and stores them. */
export const POST = withUser(async (user, req) => {
  if (!(await rateLimit(`social:${user.userId}`, 12))) return jsonError(429, "Too many tries. Wait a minute.");
  const body = await readJson(req, syncBody);
  if (body instanceof Response) return body;
  const out = await syncSocial(user, body);
  return Response.json({ ...out, status: socialStatus(out.links.length) }, { headers: noStore });
});

/** Removes a linked account from Lexari (the browser unlinks it from Privy first). */
export const DELETE = withUser(async (user, req) => {
  const provider = new URL(req.url).searchParams.get("provider");
  if (!isSocial(provider)) return jsonError(400, "Unknown account type.");
  const links = await unlinkSocial(user.userId, provider);
  return Response.json({ links, status: socialStatus(links.length) }, { headers: noStore });
});
