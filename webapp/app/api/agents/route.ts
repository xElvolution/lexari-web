import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { agents } from "@/server/db/schema";
import { recordEvent } from "@/server/events";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { agentBody } from "@/server/validate";

export const runtime = "nodejs";

export const GET = withUser(async (user) => Response.json({ agents: await db().select().from(agents).where(eq(agents.userId, user.userId)) }));

/**
 * Creates or updates your home agent or one you made. Minted card fields (asset, PDA) are never taken
 * from here: they are set from the chain after a confirmed mint (see /api/hub/confirm).
 */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, agentBody);
  if (body instanceof Response) return body;
  if (body.kind === "home" && body.slug !== "home") return jsonError(400, "Your home agent's id is home.");
  if (body.kind === "custom" && !body.slug.startsWith("c-")) return jsonError(400, "Agents you make have ids that start with c-.");
  const database = db();
  const [existing] = await database.select().from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, body.slug))).limit(1);
  if (existing && existing.kind === "hired") return jsonError(400, "A hired specialist keeps its maker's settings.");
  const values = {
    name: body.name, role: body.role, tone: body.tone, about: body.about, skills: body.skills, memoryOn: body.memoryOn,
    lookJson: body.look === undefined ? existing?.lookJson ?? {} : { v: body.look }, meta: { ...(existing?.meta || {}), ...body.meta }, updatedAt: new Date(),
  };
  if (existing) {
    await database.update(agents).set(values).where(eq(agents.id, existing.id));
    return Response.json({ ok: true });
  }
  const count = await database.select({ id: agents.id }).from(agents).where(eq(agents.userId, user.userId));
  if (count.length >= 50) return jsonError(400, "You have the most agents an account can have.");
  await database.insert(agents).values({ userId: user.userId, slug: body.slug, kind: body.kind, ...values }).onConflictDoNothing();
  await recordEvent(user.userId, "agent", { ref: body.slug });
  return Response.json({ ok: true });
});
