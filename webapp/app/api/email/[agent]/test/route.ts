import { randomUUID } from "node:crypto";
import { z } from "zod";
import { addressOf, ensureMailbox, ingest } from "@/server/email/mail";
import { emailMode } from "@/server/email/provider";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ agent: string }> };
const body = z.object({ kind: z.enum(["mail", "gmail_verify"]) }).strict();

/** Test mode only: drops a sample email (or a Gmail forwarding confirmation) into the agent's inbox. */
export const POST = withUser<Ctx>(async (user, req, ctx) => {
  if (emailMode() !== "mock") return jsonError(404, "Test emails are only for test mode.");
  const { agent } = await ctx.params;
  if (!/^[\w-]{1,80}$/.test(agent)) return jsonError(400, "Pick an agent.");
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (!(await rateLimit(`mail:test:${user.userId}`, 30, 3_600_000))) return jsonError(429, "That's a lot of test emails. Try again later.");
  const box = await ensureMailbox(user.userId, agent);
  const to = addressOf(box);
  const you = box.replyTo || "you@gmail.com";
  const code = String(100000000 + Math.floor(Math.random() * 899999999));
  const sample = b.kind === "gmail_verify"
    ? { from: "forwarding-noreply@google.com", fromName: "Gmail Team", subject: `(#${code}) Gmail Forwarding Confirmation - Receive Mail from ${you}`, text: `${you} has requested to automatically forward mail to your email address ${to}.\nConfirmation code: ${code}\n\nTo allow ${you} to automatically forward mail to your address, please click the link below to confirm the request:\n\nhttps://mail-settings.google.com/mail/vf-lexari-test-${code}\n\n(This is a Lexari test email. In test mode the link does nothing.)` }
    : { from: "tolu@example.com", fromName: "Tolu Adeyemi", subject: "Invoice #1042 and Thursday's call", text: "Hi,\n\nAttached is invoice #1042 for September ($1,250, due Oct 20). Can you confirm it's approved?\n\nAlso, can we move Thursday's call to 3pm WAT? Let me know if that works.\n\nThanks,\nTolu" };
  const n = await ingest({ id: `mock-${randomUUID()}`, ...sample, to: [to], cc: [], receivedFor: [], html: "", messageId: `<${randomUUID()}@example.com>`, inReplyTo: null, replyTo: null }, "mock");
  return Response.json({ ok: n > 0 });
});
