import { z } from "zod";
import { listMail, mailboxInfo, updateMailbox } from "@/server/email/mail";
import { emailMode } from "@/server/email/provider";
import { jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ agent: string }> };
const slugOk = (s: string) => /^[\w-]{1,80}$/.test(s);

/** The agent's address (made on first open), inbox and sent mail. */
export const GET = withUser<Ctx>(async (user, _req, ctx) => {
  if (emailMode() === "off") return jsonError(404, "Email isn't switched on.");
  const { agent } = await ctx.params;
  if (!slugOk(agent)) return jsonError(400, "Pick an agent.");
  const [box, inbox, sent] = await Promise.all([mailboxInfo(user.userId, agent), listMail(user.userId, agent, "in"), listMail(user.userId, agent, "out")]);
  return Response.json({ box, inbox, sent }, { headers: { "cache-control": "no-store" } });
});

const body = z.object({ senderMode: z.enum(["agent", "user"]).optional(), replyTo: z.string().trim().max(254).nullable().optional() }).strict();

/** Forwarding and sending settings: your own address (Reply-To) and whether mail goes out as the agent or as you. */
export const PUT = withUser<Ctx>(async (user, req, ctx) => {
  const { agent } = await ctx.params;
  if (!slugOk(agent)) return jsonError(400, "Pick an agent.");
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  return Response.json({ box: await updateMailbox(user.userId, agent, { senderMode: b.senderMode, replyTo: b.replyTo === "" ? null : b.replyTo }) });
});
