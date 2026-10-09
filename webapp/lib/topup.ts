"use client";

/**
 * Top up with any coin (content/topup.ts): Solana coins are paid from your Lexari wallet with a reference key and
 * verified on the server; every other chain gets a deposit address that the server watches and credits.
 */
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { DepositView } from "@/server/topup/deposits";
import { api } from "./api";
import { connection, payer } from "./pay";
import { confirmSig } from "./rpc";
import { verifyPayment, type PayStep } from "./billing";
import { moneyChanged } from "./money";
import { ackTx, get, refreshReceipts } from "./store";

export type { DepositView };
export type TokenRequest = { id: string; recipient: string; mint: string; reference: string; amountMinor: number; decimals: number; cluster: string; title: string; url: string; expiresAt: number; rail: string; coin: string; price: number; network: string };

export async function startToken(usd: number, rail: string) {
  const r = await api<{ rail: "crypto"; crypto: TokenRequest }>("/api/billing/checkout", { body: { rail: "crypto", product: "credits", id: String(usd), token: rail } });
  return r.crypto;
}

/** What you hold of a Solana coin, in base units (null when it can't be read). */
export async function solanaHolding(owner: string, mint: string | null) {
  try {
    const c = connection();
    if (!mint) return await c.getBalance(new PublicKey(owner), "confirmed");
    const b = await c.getTokenAccountBalance(getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner)), "confirmed");
    return Number(b.value.amount);
  } catch (e) {
    return /could not find account|Invalid param/i.test((e as Error)?.message || "") ? 0 : null;
  }
}

/** Pays a token request from the Lexari wallet: SOL or an SPL transfer to the treasury carrying the reference key. */
export async function payToken(req: TokenRequest, onStep: (s: PayStep, sig?: string) => void) {
  const w = await payer();
  if (!w) throw new Error("Your wallet is still loading. Wait a moment and try again.");
  const c = connection();
  const me = w.publicKey, to = new PublicKey(req.recipient), ref = { pubkey: new PublicKey(req.reference), isSigner: false, isWritable: false };
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: me, blockhash, lastValidBlockHeight });
  if (!req.mint) {
    const ix = SystemProgram.transfer({ fromPubkey: me, toPubkey: to, lamports: req.amountMinor });
    ix.keys.push(ref);
    tx.add(ix);
  } else {
    const mint = new PublicKey(req.mint);
    const toAta = getAssociatedTokenAddressSync(mint, to, true);
    const ix = createTransferCheckedInstruction(getAssociatedTokenAddressSync(mint, me), mint, toAta, me, BigInt(req.amountMinor), req.decimals);
    ix.keys.push(ref);
    tx.add(createAssociatedTokenAccountIdempotentInstruction(me, toAta, to, mint)).add(ix as TransactionInstruction);
  }
  onStep("signing");
  const signed = await w.signTransaction(tx);
  onStep("sending");
  const sig = await c.sendRawTransaction(signed.serialize());
  onStep("confirming", sig);
  await confirmSig(c, sig, lastValidBlockHeight).catch((e: Error) => { throw /failed on Solana/.test(e.message) ? new Error("The payment failed on Solana.") : e; });
  onStep("verifying", sig);
  return verifyPayment(req.id, sig);
}

export async function depositAddress(rail: string, check = false) {
  const v = await api<DepositView>("/api/topup/deposit", { body: { rail, ...(check ? { check: true } : {}) } });
  if (v.credited) moneyChanged();
  return v;
}

export const testTokens = (rail: string) => api<{ sig: string; amount: number; coin: string }>("/api/topup/faucet", { body: { rail } });

/** Puts the top-up into the chat you're in as a receipt and lets the agent follow up on it. */
export async function topupInChat(ref: { creditId?: string; paymentId?: string }) {
  const convo = get().active;
  if (!convo) return;
  try {
    const r = await api<{ receipt: string | null }>("/api/topup/receipt", { body: { convo, ...ref } });
    if (!r.receipt) return;
    await refreshReceipts(convo);
    void ackTx(convo, r.receipt);
  } catch {}
}
