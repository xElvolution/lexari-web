/**
 * Link X or Discord to your Lexari account from the phone, through Privy (same checks as the web's Settings, Connected accounts).
 * Privy runs the provider's sign-in in an in-app auth session, then Lexari reads the linked accounts from your Privy tokens
 * (POST /api/social, as webapp/lib/social.ts syncSocial). Without a Privy session (a wallet sign-in) it finishes on lexari.ai.
 */
import { useIdentityToken, useLinkWithOAuth, usePrivy } from "@privy-io/expo";
import * as WebBrowser from "expo-web-browser";
import { api } from "./api";

export type SocialProvider = "twitter" | "discord";

export function useSocialLink(token: string | null) {
  const privy = usePrivy();
  const oauth = useLinkWithOAuth();
  const { getIdentityToken } = useIdentityToken();
  return {
    inApp: !!privy.user,
    link: async (p: SocialProvider): Promise<string> => {
      if (!privy.user) { await WebBrowser.openAuthSessionAsync("https://app.lexari.ai/settings#social"); return "Accounts updated"; }
      await oauth.link({ provider: p });
      const [idToken, accessToken] = await Promise.all([getIdentityToken().catch(() => null), privy.getAccessToken().catch(() => null)]);
      const r = await api<{ conflicts?: string[] }>("/api/social", { method: "POST", body: JSON.stringify({ idToken: idToken || undefined, accessToken: accessToken || undefined }) }, token);
      return r.conflicts?.[0] || `${p === "twitter" ? "X" : "Discord"} linked`;
    },
  };
}
