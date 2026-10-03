import { currentSession, type SessionUser } from "./auth/session";
import { configError, jsonError, toErrorResponse } from "./http";

/** Runs a handler for a signed-in person. 503 when the server is not set up, 401 when signed out. */
export function withUser<C = unknown>(fn: (user: SessionUser, req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    const missing = configError();
    if (missing) return jsonError(503, missing);
    try {
      const user = await currentSession();
      if (!user) return jsonError(401, "You're signed out. Sign in again.");
      return await fn(user, req, ctx);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
