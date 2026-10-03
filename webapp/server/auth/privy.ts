/**
 * Privy access-token check. Privy signs access tokens (ES256) with a per-app key that is public:
 * PRIVY_VERIFICATION_KEY if set, otherwise fetched once from Privy's app config. No app secret needed.
 */
import { importSPKI, jwtVerify, type KeyLike } from "jose";
import { HttpError } from "../http";

let cached: { key: KeyLike; at: number } | null = null;

async function verificationKey(appId: string): Promise<KeyLike> {
  if (cached && Date.now() - cached.at < 6 * 3600_000) return cached.key;
  let pem = process.env.PRIVY_VERIFICATION_KEY?.replace(/\\n/g, "\n").trim();
  if (!pem) {
    const res = await fetch(`https://auth.privy.io/api/v1/apps/${appId}`, { headers: { "privy-app-id": appId }, signal: AbortSignal.timeout(8000) });
    const body = (await res.json().catch(() => ({}))) as { verification_key?: string };
    pem = body.verification_key;
  }
  if (!pem) throw new HttpError(503, "Google and email sign-in are not available right now.");
  const key = await importSPKI(pem, "ES256");
  cached = { key, at: Date.now() };
  return key;
}

/** Returns the Privy user id (did:privy:...) when the token is valid for this app. */
export async function verifyPrivyToken(token: string): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) throw new HttpError(503, "Google and email sign-in are not set up here.");
  try {
    const { payload } = await jwtVerify(token, await verificationKey(appId), { issuer: "privy.io", audience: appId });
    if (typeof payload.sub !== "string" || !payload.sub.startsWith("did:privy:")) throw new Error("bad sub");
    return payload.sub;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, "Your Google or email sign-in expired. Try again.");
  }
}
