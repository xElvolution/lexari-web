import { jsonError, rateLimit } from "@/server/http";
import { agentPoll } from "@/server/miner/hosts";

export const runtime = "nodejs";

/** The host agent on a person's own server: posts results and its report, gets commands. Bearer host token. */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonError(401, "Missing token.");
  if (!(await rateLimit(`miner:agent:${token.slice(0, 12)}`, 60, 60_000))) return jsonError(429, "Slow down.");
  const raw = await req.text();
  if (raw.length > 20_000) return jsonError(413, "Too big.");
  let body: Parameters<typeof agentPoll>[1] = {};
  try { body = JSON.parse(raw || "{}"); } catch { return jsonError(400, "Bad JSON."); }
  return Response.json(await agentPoll(token, body));
}
