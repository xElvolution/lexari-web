"use client";

import { useSyncExternalStore } from "react";
import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

/** Whichever wallet can sign right now: a connected Phantom/Solflare/Backpack, or the Privy wallet made at Google/email sign-in. */
export type WalletBridge = {
  source: "adapter" | "privy";
  name: string;
  publicKey: PublicKey;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
};

const slots: { adapter: WalletBridge | null; privy: WalletBridge | null } = { adapter: null, privy: null };
const subs = new Set<() => void>();
let current: WalletBridge | null = null;

function pick() {
  current = slots.adapter || slots.privy;
  subs.forEach((f) => f());
}

export function setWalletBridge(next: WalletBridge | null, source: "adapter" | "privy" = "adapter") {
  slots[source] = next;
  pick();
}

export function walletBridge() {
  return current;
}

/** The bridge for a given address, if one is connected. */
export function bridgeFor(address: string | undefined | null) {
  if (!address) return current;
  if (slots.adapter?.publicKey.toBase58() === address) return slots.adapter;
  if (slots.privy?.publicKey.toBase58() === address) return slots.privy;
  return null;
}

export function useWalletBridge() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => current, () => null);
}

/* Sign-out hooks: Privy logout and wallet-adapter disconnect register here so signing out of Lexari ends those sessions too. */
const hooks = new Map<string, () => Promise<unknown> | unknown>();
export function onSignOut(key: string, run: (() => Promise<unknown> | unknown) | null) {
  if (run) hooks.set(key, run); else hooks.delete(key);
}
export async function runSignOutHooks() {
  await Promise.all([...hooks.values()].map((f) => Promise.resolve().then(f).catch(() => {})));
}
