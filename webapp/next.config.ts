import type { NextConfig } from "next";
import path from "node:path";
import { securityHeaders } from "../shared/securityHeaders";

/** Same rule as server/rpc.ts: a HELIUS_API_KEY, or a SOLANA_RPC that is not a public solana.com endpoint. */
function privateRpcConfigured() {
  const o = (process.env.SOLANA_RPC || "").trim();
  return !!(process.env.HELIUS_API_KEY || "").trim() || (!!o && !/^https?:\/\/api\.(devnet|mainnet-beta|testnet)\.solana\.com\/?$/i.test(o));
}

/**
 * Network mode (lib/network.ts), fixed at build time. LEXARI_NETWORK picks it; the browser bundle gets the same value
 * through NEXT_PUBLIC_LEXARI_NETWORK, and the Solana cluster follows it. A conflicting NEXT_PUBLIC_SOLANA_CLUSTER
 * stops the build instead of producing a mainnet app that talks to devnet (or the reverse).
 */
function networkMode() {
  const raw = (process.env.LEXARI_NETWORK || process.env.NEXT_PUBLIC_LEXARI_NETWORK || "testnet").trim().toLowerCase();
  if (raw !== "mainnet" && raw !== "testnet") throw new Error(`LEXARI_NETWORK must be "mainnet" or "testnet" (got "${raw}").`);
  const pub = (process.env.NEXT_PUBLIC_LEXARI_NETWORK || "").trim().toLowerCase();
  if (pub && pub !== raw) throw new Error(`NEXT_PUBLIC_LEXARI_NETWORK (${pub}) disagrees with LEXARI_NETWORK (${raw}).`);
  const cluster = raw === "mainnet" ? "mainnet-beta" : "devnet";
  const set = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "").trim();
  if (set && set !== cluster) throw new Error(`NEXT_PUBLIC_SOLANA_CLUSTER=${set} does not match LEXARI_NETWORK=${raw} (needs ${cluster}).`);
  return { network: raw, cluster };
}
const mode = networkMode();

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(process.env.NEXT_DIST_DIR ? { typescript: { tsconfigPath: "tsconfig.staging.json" } } : {}),
  // shared/ sits next to this app, so the workspace root has to be visible
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
  poweredByHeader: false,
  // Kuru SDK ships ethers v5 with JSON ABIs: load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["@kuru-labs/kuru-sdk", "ethers"],
  // One id per build: the client compares it with /api/version and hard-reloads after a deploy instead of calling stale chunks.
  // NEXT_PUBLIC_RPC_PROXY: the server has a private Solana RPC (Helius or SOLANA_RPC), so the browser uses /api/rpc (server/rpc.ts).
  env: { NEXT_PUBLIC_LEXARI_NETWORK: mode.network, NEXT_PUBLIC_SOLANA_CLUSTER: mode.cluster, NEXT_PUBLIC_BUILD: process.env.LEXARI_BUILD || Date.now().toString(36), NEXT_PUBLIC_RPC_PROXY: privateRpcConfigured() ? "1" : "" },
  async headers() {
    // /p/ (published agent sites) sets its own sandbox policy in its route
    return [{ source: "/((?!p/).*)", headers: securityHeaders(true).filter((h) => h.value) }];
  },
};

export default nextConfig;
