import type { NextConfig } from "next";
import path from "node:path";
import { securityHeaders } from "../shared/securityHeaders";

/** Same rule as server/rpc.ts: a HELIUS_API_KEY, or a SOLANA_RPC that is not a public solana.com endpoint. */
function privateRpcConfigured() {
  const o = (process.env.SOLANA_RPC || "").trim();
  return !!(process.env.HELIUS_API_KEY || "").trim() || (!!o && !/^https?:\/\/api\.(devnet|mainnet-beta|testnet)\.solana\.com\/?$/i.test(o));
}

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(process.env.NEXT_DIST_DIR ? { typescript: { tsconfigPath: "tsconfig.staging.json" } } : {}),
  // shared/ sits next to this app, so the workspace root has to be visible
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
  poweredByHeader: false,
  // One id per build: the client compares it with /api/version and hard-reloads after a deploy instead of calling stale chunks.
  // NEXT_PUBLIC_RPC_PROXY: the server has a private Solana RPC (Helius or SOLANA_RPC), so the browser uses /api/rpc (server/rpc.ts).
  env: { NEXT_PUBLIC_BUILD: process.env.LEXARI_BUILD || Date.now().toString(36), NEXT_PUBLIC_RPC_PROXY: privateRpcConfigured() ? "1" : "" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(true).filter((h) => h.value) }];
  },
};

export default nextConfig;
