import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a second build live next to the running one (e.g. NEXT_DIST_DIR=.next-staging)
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
