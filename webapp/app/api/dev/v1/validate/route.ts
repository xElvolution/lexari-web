import { parseManifest } from "@lexari/manifest";
import { authKey } from "@/server/market/developers";
import { automatedChecks } from "@/server/market/publish";
import { jsonError, noStore, rateLimit, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

/** `lexari validate --remote`: the same automated checks review runs, without submitting anything. */
export async function POST(req: Request) {
  try {
    const { developer } = await authKey(req, "read");
    if (!(await rateLimit(`dev:validate:${developer.id}`, 60, 3_600_000))) return jsonError(429, "Too many checks this hour.");
    let raw: unknown;
    try { raw = await req.json(); } catch { return jsonError(400, "Send the manifest as JSON."); }
    const p = parseManifest((raw as { manifest?: unknown })?.manifest ?? raw);
    if (!p.ok) return Response.json({ ok: false, issues: p.issues, checks: [] }, { headers: noStore });
    const checks = await automatedChecks(p.manifest);
    return Response.json({ ok: checks.every((c) => c.ok), issues: [], checks }, { headers: noStore });
  } catch (e) { return toErrorResponse(e); }
}
