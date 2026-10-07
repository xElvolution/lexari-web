/**
 * The card rail is provider-pluggable. A provider adapter turns a pending Lexari payment into a hosted checkout and
 * confirms it through a signed webhook (and, when the provider offers it, a server-side status check). Lexari never
 * marks a card payment paid from a browser redirect alone.
 */
export type CheckoutInput = {
  payment: { id: string; amountMinor: number; currency: "USD"; sku: string; title: string };
  customer: { userId: string; email?: string | null; wallet: string };
  /** where the provider sends the person back (the app polls the payment's status there) */
  returnUrl: string;
  /** where the provider posts its webhook */
  webhookUrl: string;
};

export type WebhookResult = {
  /** the provider's reference for the charge; must equal what createCheckout returned */
  providerRef: string;
  status: "paid" | "failed" | "pending";
  amountMinor?: number;
  currency?: string;
};

export interface PaymentProvider {
  /** short id used in env (CARD_PROVIDER) and the webhook path (/api/billing/webhook/<id>) */
  id: string;
  /** shown on the button, e.g. "Card" */
  label: string;
  /** true when every key the adapter needs is set */
  ready(): boolean;
  createCheckout(input: CheckoutInput): Promise<{ url: string; providerRef: string }>;
  /** Verify the signature on the raw body. Return null for a request that is not a valid, signed event. */
  verifyWebhook(req: Request, rawBody: string): Promise<WebhookResult | null>;
  /** Optional server-side status check, used when the person returns before the webhook arrives. */
  fetchStatus?(providerRef: string): Promise<WebhookResult | null>;
}
