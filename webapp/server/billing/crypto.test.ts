import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, Transaction, TransactionInstruction, type VersionedTransactionResponse } from "@solana/web3.js";
import { checkUsdcTransfer } from "./crypto";

const treasury = Keypair.generate().publicKey.toBase58();
const payer = Keypair.generate().publicKey;
const mint = Keypair.generate().publicKey.toBase58();
const reference = Keypair.generate().publicKey;

function fakeTx(o: { ref?: boolean; got?: number; decimals?: number; mint?: string; err?: unknown } = {}): VersionedTransactionResponse {
  const keys = o.ref === false ? [] : [{ pubkey: reference, isSigner: false, isWritable: false }];
  const message = new Transaction({ feePayer: payer, recentBlockhash: Keypair.generate().publicKey.toBase58() })
    .add(new TransactionInstruction({ programId: Keypair.generate().publicKey, keys, data: Buffer.alloc(0) })).compileMessage();
  const bal = (owner: string, amount: number) => ({ accountIndex: 0, mint: o.mint ?? mint, owner, uiTokenAmount: { amount: String(amount), decimals: o.decimals ?? 6, uiAmount: amount / 1e6, uiAmountString: "" } });
  const got = o.got ?? 10_000_000;
  return {
    slot: 1, blockTime: 0,
    transaction: { message, signatures: [] },
    meta: { err: o.err ?? null, fee: 5000, preBalances: [], postBalances: [], preTokenBalances: [bal(payer.toBase58(), 50_000_000), bal(treasury, 1_000_000)], postTokenBalances: [bal(payer.toBase58(), 50_000_000 - got), bal(treasury, 1_000_000 + got)] },
  } as unknown as VersionedTransactionResponse;
}
const want = { treasury, mint, amountMinor: 10_000_000, reference: reference.toBase58() };

test("a USDC payment with the reference, the right mint and the full amount passes", () => {
  const r = checkUsdcTransfer(fakeTx(), want);
  assert.equal(r.received, 10_000_000);
  assert.equal(r.payer, payer.toBase58());
});

test("rejects a short payment, a missing reference, the wrong mint or decimals, and a failed transaction", () => {
  assert.throws(() => checkUsdcTransfer(fakeTx({ got: 9_999_999 }), want), /less than the price/);
  assert.throws(() => checkUsdcTransfer(fakeTx({ ref: false }), want), /not this payment/);
  assert.throws(() => checkUsdcTransfer(fakeTx({ mint: Keypair.generate().publicKey.toBase58() }), want), /less than the price/);
  assert.throws(() => checkUsdcTransfer(fakeTx({ decimals: 9 }), want), /not the right token|not USDC/);
  assert.throws(() => checkUsdcTransfer(fakeTx({ err: { InstructionError: [0, "Custom"] } }), want), /failed/);
});
