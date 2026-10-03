import { and, eq, isNull } from "drizzle-orm";
import { currentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { agents, memories } from "@/server/db/schema";
import { recordEvent } from "@/server/events";
import { configError, jsonError, readJson, toErrorResponse } from "@/server/http";
import { memoryBody } from "@/server/validate";

export const runtime = "nodejs";

export async function GET() {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const session = await currentSession();
    if (!session) return jsonError(401, "Not signed in.");
    const rows = await db().select().from(memories).where(and(eq(memories.userId, session.userId), isNull(memories.deletedAt)));
    return Response.json({ memories: rows });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  const body = await readJson(req, memoryBody);
  if (body instanceof Response) return body;
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const session = await currentSession();
    if (!session) return jsonError(401, "Not signed in.");
    const agent = await db().select().from(agents).where(and(eq(agents.userId, session.userId), eq(agents.slug, body.agentSlug))).limit(1);
    const inserted = await db().insert(memories).values({
      userId: session.userId,
      agentId: agent[0]?.id,
      tag: body.tag,
      ciphertext: body.ciphertext,
      iv: body.iv,
      contentHash: body.contentHash,
      uri: body.uri,
    }).returning({ id: memories.id });
    await recordEvent(session.userId, "memory");
    return Response.json({ id: inserted[0]?.id });
  } catch (error) {
    return toErrorResponse(error);
  }
}
