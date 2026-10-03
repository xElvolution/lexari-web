"use client";

import { api } from "./api";
import type { WalletBridge } from "./walletBridge";

const b64 = (bytes: Uint8Array) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };

/** Sign-In With Solana: the server writes a one-time message, the wallet signs it, the server sets the session cookie. */
export async function signInWithWallet(bridge: WalletBridge, extra: { privyToken?: string; email?: string } = {}) {
  const wallet = bridge.publicKey.toBase58();
  const { message } = await api<{ message: string }>("/api/auth/nonce", { body: { wallet } });
  const signature = await bridge.signMessage(new TextEncoder().encode(message));
  const referral = referralCode();
  return api<{ wallet: string; referralCode: string }>("/api/auth/verify", {
    body: { wallet, message, signature: b64(signature), ...(referral ? { referral } : {}), ...extra },
  });
}

/** A ?ref= code from the invite link, kept until sign-in. */
export function referralCode() {
  if (typeof window === "undefined") return undefined;
  const fromUrl = new URLSearchParams(window.location.search).get("ref");
  try {
    if (fromUrl && /^[A-Za-z0-9-]{4,16}$/.test(fromUrl)) sessionStorage.setItem("lexari-ref", fromUrl.toUpperCase());
    return sessionStorage.getItem("lexari-ref") || undefined;
  } catch {
    return fromUrl?.toUpperCase() || undefined;
  }
}

export async function signOutSession() {
  await api("/api/auth/signout", { method: "POST" }).catch(() => {});
}
