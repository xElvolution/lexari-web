/**
 * Link a wallet to your Lexari account from the phone, through Privy (same checks as the web).
 *  - Solana: in the app. Mobile Wallet Adapter (Phantom, Solflare, Seed Vault…) signs Privy's SIWS message, Privy
 *    links it, and Lexari syncs it from your Privy tokens.
 *  - EVM: opens lexari.ai, where Privy links it with the same checks as the web.
 */
import { useIdentityToken, useLinkWithSiws, usePrivy } from "@privy-io/expo";
import * as WebBrowser from "expo-web-browser";
import { api } from "./api";
import { env } from "./env";
import { authorizeWallet, signMessage } from "./mwa"; // iOS stubs, kept for parity

function usePrivyWalletLink(token: string | null) {
  const privy = usePrivy();
  const siws = useLinkWithSiws();
  const { getIdentityToken } = useIdentityToken();
  const sync = async () => {
    const [idToken, accessToken] = await Promise.all([getIdentityToken().catch(() => null), privy.getAccessToken().catch(() => null)]);
    return api<{ conflicts: string[] }>("/api/wallets", { method: "POST", body: JSON.stringify({ idToken: idToken || undefined, accessToken: accessToken || undefined }) }, token);
  };
  return {
    inApp: { solana: false, evm: false },
    link: async (f: "solana" | "evm"): Promise<string> => {
      if (true) { // iOS: no Mobile Wallet Adapter, link on the web
        await WebBrowser.openAuthSessionAsync("https://app.lexari.ai/settings#wallets"); return "Wallets updated"; }
      const { address } = await authorizeWallet();
      const { message } = await siws.generateMessage({ wallet: { address }, from: { domain: "app.lexari.ai", uri: "https://app.lexari.ai" } });
      const signature = await signMessage(address, message);
      await siws.link({ signature, message, wallet: { walletClientType: "mobile_wallet_adapter", connectorType: "mobile_wallet_adapter" } });
      const r = await sync();
      return r.conflicts?.[0] || "Wallet linked";
    },
  };
}

/** Builds without a Privy app id have no PrivyProvider, so the Privy hooks above would crash. Linking finishes on lexari.ai there. */
function useSiteWalletLink(_token: string | null) {
  return {
    inApp: { solana: false, evm: false },
    link: async (_f: "solana" | "evm"): Promise<string> => { await WebBrowser.openAuthSessionAsync("https://app.lexari.ai/settings#wallets"); return "Wallets updated"; },
  };
}

/** The app id is fixed at build time, so the same hook runs on every render. */
export const useWalletLink = env.privyAppId ? usePrivyWalletLink : useSiteWalletLink;
