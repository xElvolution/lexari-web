import { z } from "zod";
import { withUser } from "@/server/route";
import { noStore, readJson } from "@/server/http";
import { requireAdmin } from "@/server/market/admin";
import { delist } from "@/server/market/publish";

export const runtime = "nodejs";

const body = z.object({ slug: z.string().min(2).max(40), reason: z.string().trim().min(3).max(300) }).strict();
/** Kill switch: take a third-party listing down; hired copies stop calling its tools at once. */
export const POST = withUser(async (user, req) => {
  requireAdmin(user);
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  return Response.json(await delist(b.slug, b.reason), { headers: noStore });
});
