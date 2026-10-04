import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { userMedia } from "@/server/db/schema";
import { jsonError } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

const KINDS = new Set(["avatar", "cover"]);
const MAX = 900_000; // bytes, after the browser crops and compresses
type Ctx = { params: Promise<{ kind: string }> };

/** Your profile picture or cover photo. */
export const GET = withUser<Ctx>(async (user, _req, ctx) => {
  const { kind } = await ctx.params;
  if (!KINDS.has(kind)) return jsonError(404, "Not found.");
  const [row] = await db().select().from(userMedia).where(and(eq(userMedia.userId, user.userId), eq(userMedia.kind, kind))).limit(1);
  if (!row) return jsonError(404, "No picture yet.");
  return new Response(new Uint8Array(row.data), { headers: { "content-type": row.mime, "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
});

/** Saves a cropped JPEG/PNG/WebP (sent as a data URL). The bytes are checked to really be that image type. */
export const PUT = withUser<Ctx>(async (user, req, ctx) => {
  const { kind } = await ctx.params;
  if (!KINDS.has(kind)) return jsonError(404, "Not found.");
  let body: { data?: string } = {};
  try { body = await req.json(); } catch { return jsonError(400, "Expected JSON."); }
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.data || "");
  if (!m) return jsonError(400, "Send a JPEG, PNG or WebP image.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX) return jsonError(413, "That picture is too big. Try a smaller one.");
  const magic = buf.subarray(0, 12);
  const ok = m[1] === "image/jpeg" ? magic[0] === 0xff && magic[1] === 0xd8
    : m[1] === "image/png" ? magic.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    : magic.subarray(0, 4).toString() === "RIFF" && magic.subarray(8, 12).toString() === "WEBP";
  if (!ok) return jsonError(400, "That file isn't a picture.");
  const at = new Date();
  await db().insert(userMedia).values({ userId: user.userId, kind, mime: m[1], data: buf, updatedAt: at })
    .onConflictDoUpdate({ target: [userMedia.userId, userMedia.kind], set: { mime: m[1], data: buf, updatedAt: at } });
  return Response.json({ ok: true, at: at.getTime() });
});

export const DELETE = withUser<Ctx>(async (user, _req, ctx) => {
  const { kind } = await ctx.params;
  if (!KINDS.has(kind)) return jsonError(404, "Not found.");
  await db().delete(userMedia).where(and(eq(userMedia.userId, user.userId), eq(userMedia.kind, kind)));
  return Response.json({ ok: true });
});
