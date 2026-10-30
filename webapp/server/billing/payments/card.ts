/**
 * The card rail's adapter slot. Two adapters ship: Stripe Checkout (./stripe.ts) and Paystack (./paystack.ts). The
 * server picks one with CARD_PROVIDER=stripe|paystack plus that provider's keys; with no provider (or keys that do not
 * fit this build's network mode) the app shows "Card payments are coming soon". To add another:
 *   1. write an object that implements PaymentProvider (./types.ts) in a new file next to this one,
 *   2. register it in ADAPTERS below under its id,
 *   3. set CARD_PROVIDER=<id> plus the provider's keys in the server env.
 * Its webhook lands on /api/billing/webhook/<id>; the entitlements service grants the plan or credits exactly once.
 */
import type { PaymentProvider } from "./types";
import { paystackProvider } from "./paystack";
import { stripeProvider } from "./stripe";

const ADAPTERS: Record<string, () => PaymentProvider> = {
  stripe: () => stripeProvider,
  paystack: () => paystackProvider,
};

/** The configured card provider, or null when card payments are not set up on this server. */
export function cardProvider(): PaymentProvider | null {
  const id = (process.env.CARD_PROVIDER || "").trim().toLowerCase();
  const make = id ? ADAPTERS[id] : undefined;
  if (!make) return null;
  const p = make();
  return p.ready() ? p : null;
}

export function cardProviderById(id: string): PaymentProvider | null {
  const p = cardProvider();
  return p && p.id === id ? p : null;
}
