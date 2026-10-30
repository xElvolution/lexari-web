/**
 * Paystack adapter for the card rail (CARD_PROVIDER=paystack). No SDK: the REST API over fetch.
 *
 * Env (names only):
 *   PAYSTACK_SECRET_KEY  sk_live_... on a mainnet build, sk_test_... on a testnet build. Paystack signs webhooks with
 *                        this same key (x-paystack-signature, HMAC-SHA512 of the raw body).
 *   PAYSTACK_CURRENCY    optional, default USD. Lexari prices are in US dollars, so USD needs a Paystack business
 *                        approved for USD settlement; another currency would need a conversion that is not built.
 * Webhook URL to set in the Paystack dashboard: https://<app>/api/billing/webhook/paystack
 * Paystack needs an email for every charge, so a person without one is asked to add it first.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { IS_MAINNET } from "@/lib/network";
import { HttpError } from "../../http";
import type { CheckoutInput, PaymentProvider, WebhookResult } from "./types";

const API = "https://api.paystack.co";
const key = () => (process.env.PAYSTACK_SECRET_KEY || "").trim();
const currency = () => (process.env.PAYSTACK_CURRENCY || "USD").trim().toUpperCase();

export function paystackKeyFitsMode(k: string, mainnet = IS_MAINNET) {
  return mainnet ? /^sk_live_/.test(k) : /^sk_test_/.test(k);
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${key()}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
  if (!r.ok || !j.status || !j.data) throw new Error(`Paystack ${path.split("/")[1]} answered ${r.status}${j.message ? `: ${j.message.slice(0, 160)}` : ""}`);
  return j.data;
}

type Tx = { reference: string; status?: string; amount?: number; currency?: string };

export function txResult(t: Tx, want = currency()): WebhookResult {
  const same = (t.currency || "").toUpperCase() === want;
  const status = t.status === "success" && same ? "paid" : t.status === "failed" || t.status === "reversed" ? "failed" : "pending";
  return { providerRef: t.reference, status, amountMinor: t.amount, currency: (t.currency || "").toUpperCase() };
}

export function verifyPaystackSignature(header: string, raw: string, secret: string) {
  if (!secret || !/^[0-9a-f]{128}$/i.test(header)) return false;
  const want = Buffer.from(createHmac("sha512", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.toLowerCase());
  return got.length === want.length && timingSafeEqual(got, want);
}

export const paystackProvider: PaymentProvider = {
  id: "paystack",
  label: "Visa, Mastercard, Verve",
  ready: () => paystackKeyFitsMode(key()),
  async createCheckout(input: CheckoutInput) {
    const email = (input.customer.email || "").trim();
    if (!email) throw new HttpError(400, "Add your email in Settings first. The card processor sends your receipt there.");
    const p = input.payment;
    const d = await call<{ authorization_url: string; reference: string }>("POST", "/transaction/initialize", {
      email, amount: p.amountMinor, currency: currency(), reference: p.id, callback_url: input.returnUrl,
      metadata: { payment_id: p.id, sku: p.sku, user_id: input.customer.userId },
    });
    return { url: d.authorization_url, providerRef: d.reference };
  },
  async verifyWebhook(req: Request, raw: string) {
    if (!verifyPaystackSignature(req.headers.get("x-paystack-signature") || "", raw, key())) return null;
    const ev = JSON.parse(raw) as { event?: string; data?: Tx };
    if (!ev.data?.reference) return { providerRef: "", status: "pending" };
    if (ev.event === "charge.success") return txResult({ ...ev.data, status: "success" });
    return { ...txResult(ev.data), status: "pending" };
  },
  async fetchStatus(providerRef: string) {
    if (!/^[A-Za-z0-9.=-]{6,100}$/.test(providerRef)) return null;
    return txResult(await call<Tx>("GET", `/transaction/verify/${encodeURIComponent(providerRef)}`));
  },
};
