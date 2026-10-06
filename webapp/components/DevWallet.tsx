"use client";

/**
 * LOCAL DEVELOPMENT ONLY: a throwaway Solana keypair that acts as a connected wallet, so the app can be signed in to
 * and exercised (including devnet transactions) in a headless browser without Phantom or Privy.
 *
 * It is on only when BOTH hold:
 *   - NODE_ENV is not "production" (next dev); `next build` inlines "production", so this code is removed from
 *     every production bundle and cannot be switched on there, and
 *   - NEXT_PUBLIC_LEXARI_DEV_WALLET=1 in webapp/.env.local.
 * Sign-in still goes through the real server flow (nonce, signature, session cookie). The key lives in this
 * browser's localStorage ("lexari-dev-wallet"). Use: window.__lexariDevSignIn() in the console or a test.
 */
import { useEffect } from "react";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { setWalletBridge, type WalletBridge } from "@/lib/walletBridge";

export const DEV_WALLET_ON = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LEXARI_DEV_WALLET === "1";

function keypair() {
  const KEY = "lexari-dev-wallet";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved)));
  } catch { /* make a new one */ }
  const kp = Keypair.generate();
  localStorage.setItem(KEY, JSON.stringify([...kp.secretKey]));
  return kp;
}

function DevWalletOn() {
  useEffect(() => {
    const kp = keypair();
    const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
      if (tx instanceof VersionedTransaction) tx.sign([kp]); else tx.partialSign(kp);
      return tx;
    };
    const bridge: WalletBridge = {
      source: "adapter",
      name: "Dev wallet",
      publicKey: kp.publicKey,
      signMessage: async (m) => nacl.sign.detached(m, kp.secretKey),
      signTransaction: async (tx) => sign(tx),
      signAllTransactions: async (txs) => txs.map(sign),
    };
    setWalletBridge(bridge, "dev");
    const w = window as unknown as { __lexariDevSignIn?: () => Promise<string> };
    w.__lexariDevSignIn = async () => {
      const [{ signInWithWallet }, { signIn }] = await Promise.all([import("@/lib/session"), import("@/lib/store")]);
      await signInWithWallet(bridge);
      await signIn();
      return kp.publicKey.toBase58();
    };
    console.warn(`[dev wallet] local test wallet ${kp.publicKey.toBase58()} is connected (development only).`);
    return () => { setWalletBridge(null, "dev"); delete w.__lexariDevSignIn; };
  }, []);
  return null;
}

export default function DevWallet() {
  if (!DEV_WALLET_ON) return null;
  return <DevWalletOn />;
}
