import { cookies } from "next/headers";
import { SESSION_COOKIE, currentSession } from "@/server/auth/session";
import { clientIp, jsonError } from "@/server/http";
import { privateRpc, rpcFetch, rpcUrl } from "@/server/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The browser's Solana RPC when the server has a private endpoint (Helius or SOLANA_RPC). The key stays on the server.
 * Only the read and send methods the app uses are forwarded; slow-changing answers are cached briefly so many open
 * tabs don't spend the provider's rate limit on the same question.
 */
const ALLOWED = new Set([
  "getAccountInfo", "getBalance", "getBlockHeight", "getEpochInfo", "getFeeForMessage", "getGenesisHash", "getHealth",
  "getLatestBlockhash", "getMinimumBalanceForRentExemption", "getMultipleAccounts", "getParsedAccountInfo", "getRecentPrioritizationFees",
  "getSignatureStatuses", "getSignaturesForAddress", "getSlot", "getTokenAccountBalance", "getTokenAccountsByOwner", "getTransaction",
  "getVersion", "isBlockhashValid", "sendTransaction", "simulateTransaction", "getTokenSupply", "getAsset", "getAssetsByOwner",
]);
const TTL: Record<string, number> = {
  getGenesisHash: 3_600_000, getVersion: 600_000, getMinimumBalanceForRentExemption: 3_600_000, getEpochInfo: 5_000,
  getLatestBlockhash: 1_500, getBalance: 2_000, getAccountInfo: 2_000, getMultipleAccounts: 2_000, getTokenAccountsByOwner: 4_000,
  getTokenAccountBalance: 3_000, getSignaturesForAddress: 4_000, getSlot: 1_000, getBlockHeight: 1_000, getAsset: 30_000, getAssetsByOwner: 10_000,
};
const cache = new Map<string, { at: number; body: unknown }>();
const buckets = new Map<string, { tokens: number; at: number }>();
const RATE = 20; // requests a second per client, burst 60
function allow(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip) || { tokens: 60, at: now };
  b.tokens = Math.min(60, b.tokens + ((now - b.at) / 1000) * RATE); b.at = now;
  if (b.tokens < 1) { buckets.set(ip, b); return false; }
  b.tokens -= 1; buckets.set(ip, b);
  if (buckets.size > 5000) buckets.clear();
  return true;
}
type Call = { jsonrpc: "2.0"; id: unknown; method: string; params?: unknown };

async function one(call: Call) {
  if (!call || typeof call.method !== "string" || !ALLOWED.has(call.method)) return { jsonrpc: "2.0", id: call?.id ?? null, error: { code: -32601, message: "Method not available through Lexari." } };
  const ttl = TTL[call.method];
  const key = ttl ? `${call.method}:${JSON.stringify(call.params ?? [])}` : "";
  if (key) { const hit = cache.get(key); if (hit && Date.now() - hit.at < ttl) return { ...(hit.body as object), id: call.id }; }
  const res = await rpcFetch(call.method === "sendTransaction" ? 1 : 3)(rpcUrl(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(call) });
  const body = (await res.json().catch(() => null)) as { result?: unknown; error?: unknown } | null;
  if (!body) return { jsonrpc: "2.0", id: call.id, error: { code: -32603, message: `RPC answered ${res.status}` } };
  if (key && body.result !== undefined && !body.error) { cache.set(key, { at: Date.now(), body }); if (cache.size > 4000) cache.clear(); }
  return { ...body, id: call.id };
}

/** Signed-in people only, so the private endpoint is not an open relay. Sessions are remembered for 5 minutes. */
const known = new Map<string, number>();
async function signedIn() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const at = known.get(token);
  if (at && Date.now() - at < 300_000) return true;
  const ok = !!(await currentSession().catch(() => null));
  if (ok) { known.set(token, Date.now()); if (known.size > 10_000) known.clear(); }
  return ok;
}

export async function POST(req: Request) {
  if (!privateRpc()) return jsonError(404, "No private RPC on this server.");
  if (!(await signedIn())) return jsonError(401, "Sign in to use Lexari's Solana connection.");
  if (!allow(clientIp(req))) return Response.json({ jsonrpc: "2.0", id: null, error: { code: 429, message: "Too many requests" } }, { status: 429, headers: { "retry-after": "1" } });
  const text = await req.text();
  if (text.length > 1_500_000) return jsonError(413, "Too large.");
  let parsed: Call | Call[];
  try { parsed = JSON.parse(text); } catch { return jsonError(400, "Expected JSON-RPC."); }
  try {
    const out = Array.isArray(parsed) ? await Promise.all(parsed.slice(0, 50).map(one)) : await one(parsed);
    return Response.json(out, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ jsonrpc: "2.0", id: Array.isArray(parsed) ? null : parsed.id ?? null, error: { code: -32603, message: "Solana RPC unreachable" } }, { status: 502 });
  }
}
