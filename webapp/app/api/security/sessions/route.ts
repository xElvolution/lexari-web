import { z } from "zod";
import { readJson, noStore } from "@/server/http";
import { withUser } from "@/server/route";
import { listSessions, revokeOthers, revokeSession } from "@/server/security";

export const runtime = "nodejs";

/** Sign out one other device ({ id }) or every other device ({ others: true }). This device stays signed in. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, z.union([z.object({ id: z.string().uuid() }).strict(), z.object({ others: z.literal(true) }).strict()]));
  if (b instanceof Response) return b;
  const ended = "id" in b ? await revokeSession(user, b.id) : await revokeOthers(user);
  return Response.json({ ended, sessions: await listSessions(user.userId, user.sessionId) }, { headers: noStore });
});
