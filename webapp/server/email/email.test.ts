// Run: npx tsx --test server/email/email.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { forwardingRequest, htmlToText, verifyWebhook } from "./provider";
import { emailRequest, stripEmailTags, validEmail } from "./mail";

test("Resend (Svix) webhook signatures", () => {
  const secret = `whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;
  const body = '{"type":"email.received","data":{"email_id":"abc"}}';
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`msg_1.${ts}.${body}`).digest("base64");
  const h = (s: string, t = ts) => new Headers({ "svix-id": "msg_1", "svix-timestamp": t, "svix-signature": s });
  assert.equal(verifyWebhook(body, h(`v1,${sig}`), secret), true);
  assert.equal(verifyWebhook(body, h(`v1,bad v1,${sig}`), secret), true);
  assert.equal(verifyWebhook(body + " ", h(`v1,${sig}`), secret), false);
  assert.equal(verifyWebhook(body, h(`v1,${sig}`, String(Number(ts) - 900)), secret), false);
  assert.equal(verifyWebhook(body, h(`v1,${sig}`), ""), false);
});

test("Gmail forwarding confirmation is recognised with its code and link", () => {
  const v = forwardingRequest({ from: "forwarding-noreply@google.com", subject: "(#482913775) Gmail Forwarding Confirmation - Receive Mail from ada@gmail.com", text: "ada@gmail.com has requested to automatically forward mail to your email address nova.k3fd@agents.lexari.ai.\nConfirmation code: 482913775\n\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ8%5D-abc\n" });
  assert.equal(v?.service, "Gmail"); assert.equal(v?.code, "482913775"); assert.equal(v?.for, "ada@gmail.com");
  assert.match(v?.link || "", /^https:\/\/mail-settings\.google\.com\/mail\/vf-/);
  assert.equal(forwardingRequest({ from: "tolu@example.com", subject: "Invoice", text: "hi" }), null);
});

test("the <email> tag", () => {
  const r = emailRequest('Sure.\n<email to="a@b.com, c@d.io" subject="Hello there">Hi both,\nSee you.\n- Nova</email>');
  assert.deepEqual(r?.to, ["a@b.com", "c@d.io"]); assert.equal(r?.subject, "Hello there"); assert.match(r?.body || "", /See you/);
  assert.equal(emailRequest('<email reply="ab12cd34">Thanks!</email>')?.reply, "ab12cd34");
  assert.equal(stripEmailTags('Ready.\n<email to="a@b.com" subject="x">body</email>'), "Ready.");
  assert.equal(emailRequest("no tag"), null);
  assert.equal(validEmail("ada@gmail.com"), true); assert.equal(validEmail("not an email"), false); assert.equal(validEmail("a@b"), false);
});

test("HTML-only mail becomes readable text", () => {
  assert.equal(htmlToText('<p>Hi <b>Ada</b></p><p><a href="https://x.com">link</a></p><style>p{}</style>'), "Hi Ada\nlink (https://x.com)");
});
