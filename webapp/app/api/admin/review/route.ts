import { z } from "zod";
import { withUser } from "@/server/route";
import { noStore, readJson } from "@/server/http";
import { requireAdmin } from "@/server/market/admin";
import { decideVersion, reviewQueue } from "@/server/market/publish";

export const runtime = "nodejs";

export const GET = withUser(async (user) => {
  requireAdmin(user);
  return Response.json(await reviewQueue(), { headers: noStore });
});

const body = z.object({ versionId: z.string().uuid(), approve: z.boolean(), notes: z.string().max(1000).default("") }).strict();
/** Manual approval: nothing third-party reaches the marketplace without a person approving the exact version. */
export const POST = withUser(async (user, req) => {
  requireAdmin(user);
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  return Response.json(await decideVersion(user.userId, b.versionId, b.approve, b.notes), { headers: noStore });
});
