"use client";

import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { SOLANA_RPC } from "./nft";
import { CARD_LAMPORTS, HIRE_LAMPORTS, HIRE_USDC, TREASURY, hireMint } from "./prices";
import { api, friendly } from "./api";
import { get } from "./store";
import { bridgeFor } from "./walletBridge";

/** Asks the server to verify a payment, retrying while the RPC catches up. */
async function record(slug: string, tx: string, mint: "SOL" | "USDC") {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try { await api("/api/hires", { method: "POST", body: { slug, tx, mint } }); return null; }
    catch (e) { last = e; const st = (e as { status?: number }).status; if (st && st < 500) break; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  return friendly(last, "We could not verify the payment.");
}

export async function payForHire(slug: string): Promise<{ ok: true; tx: string; mint: "SOL" | "USDC"; price: number } | { ok: false; error: string }> {
  if (!TREASURY) return { ok: false, error: "Payments are not set up on this server." };
  const bridge = bridgeFor(get().auth?.address);
  if (!bridge) return { ok: false, error: "Connect the wallet you signed in with to hire." };
  const mint = hireMint();
  const price = mint === "USDC" ? HIRE_USDC : HIRE_LAMPORTS;
  const treasury = new PublicKey(TREASURY);
  const connection = new Connection(SOLANA_RPC, "confirmed");
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: bridge.publicKey, blockhash, lastValidBlockHeight });
    if (mint === "SOL") {
      tx.add(SystemProgram.transfer({ fromPubkey: bridge.publicKey, toPubkey: treasury, lamports: price }));
    } else {
      const usdc = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT || "");
      const from = await getAssociatedTokenAddress(usdc, bridge.publicKey);
      const to = await getAssociatedTokenAddress(usdc, treasury);
      tx.add(createTransferInstruction(from, to, bridge.publicKey, price));
    }
    const signed = await bridge.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    const result = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    if (result.value.err) return { ok: false, error: "The payment failed on Solana." };
    const bad = await record(slug, sig, mint);
    if (bad) return { ok: false, error: `${bad} Payment ${sig.slice(0, 8)}… went through; contact support with it.` };
    return { ok: true, tx: sig, mint, price };
  } catch (error) {
    const message = (error as Error).message || "The wallet did not pay.";
    return { ok: false, error: /reject|denied|cancel/i.test(message) ? "You cancelled the payment." : message.split("\n")[0].slice(0, 160) };
  }
}

export type Card = { agent: string; issuer: string; test: boolean; number: string; last4: string; expMonth: number; expYear: number; cvv: string; limit: number; spent: number; frozen: boolean; tx: string };

/** Pays the card price in devnet SOL to the treasury, then asks the server to verify it and issue the card. */
export async function payForCard(agent: string, limit: number): Promise<{ ok: true; tx: string; card: Card } | { ok: false; error: string }> {
  if (!TREASURY) return { ok: false, error: "Payments are not set up on this server." };
  const bridge = bridgeFor(get().auth?.address);
  if (!bridge) return { ok: false, error: "Connect the wallet you signed in with to pay." };
  const connection = new Connection(SOLANA_RPC, "confirmed");
  let sig = "";
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: bridge.publicKey, blockhash, lastValidBlockHeight });
    tx.add(SystemProgram.transfer({ fromPubkey: bridge.publicKey, toPubkey: new PublicKey(TREASURY), lamports: CARD_LAMPORTS }));
    const signed = await bridge.signTransaction(tx);
    sig = await connection.sendRawTransaction(signed.serialize());
    const result = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    if (result.value.err) return { ok: false, error: "The payment failed on Solana." };
  } catch (error) {
    return { ok: false, error: friendly(error, "The wallet did not pay.") };
  }
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try { const r = await api<{ card: Card }>("/api/cards", { method: "POST", body: { agent, tx: sig, limit } }); return { ok: true, tx: sig, card: r.card }; }
    catch (e) { last = e; const st = (e as { status?: number }).status; if (st && st < 500 && st !== 404) break; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  return { ok: false, error: `${friendly(last, "We could not verify the payment.")} Payment ${sig.slice(0, 8)}… went through; contact support with it.` };
}
