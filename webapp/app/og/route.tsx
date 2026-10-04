import { ImageResponse } from "next/og";
import { OgBanner, OG_SIZE, ogFonts } from "@shared/og/banner";
import { inviter } from "@/server/og";

export const runtime = "nodejs";

/** The share banner: /og, or /og?ref=CODE for "You're invited by …". */
export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref") || "";
  const who = ref ? await inviter(ref, true) : {};
  return new ImageResponse(<OgBanner {...who} />, {
    ...OG_SIZE,
    fonts: await ogFonts(),
    headers: { "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
