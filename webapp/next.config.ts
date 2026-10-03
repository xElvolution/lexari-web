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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(true).filter((h) => h.value) }];
  },
  // Bond was renamed to Hub
  async redirects() {
    return [{ source: "/app/bond", destination: "/app/hub", permanent: true }];
  },
};

export default nextConfig;
