"use client";

import type { PublicKey, Transaction } from "@solana/web3.js";

export type WalletBridge = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
};

let current: WalletBridge | null = null;

export function setWalletBridge(next: WalletBridge | null) {
  current = next;
}

export function walletBridge() {
  return current;
}
