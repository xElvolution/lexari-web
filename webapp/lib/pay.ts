"use client";

import { PublicKey } from "@solana/web3.js";
import { rpcConnection } from "./rpc";
import { friendly } from "./api";
import { get } from "./store";
import { ensureBridge, type WalletBridge } from "./walletBridge";

/** Network fee plus rent, for transfers your agent prepares from your sign-in wallet. Lexari itself is paid from your balance. */
export const PAY_BUFFER = 1_000_000;

export const connection = () => rpcConnection();
export const isEmbedded = () => get().auth?.method === "google";

/** The wallet that pays: the Privy wallet for Google/email accounts, the connected wallet otherwise. */
export async function payer(): Promise<WalletBridge | null> {
  const a = get().auth;
  return ensureBridge(a?.address, a?.wallet, isEmbedded());
}

export async function balanceOf(address: string) {
  return connection().getBalance(new PublicKey(address), "confirmed");
}

/** Retries server verification while the RPC catches up. */
export async function verifyWithRetry<T>(run: () => Promise<T>) {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try { return await run(); }
    catch (e) { last = e; const st = (e as { status?: number }).status; if (st && st < 500 && st !== 404) break; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw last;
}

export type Card = { agent: string; issuer: string; test: boolean; number: string; last4: string; expMonth: number; expYear: number; cvv: string; limit: number; spent: number; frozen: boolean; tx: string; amount?: number; createdAt?: string };

export { friendly };
