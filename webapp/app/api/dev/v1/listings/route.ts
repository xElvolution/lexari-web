import { authKey } from "@/server/market/developers";
import { developerListings } from "@/server/market/listings";
import { noStore, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

/** `lexari status`: your listings, their versions and review state (key scope "read"). */
export async function GET(req: Request) {
  try {
    const { developer } = await authKey(req, "read");
    return Response.json({ developer: { handle: developer.handle, name: developer.name, status: developer.status }, listings: await developerListings(developer.id) }, { headers: noStore });
  } catch (e) { return toErrorResponse(e); }
}
