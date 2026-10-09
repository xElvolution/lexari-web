/**
 * SERVER ONLY. The email service behind agent mail. Resend handles both directions on one subdomain:
 * inbound (MX on EMAIL_DOMAIN -> webhook email.received -> /api/email/inbound) and outbound (POST /emails).
 *
 * Env: AGENT_EMAIL (off | mock | live; default live when the keys below are set, else mock),
 *      EMAIL_DOMAIN (default agents.lexari.ai), RESEND_API_KEY, RESEND_WEBHOOK_SECRET (whsec_...).
 * In mock mode everything works inside Lexari (addresses, inbox, drafts, Send) but nothing leaves or arrives from
 * outside: Send is marked as a test, and a test email can be dropped into an inbox from the app.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { EmailMode } from "@/content/email";

export const emailDomain = () => (process.env.EMAIL_DOMAIN || "agents.lexari.ai").toLowerCase();
const liveKeys = () => !!process.env.RESEND_API_KEY && !!process.env.RESEND_WEBHOOK_SECRET;
export function emailMode(): EmailMode {
  const m = (process.env.AGENT_EMAIL || "").toLowerCase();
  if (m === "off") return "off";
  if (m === "mock") return "mock";
  return liveKeys() ? "live" : "mock";
}

/** Verifies a Resend (Svix) webhook: HMAC-SHA256 over "id.timestamp.body" with the whsec_ secret, 5 minute window. */
export function verifyWebhook(body: string, headers: Headers, secret = process.env.RESEND_WEBHOOK_SECRET || "", now = Date.now()) {
  const id = headers.get("svix-id") || headers.get("webhook-id") || "";
  const ts = headers.get("svix-timestamp") || headers.get("webhook-timestamp") || "";
  const sigs = headers.get("svix-signature") || headers.get("webhook-signature") || "";
  if (!secret || !id || !ts || !sigs) return false;
  if (!/^\d+$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((part) => {
    const [v, sig] = part.split(",");
    if (v !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export type Received = { id: string; from: string; fromName: string; to: string[]; cc: string[]; receivedFor: string[]; subject: string; text: string; html: string; messageId: string | null; inReplyTo: string | null; replyTo: string | null };

const addr = (s: string) => (s.match(/<([^>]+)>/)?.[1] || s).trim().toLowerCase();
const nameOf = (s: string) => (s.includes("<") ? s.slice(0, s.indexOf("<")).replace(/"/g, "").trim() : "");

/** The full received email (the webhook only carries metadata). */
export async function fetchReceived(id: string): Promise<Received> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`resend receiving ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const j = (await res.json()) as { id: string; from: string; to?: string[]; cc?: string[]; received_for?: string[]; subject?: string; text?: string | null; html?: string | null; message_id?: string; reply_to?: string[]; headers?: Record<string, string> };
  const fromHeader = j.headers?.from || j.from;
  return {
    id: j.id, from: addr(j.from), fromName: nameOf(fromHeader), to: (j.to || []).map(addr), cc: (j.cc || []).map(addr), receivedFor: (j.received_for || []).map(addr),
    subject: j.subject || "", text: j.text || "", html: j.html || "", messageId: j.message_id || null,
    inReplyTo: j.headers?.["in-reply-to"] || null, replyTo: j.reply_to?.[0] ? addr(j.reply_to[0]) : null,
  };
}

/** Sends one plain-text email. Returns the provider id. */
export async function sendLive(m: { from: string; to: string[]; subject: string; text: string; replyTo?: string | null; inReplyTo?: string | null; idempotencyKey: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json", "Idempotency-Key": m.idempotencyKey },
    body: JSON.stringify({ from: m.from, to: m.to, subject: m.subject, text: m.text, ...(m.replyTo ? { reply_to: m.replyTo } : {}), ...(m.inReplyTo ? { headers: { "In-Reply-To": m.inReplyTo, References: m.inReplyTo } } : {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !j.id) throw new Error(j.message || `resend send ${res.status}`);
  return j.id;
}

/** Plain text from HTML, for mail that only has an HTML part. */
export function htmlToText(html: string) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * A mailbox asking to confirm forwarding to this address (Gmail sends a code and a link; Outlook needs none).
 * Returns what to show you, or null.
 */
export function forwardingRequest(m: { from: string; subject: string; text: string }) {
  const gmail = /forwarding-noreply@google\.com$/i.test(m.from) || /Gmail Forwarding Confirmation/i.test(m.subject);
  if (gmail) {
    const code = m.text.match(/Confirmation code:\s*(\d{6,12})/i)?.[1] || m.subject.match(/\(#(\d{6,12})\)/)?.[1];
    const link = m.text.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s<>"')]+/i)?.[0];
    const forAddr = m.subject.match(/Receive Mail from (\S+@\S+)/i)?.[1] || m.text.match(/(\S+@\S+) has requested to automatically forward mail/i)?.[1];
    return { service: "Gmail", ...(code ? { code } : {}), ...(link ? { link } : {}), ...(forAddr ? { for: forAddr.replace(/[.,]$/, "") } : {}) };
  }
  if (/(outlook|microsoft|office365)/i.test(m.from) && /(verify|confirm).*(forward)/i.test(`${m.subject} ${m.text.slice(0, 500)}`)) {
    const link = m.text.match(/https:\/\/[^\s<>"')]*(?:microsoft|live|outlook)\.com[^\s<>"')]*/i)?.[0];
    return { service: "Outlook", ...(link ? { link } : {}) };
  }
  return null;
}
