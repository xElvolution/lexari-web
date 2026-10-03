import { isWallet } from "@/server/auth/siws";
import { issueNonce } from "@/server/auth/session";
import { clientIp, configError, jsonError, rateLimit, readJson, requestOrigin, toErrorResponse } from "@/server/http";
import { nonceBody } from "@/server/validate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!rateLimit(`nonce:${clientIp(req)}`, 20)) return jsonError(429, "Too many sign-in attempts. Wait a minute.");
  const body = await readJson(req, nonceBody);
  if (body instanceof Response) return body;
  if (!isWallet(body.wallet)) return jsonError(400, "That is not a Solana wallet address.");
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    return Response.json(await issueNonce(body.wallet, requestOrigin(req)));
  } catch (error) {
    return toErrorResponse(error);
  }
}
