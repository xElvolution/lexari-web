/**
 * Hire payments: the person pays a house specialist's price to the Lexari treasury.
 * We read the confirmed transaction and check payer, recipient, mint and amount from balance changes,
 * so a payment for something else, to someone else, or reused cannot buy a hire.
 */
import type { VersionedTransactionResponse } from "@solana/web3.js";
import { HIRE_LAMPORTS, HIRE_USDC, treasury, usdcMint } from "./config";
import { HttpError } from "./http";

export type PaymentCheck = { mint: "SOL" | "USDC"; amount: number; payer: string };

export function verifyPayment(tx: VersionedTransactionResponse, payer: string, mint: "SOL" | "USDC"): PaymentCheck {
  const to = treasury();
  if (!to) throw new HttpError(503, "Hiring is not open yet.");
  if (tx.meta?.err) throw new HttpError(400, "That payment failed on Solana.");
  // A hire must be paid for now: an old transfer to the treasury can't be turned into a hire later.
  if (!tx.blockTime || Date.now() / 1000 - tx.blockTime > 3600) throw new HttpError(400, "That payment is too old. Hire again to make a new one.");
  const msg = tx.transaction.message;
  const keys = msg.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses }).keySegments().flat().map((k) => k.toBase58());
  if (!keys.slice(0, msg.header.numRequiredSignatures).includes(payer)) throw new HttpError(403, "That payment was not signed by your wallet.");
  if (mint === "SOL") {
    const i = keys.indexOf(to);
    const p = keys.indexOf(payer);
    if (i < 0 || p < 0 || !tx.meta) throw new HttpError(400, "That payment did not go to Lexari.");
    const received = tx.meta.postBalances[i] - tx.meta.preBalances[i];
    if (received < HIRE_LAMPORTS) throw new HttpError(400, "That payment is less than the price.");
    return { mint, amount: received, payer };
  }
  const usdc = usdcMint();
  if (!usdc || !tx.meta) throw new HttpError(400, "USDC hiring is not open.");
  const bal = (list: typeof tx.meta.preTokenBalances, owner: string) => Number(list?.find((b) => b.mint === usdc && b.owner === owner)?.uiTokenAmount.amount ?? 0);
  const received = bal(tx.meta.postTokenBalances, to) - bal(tx.meta.preTokenBalances, to);
  const sent = bal(tx.meta.preTokenBalances, payer) - bal(tx.meta.postTokenBalances, payer);
  if (received < HIRE_USDC || sent < HIRE_USDC) throw new HttpError(400, "That payment is less than the price or did not go to Lexari.");
  return { mint, amount: received, payer };
}
