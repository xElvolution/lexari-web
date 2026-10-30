import { useRef } from "react";
import { useLogin, useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import { useCreateWallet, useSignMessage, useWallets } from "@privy-io/react-auth/solana";
import { nonceFor, signInWithServer } from "@/lib/authFlow";
import type { SavedSession } from "@/lib/session";
import { KEY_MESSAGE, rememberKeys } from "@/lib/vault";
import type { Methods } from "./privyMethods.native";

export type { Methods };

function toBase64(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

export function usePlatformMethods(onSession: (s: SavedSession) => Promise<void>): Methods {
  const { getAccessToken } = usePrivy();
  const emailLogin = useLoginWithEmail();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { signMessage } = useSignMessage();
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;
  const pending = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);

  const finish = async (email?: string) => {
    let wallet = walletsRef.current[0];
    if (!wallet) {
      try { await createWallet(); } catch { /* already created, or the modal is still settling */ }
      for (let i = 0; i < 12 && !walletsRef.current[0]; i++) await new Promise((r) => setTimeout(r, 400));
      wallet = walletsRef.current[0];
    }
    if (!wallet) throw new Error("We couldn't set up your wallet. Please try again.");
    const message = await nonceFor(wallet.address);
    const signed = await signMessage({
      message: new TextEncoder().encode(message),
      wallet,
      options: { uiOptions: { showWalletUIs: false } },
    });
    const signature = toBase64(signed.signature);
    const token = await getAccessToken();
    const session = await signInWithServer({ wallet: wallet.address, message, signature, privyToken: token || undefined, email });
    try {
      const k = await signMessage({ message: new TextEncoder().encode(KEY_MESSAGE), wallet, options: { uiOptions: { showWalletUIs: false } } });
      await rememberKeys(wallet.address, toBase64(k.signature));
    } catch { /* memories stay sealed until next sign-in */ }
    await onSessionRef.current(session);
  };

  const { login } = useLogin({
    onComplete: () => { void finish().then(() => pending.current?.resolve()).catch((error) => pending.current?.reject(error instanceof Error ? error : new Error("That didn't work. Please try again."))); },
    onError: (code) => { console.warn("privy login", code); pending.current?.reject(new Error("Google sign-in was cancelled.")); },
  });

  return {
    google: () => new Promise<void>((resolve, reject) => {
      pending.current = { resolve, reject };
      login({ loginMethods: ["google"] });
    }),
    sendCode: async (email) => { await emailLogin.sendCode({ email }); },
    verify: async (_email, code) => { await emailLogin.loginWithCode({ code }); await finish(_email); },
  };
}

/** Sign a plain message with this account's Privy embedded wallet (no prompt). Base64, like sign-in. Null when there's none. */
export function usePrivySigner(): ((message: string) => Promise<string>) | null {
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const wallet = wallets[0];
  if (!wallet) return null;
  return async (message: string) => toBase64((await signMessage({ message: new TextEncoder().encode(message), wallet, options: { uiOptions: { showWalletUIs: false } } })).signature);
}
