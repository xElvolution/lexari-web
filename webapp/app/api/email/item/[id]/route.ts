import { z } from "zod";
import { actOnDraft, readMail } from "@/server/email/mail";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
export const maxDuration = 40;
type Ctx = { params: Promise<{ id: string }> };

/** One email in full (opening an incoming one marks it read). */
export const GET = withUser<Ctx>(async (user, _req, ctx) => Response.json({ mail: await readMail(user.userId, (await ctx.params).id) }, { headers: { "cache-control": "no-store" } }));

const body = z.object({ op: z.enum(["send", "cancel"]), subject: z.string().max(200).optional(), text: z.string().min(1).max(10_000).optional() }).strict();

/** Send or cancel a draft an agent wrote. Only you can do this; nothing goes out without it. */
export const POST = withUser<Ctx>(async (user, req, ctx) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const card = await actOnDraft(user.userId, (await ctx.params).id, b.op, { subject: b.subject, text: b.text });
  return Response.json({ email: card });
});
