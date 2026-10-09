import { z } from "zod";
import { setAccountDefault } from "@/server/models";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
const body = z.object({ model: z.string().min(1).max(160) }).strict();

/** The account default: the model every agent without its own pick answers with. */
export const PUT = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  await setAccountDefault(user.userId, b.model);
  return Response.json({ ok: true });
});
