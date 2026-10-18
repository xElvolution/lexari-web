/** Phone web build: the same Privy link modal the web app uses, then Lexari syncs from your Privy tokens. */
import { useIdentityToken, useLinkAccount, usePrivy } from "@privy-io/react-auth";
import { useRef } from "react";
import { api } from "./api";

export function useWalletLink(token: string | null) {
  const { getAccessToken, ready, user } = usePrivy();
  const { identityToken } = useIdentityToken();
  const done = useRef<((m: string) => void) | null>(null);
  const fail = useRef<((e: Error) => void) | null>(null);
  const { linkWallet } = useLinkAccount({
    onSuccess: () => { void (async () => {
      const accessToken = await getAccessToken().catch(() => null);
      const r = await api<{ conflicts: string[] }>("/api/wallets", { method: "POST", body: JSON.stringify({ idToken: identityToken || undefined, accessToken: accessToken || undefined }) }, token);
      done.current?.(r.conflicts?.[0] || "Wallet linked");
    })().catch((e) => fail.current?.(e as Error)); },
    onError: (e) => fail.current?.(new Error(/linked_to_another_user|already/i.test(String(e)) ? "That wallet is already linked to another account." : "Linking did not finish.")),
  });
  return {
    inApp: { solana: ready && !!user, evm: ready && !!user },
    link: (f: "solana" | "evm") => new Promise<string>((resolve, reject) => {
      if (!ready || !user) { window.open("https://app.lexari.ai/settings#wallets", "_blank"); resolve("Finish on lexari.ai. It shows here right after."); return; }
      done.current = resolve; fail.current = reject;
      linkWallet({ walletChainType: f === "solana" ? "solana-only" : "ethereum-only" });
    }),
  };
}
