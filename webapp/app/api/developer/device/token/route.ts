import { z } from "zod";
import { readJson, toErrorResponse } from "@/server/http";
import { pollDevice } from "@/server/market/developers";

export const runtime = "nodejs";

const body = z.object({ deviceCode: z.string().min(20).max(100) }).strict();

/** lexari login, step 2: the CLI polls until you approve; then it receives its key, once. */
export async function POST(req: Request) {
  try {
    const b = await readJson(req, body);
    if (b instanceof Response) return b;
    const r = await pollDevice(b.deviceCode);
    return Response.json(r, { status: r.status === "approved" ? 200 : r.status === "pending" || r.status === "slow_down" ? 202 : 400, headers: { "cache-control": "no-store" } });
  } catch (e) { return toErrorResponse(e); }
}
