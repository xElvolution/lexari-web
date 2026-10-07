/**
 * The crypto rail: USDC on Solana (devnet for the hackathon) paid to the Lexari treasury, Solana Pay style.
 * Each payment gets a fresh reference key that the transfer carries as a read-only account, so the server can find
 * and verify it on chain (amount, mint, treasury, reference, fresh, unused) without trusting the browser.
 */
import { Keypair, PublicKey, type VersionedTransactionResponse } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { cluster, treasury, usdcMint } from "../config";
import { db } from "../db";
import { payments } from "../db/billingSchema";
import { planPurchases } from "../db/schema";
import { connection } from "../hub/chain";
import { fetchConfirmed } from "../hub/confirm";
import { HttpError } from "../http";
import { markPaid } from "./entitlements";

export const USDC_DECIMALS = 6;
export const cryptoReady = () => !!treasury() && !!usdcMint();
const PAY_WINDOW_MS = 30 * 60_000;

export function solanaPayUrl(p: { recipient: string; amountMinor: number; mint: string; reference: string; label: string; message: string }) {
  const amount = (p.amountMinor / 10 ** USDC_DECIMALS).toFixed(USDC_DECIMALS).replace(/\.?0+$/, "");
  const q = new URLSearchParams({ amount, "spl-token": p.mint, reference: p.reference, label: p.label, message: p.message });
  return `solana:${p.recipient}?${q.toString()}`;
}

export async function createCryptoPayment(userId: string, item: { product: string; sku: string; usd: number; title: string }) {
  if (!cryptoReady()) throw new HttpError(503, "USDC payments are not set up on this server yet.");
  const reference = Keypair.generate().publicKey.toBase58();
  const amountMinor = Math.round(item.usd * 10 ** USDC_DECIMALS);
  const [row] = await db().insert(payments).values({
    userId, rail: "crypto", provider: "solana-usdc", product: item.product, sku: item.sku, amountMinor, currency: "USDC", reference,
    expiresAt: new Date(Date.now() + PAY_WINDOW_MS), meta: { cluster: cluster(), title: item.title },
  }).returning();
  const recipient = treasury(), mint = usdcMint();
  return {
    id: row.id, recipient, mint, reference, amountMinor, decimals: USDC_DECIMALS, cluster: cluster(), title: item.title, expiresAt: row.expiresAt!.getTime(),
    url: solanaPayUrl({ recipient, amountMinor, mint, reference, label: "Lexari", message: item.title }),
  };
}

/**
 * Checks a confirmed transaction pays this payment: it succeeded, carries the reference key, and moved at least the
 * amount of the USDC mint into the treasury's token account. Returns who paid.
 */
export function checkUsdcTransfer(tx: VersionedTransactionResponse, want: { treasury: string; mint: string; amountMinor: number; reference: string }) {
  if (!tx.meta || tx.meta.err) throw new HttpError(400, "That payment failed on Solana.");
  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses }).keySegments().flat().map((k) => k.toBase58());
  if (!keys.includes(want.reference)) throw new HttpError(400, "That transaction is not this payment.");
  const amt = (list: typeof tx.meta.preTokenBalances, owner: string) => {
    const b = list?.find((x) => x.mint === want.mint && x.owner === owner);
    if (b && b.uiTokenAmount.decimals !== USDC_DECIMALS) throw new HttpError(400, "That is not USDC.");
    return BigInt(b?.uiTokenAmount.amount ?? "0");
  };
  const received = amt(tx.meta.postTokenBalances, want.treasury) - amt(tx.meta.preTokenBalances, want.treasury);
  if (received < BigInt(want.amountMinor)) throw new HttpError(400, "That payment is less than the price or did not go to Lexari.");
  const payer = (tx.meta.preTokenBalances || []).filter((b) => b.mint === want.mint && b.owner && b.owner !== want.treasury)
    .find((b) => amt(tx.meta!.preTokenBalances, b.owner!) - amt(tx.meta!.postTokenBalances, b.owner!) >= BigInt(want.amountMinor))?.owner || "";
  return { payer, received: Number(received) };
}

async function findByReference(reference: string) {
  const sigs = await connection().getSignaturesForAddress(new PublicKey(reference), { limit: 10 }, "confirmed");
  return sigs.find((s) => !s.err)?.signature || null;
}

/** Verifies a USDC payment (by its signature, or by finding its reference on chain) and grants it. */
export async function verifyCryptoPayment(userId: string, paymentId: string, sig?: string) {
  const database = db();
  const [p] = await database.select().from(payments).where(and(eq(payments.id, paymentId), eq(payments.userId, userId), eq(payments.rail, "crypto"))).limit(1);
  if (!p) throw new HttpError(404, "There is no such payment.");
  if (p.status === "paid") return markPaid(p.id, {});
  const signature = sig || (await findByReference(p.reference!));
  if (!signature) throw new HttpError(404, "We haven't seen this payment on Solana yet. If you just paid, wait a few seconds and check again.");
  const [usedPay] = await database.select({ id: payments.id }).from(payments).where(eq(payments.txSig, signature)).limit(1);
  const [usedPlan] = await database.select({ id: planPurchases.id }).from(planPurchases).where(eq(planPurchases.tx, signature)).limit(1);
  if ((usedPay && usedPay.id !== p.id) || usedPlan) throw new HttpError(409, "That payment was already used.");
  const tx = await fetchConfirmed(signature);
  const t = (tx.blockTime ?? 0) * 1000;
  // Paid inside its window (a little grace for slow confirmations), never before the payment existed.
  if (!t || t < p.createdAt.getTime() - 60_000 || (p.expiresAt && t > p.expiresAt.getTime() + 10 * 60_000)) throw new HttpError(400, "That payment is outside its time window. Start a new one.");
  const { payer } = checkUsdcTransfer(tx, { treasury: treasury(), mint: usdcMint(), amountMinor: p.amountMinor, reference: p.reference! });
  return markPaid(p.id, { txSig: signature, payer });
}
