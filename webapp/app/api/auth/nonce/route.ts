import { isWallet } from "@/server/auth/siws";
import { issueNonce } from "@/server/auth/session";
import { clientIp, configError, jsonError, rateLimit, readJson, requestOrigin, toErrorResponse } from "@/server/http";
import { nonceBody } from "@/server/validate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  const body = await readJson(req, nonceBody);
  if (body instanceof Response) return body;
  if (!isWallet(body.wallet)) return jsonError(400, "That is not a Solana wallet address.");
  try {
    if (!(await rateLimit(`nonce:${clientIp(req)}`, 20)) || !(await rateLimit(`nonce:w:${body.wallet}`, 10))) return jsonError(429, "Too many sign-in attempts. Wait a minute.");
    return Response.json(await issueNonce(body.wallet, requestOrigin(req)));
  } catch (error) {
    return toErrorResponse(error);
  }
}
