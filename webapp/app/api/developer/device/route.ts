import { z } from "zod";
import { clientIp, readJson, toErrorResponse } from "@/server/http";
import { startDevice } from "@/server/market/developers";

export const runtime = "nodejs";

const body = z.object({ label: z.string().max(60).default("") }).strict();

/** lexari login, step 1: a device code for the CLI and a short code you approve in the app. No account needed here. */
export async function POST(req: Request) {
  try {
    const b = await readJson(req, body);
    if (b instanceof Response) return b;
    const out = await startDevice(b.label, clientIp(req) || "unknown");
    const origin = process.env.LEXARI_APP_ORIGIN || new URL(req.url).origin;
    return Response.json({ ...out, verificationUri: `${origin}/developer/device`, verificationUriComplete: `${origin}/developer/device?code=${out.userCode}` }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return toErrorResponse(e); }
}
