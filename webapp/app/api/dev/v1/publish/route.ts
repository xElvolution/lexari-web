import { authKey } from "@/server/market/developers";
import { publishVersion } from "@/server/market/publish";
import { jsonError, noStore, rateLimit, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

/** `lexari publish`: submit a manifest version for review (key scope "publish"). A new listing's webhook secret comes back once. */
export async function POST(req: Request) {
  try {
    const { developer } = await authKey(req, "publish");
    if (!(await rateLimit(`dev:publish:${developer.id}`, 20, 3_600_000))) return jsonError(429, "That's a lot of publishes in an hour. Try again later.");
    let raw: unknown;
    try { raw = await req.json(); } catch { return jsonError(400, "Send the manifest as JSON."); }
    const manifest = (raw as { manifest?: unknown })?.manifest ?? raw;
    return Response.json(await publishVersion(developer, manifest), { status: 201, headers: noStore });
  } catch (e) { return toErrorResponse(e); }
}
