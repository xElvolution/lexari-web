/**
 * The card rail's single adapter slot. The provider is the owner's choice (still open), so no adapter ships yet and
 * the app shows "Card payments are coming soon". To add one:
 *   1. write an object that implements PaymentProvider (./types.ts) in a new file next to this one,
 *   2. register it in ADAPTERS below under its id,
 *   3. set CARD_PROVIDER=<id> plus the provider's keys in the server env.
 * Its webhook lands on /api/billing/webhook/<id>; the entitlements service grants the plan or credits exactly once.
 */
import type { PaymentProvider } from "./types";

const ADAPTERS: Record<string, () => PaymentProvider> = {
  // e.g. "stripe": () => stripeProvider,
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
