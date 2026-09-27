import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a second build live next to the running one (e.g. NEXT_DIST_DIR=.next-staging)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // the side build type-checks with its own config so it never reads the live build's types
  ...(process.env.NEXT_DIST_DIR ? { typescript: { tsconfigPath: "tsconfig.staging.json" } } : {}),
};

export default nextConfig;
