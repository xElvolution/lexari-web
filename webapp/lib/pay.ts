"use client";

import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { SOLANA_RPC } from "./nft";
import { HIRE_LAMPORTS, HIRE_USDC, TREASURY, hireMint } from "./prices";
import { walletBridge } from "./walletBridge";

export async function payForHire(slug: string): Promise<{ ok: true; tx: string; mint: "SOL" | "USDC"; price: number } | { ok: false; error: string }> {
  const bridge = walletBridge();
  if (!bridge) return { ok: false, error: "Connect a Solana wallet to hire." };
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
    void fetch("/api/hires", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, tx: sig, priceLamports: price, mint }),
    }).catch(() => {});
    return { ok: true, tx: sig, mint, price };
  } catch (error) {
    const message = (error as Error).message || "The wallet did not pay.";
    return { ok: false, error: /reject|denied|cancel/i.test(message) ? "You cancelled the payment." : message.split("\n")[0].slice(0, 160) };
  }
}
