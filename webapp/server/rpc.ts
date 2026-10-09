/**
 * Solana RPC for the server, with a private endpoint when one is configured.
 *
 * Which endpoint (first match wins):
 *   1. SOLANA_RPC set to anything that is not a public solana.com endpoint (your own provider, a local validator)
 *   2. SOLAMI_API_KEY on mainnet: Solami RPC (sendTransaction with a tip routes through Beam; see server/solami.ts)
 *   2b. HELIUS_API_KEY: Helius for the configured cluster (devnet.helius-rpc.com or mainnet.helius-rpc.com)
 *   3. SOLANA_RPC / NEXT_PUBLIC_SOLANA_RPC as given, else the public endpoint for the cluster
 *
 * Every call goes through a fetch with bounded backoff on 429 and 5xx (honouring Retry-After), and when a private
 * endpoint is down the request is tried once on the public endpoint, so a provider outage degrades instead of failing.
 * The key never leaves the server: the browser reaches the private endpoint through /api/rpc.
 */
import { Connection, type Commitment } from "@solana/web3.js";

export const cluster = () => (process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet");
export const publicRpcUrl = () => (cluster() === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
const isPublicSolana = (u: string) => /^https?:\/\/api\.(devnet|mainnet-beta|testnet)\.solana\.com\/?$/i.test(u.trim());

export type RpcSource = "custom" | "solami" | "helius" | "public";
export function rpcChoice(): { url: string; source: RpcSource } {
  const override = (process.env.SOLANA_RPC || "").trim();
  if (override && !isPublicSolana(override)) return { url: override, source: "custom" };
  // Solami (server/solami.ts) serves Solana mainnet only; on mainnet it's the data path when SOLAMI_API_KEY is set.
  const solami = (process.env.SOLAMI_API_KEY || "").trim();
  if (solami && cluster() === "mainnet-beta") return { url: `https://rpc.solami.dev/sol?api_key=${encodeURIComponent(solami)}`, source: "solami" };
  const key = (process.env.HELIUS_API_KEY || "").trim();
  if (key) return { url: `https://${cluster() === "mainnet-beta" ? "mainnet" : "devnet"}.helius-rpc.com/?api-key=${encodeURIComponent(key)}`, source: "helius" };
  const pub = (process.env.NEXT_PUBLIC_SOLANA_RPC || "").trim();
  return { url: override || pub || publicRpcUrl(), source: "public" };
}
export const rpcUrl = () => rpcChoice().url;
/** True when the server talks to a private endpoint (the browser should then go through /api/rpc). */
export const privateRpc = () => rpcChoice().source !== "public";
/** For logs and health checks: never includes the key. */
export const rpcLabel = () => { const c = rpcChoice(); if (c.source !== "custom") return c.source; try { return `custom (${new URL(c.url).host})`; } catch { return "custom"; } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number, retryAfter: string | null) => {
  const ra = Number(retryAfter);
  if (Number.isFinite(ra) && ra > 0) return Math.min(ra * 1000, 4000);
  return Math.min(250 * 2 ** attempt, 2000) + Math.floor(Math.random() * 120);
};

let cooldownUntil = 0; // after repeated 429s from the private endpoint, rest it briefly and use the public one
/**
 * fetch for web3.js and the /api/rpc proxy. `tries` bounds retries (txlog uses 1 so a rate limit never stalls a page).
 */
export function rpcFetch(tries = 3) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const primary = String(input instanceof Request ? input.url : input);
    const fallback = privateRpc() && primary === rpcUrl() ? publicRpcUrl() : null;
    const target = fallback && Date.now() < cooldownUntil ? fallback : primary;
    let last: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        const res = await fetch(target, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000) });
        if (res.status !== 429 && res.status < 500) return res;
        last = res;
        if (attempt < tries - 1) await sleep(backoff(attempt, res.headers.get("retry-after")));
      } catch (e) {
        lastErr = e;
        if (attempt < tries - 1) await sleep(backoff(attempt, null));
      }
    }
    if (fallback && target !== fallback) {
      if (last?.status === 429) cooldownUntil = Date.now() + 10_000;
      try { return await fetch(fallback, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000) }); } catch (e) { lastErr = e; }
    }
    if (last) return last;
    throw lastErr instanceof Error ? lastErr : new Error("Solana RPC unreachable");
  };
}

const conns = new Map<string, Connection>();
/** A shared Connection. `fast` fails quickly on a rate limit (one try, no web3.js retry loop). */
export function serverConnection(opts: { fast?: boolean; commitment?: Commitment } = {}) {
  const url = rpcUrl();
  const key = `${url}|${opts.fast ? 1 : 0}|${opts.commitment || "confirmed"}`;
  let c = conns.get(key);
  if (!c) {
    c = new Connection(url, { commitment: opts.commitment || "confirmed", disableRetryOnRateLimit: true, fetch: rpcFetch(opts.fast ? 1 : 3) as typeof fetch });
    conns.set(key, c);
  }
  return c;
}
