import { ImageResponse } from "next/og";
import { OgBanner, OG_SIZE, ogFonts } from "@shared/og/banner";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** The share banner for lexari.ai links. */
export async function GET() {
  return new ImageResponse(<OgBanner />, { ...OG_SIZE, fonts: await ogFonts(), headers: { "cache-control": "public, max-age=86400" } });
}
