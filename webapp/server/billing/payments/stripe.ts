/**
 * Stripe Checkout adapter for the card rail (CARD_PROVIDER=stripe). No SDK: the REST API over fetch.
 *
 * Env (names only, values live in the server env file):
 *   STRIPE_SECRET_KEY      sk_live_... on a mainnet build, sk_test_... on a testnet build (a restricted rk_ key works too:
 *                          it needs Checkout Sessions write)
 *   STRIPE_WEBHOOK_SECRET  whsec_... of the endpoint https://<app>/api/billing/webhook/stripe, subscribed to
 *                          checkout.session.completed, checkout.session.async_payment_succeeded,
 *                          checkout.session.async_payment_failed and checkout.session.expired
 *
 * A mainnet build refuses test keys and a testnet build refuses live keys, so a testnet server can never charge a
 * real card and mainnet never pretends with a test one. A payment is granted only from a signed webhook or a
 * server-side session read, never from the browser redirect.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { IS_MAINNET } from "@/lib/network";
import type { CheckoutInput, PaymentProvider, WebhookResult } from "./types";

const API = "https://api.stripe.com/v1";
const TOLERANCE_S = 300;
const key = () => (process.env.STRIPE_SECRET_KEY || "").trim();
const whsec = () => (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

/** Live keys on mainnet, test keys on testnet. */
export function stripeKeyFitsMode(k: string, mainnet = IS_MAINNET) {
  return mainnet ? /^(sk|rk)_live_/.test(k) : /^(sk|rk)_test_/.test(k);
}

async function call<T>(method: "GET" | "POST", path: string, form?: Record<string, string>, idem?: string): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${key()}`, ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(idem ? { "idempotency-key": idem } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(`Stripe ${path.split("/")[1]} answered ${r.status}${j.error?.message ? `: ${j.error.message.slice(0, 160)}` : ""}`);
  return j;
}

type Session = { id: string; url?: string; status?: string; payment_status?: string; amount_total?: number; currency?: string };

/** Turns a Checkout Session into the rail's status. Only a paid USD session counts as paid. */
export function sessionResult(s: Session): WebhookResult {
  const usd = (s.currency || "").toLowerCase() === "usd";
  const status = s.payment_status === "paid" && usd ? "paid" : s.status === "expired" ? "failed" : "pending";
  return { providerRef: s.id, status, amountMinor: s.amount_total, currency: (s.currency || "").toUpperCase() };
}

/** Verifies a Stripe-Signature header (t=...,v1=...) over the raw body. */
export function verifyStripeSignature(header: string, raw: string, secret: string, now = Math.floor(Date.now() / 1000)) {
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const v1 = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!secret || !Number.isFinite(t) || !v1.length || Math.abs(now - t) > TOLERANCE_S) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex"));
  return v1.some((v) => { const got = Buffer.from(v); return got.length === want.length && timingSafeEqual(got, want); });
}

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
const FAILED_EVENTS = new Set(["checkout.session.async_payment_failed", "checkout.session.expired"]);

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Visa, Mastercard, Amex",
  ready: () => !!whsec() && stripeKeyFitsMode(key()),
  async createCheckout(input: CheckoutInput) {
    const p = input.payment;
    const form: Record<string, string> = {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(p.amountMinor),
      "line_items[0][price_data][product_data][name]": p.title.slice(0, 120),
      success_url: input.returnUrl,
      cancel_url: input.returnUrl,
      client_reference_id: p.id,
      "metadata[payment_id]": p.id,
      "metadata[sku]": p.sku,
      "payment_intent_data[metadata][payment_id]": p.id,
      expires_at: String(Math.floor(Date.now() / 1000) + 2 * 3600 - 60),
    };
    if (input.customer.email) form.customer_email = input.customer.email;
    const s = await call<Session>("POST", "/checkout/sessions", form, `lexari-${p.id}`);
    if (!s.url) throw new Error("Stripe returned no checkout URL");
    return { url: s.url, providerRef: s.id };
  },
  async verifyWebhook(req: Request, raw: string) {
    if (!verifyStripeSignature(req.headers.get("stripe-signature") || "", raw, whsec())) return null;
    const ev = JSON.parse(raw) as { type?: string; data?: { object?: Session & { object?: string } } };
    const obj = ev.data?.object;
    if (!obj?.id || obj.object !== "checkout.session") return { providerRef: obj?.id || "", status: "pending" };
    const r = sessionResult(obj);
    if (FAILED_EVENTS.has(ev.type || "")) return { ...r, status: "failed" };
    return PAID_EVENTS.has(ev.type || "") ? r : { ...r, status: r.status === "paid" ? "paid" : "pending" };
  },
  async fetchStatus(providerRef: string) {
    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(providerRef)) return null;
    return sessionResult(await call<Session>("GET", `/checkout/sessions/${providerRef}`));
  },
};
