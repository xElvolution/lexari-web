/** Starts a payment on either rail. Card: a hosted checkout from the configured provider. Crypto: a USDC request. */
import { eq } from "drizzle-orm";
import { db } from "../db";
import { payments } from "../db/billingSchema";
import { users } from "../db/schema";
import { HttpError } from "../http";
import { itemFor, type Product } from "./catalog";
import { createCryptoPayment } from "./crypto";
import { assertBookable } from "./planPurchase";
import { cardProvider } from "./payments/card";

export async function startCheckout(user: { userId: string; wallet: string }, input: { rail: "card" | "crypto"; product: Product; id: string; period?: "monthly" | "yearly"; token?: string }, origin: string) {
  const item = itemFor(input.product, input.id, input.period ?? "monthly");
  if (item.product === "plan") await assertBookable(db(), user.userId, item);
  if (input.rail === "crypto") return { rail: "crypto" as const, crypto: await createCryptoPayment(user.userId, item, input.token) };
  const provider = cardProvider();
  if (!provider) throw new HttpError(503, "Card payments are coming soon. Pay with USDC for now.");
  const database = db();
  const [row] = await database.insert(payments).values({ userId: user.userId, rail: "card", provider: provider.id, product: item.product, sku: item.sku, amountMinor: Math.round(item.usd * 100), currency: "USD", expiresAt: new Date(Date.now() + 2 * 3_600_000), meta: { title: item.title } }).returning();
  const [u] = await database.select({ email: users.email }).from(users).where(eq(users.id, user.userId)).limit(1);
  const r = await provider.createCheckout({
    payment: { id: row.id, amountMinor: row.amountMinor, currency: "USD", sku: item.sku, title: item.title },
    customer: { userId: user.userId, email: u?.email, wallet: user.wallet },
    returnUrl: `${origin}/settings?payment=${row.id}#billing`, webhookUrl: `${origin}/api/billing/webhook/${provider.id}`,
  });
  await database.update(payments).set({ providerRef: r.providerRef }).where(eq(payments.id, row.id));
  return { rail: "card" as const, card: { id: row.id, url: r.url } };
}
