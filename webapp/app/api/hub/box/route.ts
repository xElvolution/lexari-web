import { currentSession } from "@/server/auth/session";
import { openBoxRoll } from "@/server/hub/attest";
import { configError, jsonError, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function POST() {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const session = await currentSession();
    if (!session) return jsonError(401, "Not signed in.");
    return Response.json(await openBoxRoll(session.userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
