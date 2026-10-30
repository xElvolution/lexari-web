import { z } from "zod";
import { parseManifest } from "@lexari/manifest";
import { authKey } from "@/server/market/developers";
import { playgroundReply } from "@/server/market/playground";
import { jsonError, noStore, rateLimit, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({
  manifest: z.unknown(),
  text: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ from: z.enum(["you", "agent"]), text: z.string().max(4000) })).max(20).default([]),
}).strict();

/**
 * `lexari dev`: talk to your agent as Lexari would run it (Lamina, Lexari's rules, your persona). Tool tags are
 * reported back, not run: `lexari dev` calls your local endpoint itself. Lexari models only, rate limited.
 */
export async function POST(req: Request) {
  try {
    const { developer } = await authKey(req, "read");
    if (!(await rateLimit(`dev:play:m:${developer.id}`, 20, 60_000)) || !(await rateLimit(`dev:play:d:${developer.id}`, 300, 86_400_000))) return jsonError(429, "Playground limit reached. Try again later.");
    let raw: unknown;
    try { raw = await req.json(); } catch { return jsonError(400, "Send JSON."); }
    const b = body.safeParse(raw);
    if (!b.success) return jsonError(400, b.error.issues[0]?.message || "Bad request.");
    const m = parseManifest(b.data.manifest);
    if (!m.ok) return jsonError(422, "The manifest has problems.", { issues: m.issues });
    return Response.json(await playgroundReply(m.manifest, developer.name, b.data.history, b.data.text), { headers: noStore });
  } catch (e) { return toErrorResponse(e); }
}
