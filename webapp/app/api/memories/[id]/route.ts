import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { memories } from "@/server/db/schema";
import { isUuid, jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { z } from "zod";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withUser<Ctx>(async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(400, "That memory id is not valid.");
  const done = await db().update(memories).set({ deletedAt: new Date(), revoked: true }).where(and(eq(memories.id, id), eq(memories.userId, user.userId))).returning({ id: memories.id });
  if (!done.length) return jsonError(404, "There is no such memory.");
  return Response.json({ ok: true });
});

/** Edit a memory: new ciphertext, tag. Its content hash changes with the text. */
const patch = z.object({ tag: z.string().max(40).optional(), ciphertext: z.string().min(8).max(20000), iv: z.string().min(8).max(80), contentHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
export const PATCH = withUser<Ctx>(async (user, req, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(400, "That memory id is not valid.");
  const body = await readJson(req, patch);
  if (body instanceof Response) return body;
  const done = await db().update(memories).set({ ...body, onchainPda: null, chainTx: null }).where(and(eq(memories.id, id), eq(memories.userId, user.userId))).returning({ id: memories.id });
  if (!done.length) return jsonError(404, "There is no such memory.");
  return Response.json({ ok: true });
});
