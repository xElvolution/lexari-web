import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(process.env.NEXT_DIST_DIR ? { typescript: { tsconfigPath: "tsconfig.staging.json" } } : {}),
  // shared/ sits next to this app, so the workspace root has to be visible
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
