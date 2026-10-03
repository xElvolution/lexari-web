import { z } from "zod";
import { currentSession } from "@/server/auth/session";
import { coSign } from "@/server/hub/attest";
import { configError, jsonError, readJson, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

const body = z.object({ tx: z.string().min(20).max(20000) }).strict();

export async function POST(req: Request) {
  const parsed = await readJson(req, body);
  if (parsed instanceof Response) return parsed;
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const session = await currentSession();
    if (!session) return jsonError(401, "Not signed in.");
    const tx = await coSign(session.userId, parsed.tx);
    return Response.json({ tx });
  } catch (error) {
    return toErrorResponse(error);
  }
}
