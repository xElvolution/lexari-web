import { llmConfig } from "@/server/engram/cortex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Are agents able to answer right now? Drives the green/grey dot on agent avatars. */
export async function GET() {
  return Response.json({ online: llmConfig().ready, at: Date.now() }, { headers: { "cache-control": "no-store" } });
}
