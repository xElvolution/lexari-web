import { ingest } from "@/server/email/mail";
import { emailMode, fetchReceived, verifyWebhook } from "@/server/email/provider";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Resend webhook (event email.received) for mail to any address at EMAIL_DOMAIN. Signed with RESEND_WEBHOOK_SECRET
 * (Svix headers); the full email is then fetched from Resend's Received Emails API and filed in the right inboxes.
 */
export async function POST(req: Request) {
  if (emailMode() !== "live") return Response.json({ error: "Email is not live on this server." }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 256_000) return Response.json({ error: "Too large." }, { status: 413 });
  if (!verifyWebhook(raw, req.headers)) return Response.json({ error: "Bad signature." }, { status: 401 });
  let evt: { type?: string; data?: { email_id?: string } };
  try { evt = JSON.parse(raw); } catch { return Response.json({ error: "Expected JSON." }, { status: 400 }); }
  if (evt.type !== "email.received" || !evt.data?.email_id) return Response.json({ ok: true, ignored: true });
  try {
    const mail = await fetchReceived(evt.data.email_id);
    const n = await ingest(mail, "resend");
    return Response.json({ ok: true, delivered: n });
  } catch (e) {
    console.error(`[email] inbound: ${(e as Error).message.slice(0, 200)}`);
    // a non-2xx makes Resend retry later
    return Response.json({ error: "Try again." }, { status: 500 });
  }
}
