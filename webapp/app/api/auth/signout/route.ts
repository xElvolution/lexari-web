import { destroySession } from "@/server/auth/session";
import { configError, jsonError, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function POST() {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    await destroySession();
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
