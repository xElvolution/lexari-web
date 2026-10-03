import { and, eq } from "drizzle-orm";
import { currentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { agents } from "@/server/db/schema";
import { recordEvent } from "@/server/events";
import { configError, jsonError, readJson, toErrorResponse } from "@/server/http";
import { agentBody } from "@/server/validate";

export const runtime = "nodejs";

export async function GET() {
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const session = await currentSession();
    if (!session) return jsonError(401, "Not signed in.");
    const rows = await db().select().from(agents).where(eq(agents.userId, session.userId));
    return Response.json({ agents: rows });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  const body = await readJson(req, agentBody);
  if (body instanceof Response) return body;
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const session = await currentSession();
    if (!session) return jsonError(401, "Not signed in.");
    const database = db();
    const existing = await database.select().from(agents).where(and(eq(agents.userId, session.userId), eq(agents.slug, body.slug))).limit(1);
    if (existing[0]) {
      await database.update(agents).set({
        name: body.name,
        role: body.role,
        tone: body.tone,
        lookJson: body.look ?? existing[0].lookJson,
        asset: body.asset ?? existing[0].asset,
        agentPda: body.agentPda ?? existing[0].agentPda,
        mintedAt: body.asset ? new Date() : existing[0].mintedAt,
      }).where(eq(agents.id, existing[0].id));
      return Response.json({ id: existing[0].id });
    }
    const inserted = await database.insert(agents).values({
      userId: session.userId,
      slug: body.slug,
      name: body.name,
      role: body.role,
      tone: body.tone,
      lookJson: body.look ?? {},
      asset: body.asset,
      agentPda: body.agentPda,
      mintedAt: body.asset ? new Date() : null,
    }).returning({ id: agents.id });
    await recordEvent(session.userId, "agent");
    return Response.json({ id: inserted[0]?.id });
  } catch (error) {
    return toErrorResponse(error);
  }
}
