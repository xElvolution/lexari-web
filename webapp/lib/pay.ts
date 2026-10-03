"use client";

import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { SOLANA_RPC } from "./nft";
import { HIRE_LAMPORTS, HIRE_USDC, TREASURY, hireMint } from "./prices";
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
  const bridge = bridgeFor(get().auth?.address);
  if (!bridge) return { ok: false, error: "Connect the wallet you signed in with to hire." };
  if (!TREASURY) return { ok: false, error: "Hiring is not open yet." };
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
