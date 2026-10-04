import { currentSession, type SessionUser } from "./auth/session";
import { configError, jsonError, toErrorResponse } from "./http";
import { isConnClosed } from "./db";

/** Runs a handler for a signed-in person. 503 when the server is not set up, 401 when signed out. */
export function withUser<C = unknown>(fn: (user: SessionUser, req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    const missing = configError();
    if (missing) return jsonError(503, missing);
    const once = async () => {
      const user = await currentSession();
      if (!user) return jsonError(401, "You're signed out. Sign in again.");
      return await fn(user, req, ctx);
    };
    try {
      return await once();
    } catch (error) {
      // A pooled connection the database already closed: retry reads once on a fresh one.
      if (isConnClosed(error) && req.method === "GET") { try { return await once(); } catch (e) { return toErrorResponse(e); } }
      if (isConnClosed(error)) console.error("[db] connection closed during", req.method, new URL(req.url).pathname);
      return toErrorResponse(error);
    }
  };
}
