import type { NextConfig } from "next";
import path from "node:path";
import { securityHeaders } from "../shared/securityHeaders";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(process.env.NEXT_DIST_DIR ? { typescript: { tsconfigPath: "tsconfig.staging.json" } } : {}),
  // shared/ sits next to this app, so the workspace root has to be visible
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
  poweredByHeader: false,
  // One id per build: the client compares it with /api/version and hard-reloads after a deploy instead of calling stale chunks.
  env: { NEXT_PUBLIC_BUILD: process.env.LEXARI_BUILD || Date.now().toString(36) },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(true).filter((h) => h.value) }];
  },
};

export default nextConfig;
