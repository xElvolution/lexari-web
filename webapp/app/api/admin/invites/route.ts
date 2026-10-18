import { z } from "zod";
import { withUser } from "@/server/route";
import { readJson } from "@/server/http";
import { createInvite, listInvites } from "@/server/market/developers";
import { requireAdmin } from "@/server/market/admin";

export const runtime = "nodejs";

export const GET = withUser(async (user) => {
  requireAdmin(user);
  return Response.json({ invites: await listInvites() }, { headers: { "cache-control": "no-store" } });
});

const body = z.object({ note: z.string().trim().max(120).default(""), days: z.number().int().min(1).max(60).default(14) }).strict();
/** A one-time developer invite code, shown once. */
export const POST = withUser(async (user, req) => {
  requireAdmin(user);
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  return Response.json(await createInvite(user.userId, b.note, b.days), { headers: { "cache-control": "no-store" } });
});
