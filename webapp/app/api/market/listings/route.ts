import { publicListings } from "@/server/market/listings";
import { toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

/** The marketplace: every listed agent, house specialists first in their usual order. Public (no account needed). */
export async function GET() {
  try {
    const listings = await publicListings();
    return Response.json({ listings }, { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
