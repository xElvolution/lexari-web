/** Phone web build: the same Privy link modal the web app uses for X and Discord, then Lexari syncs from your Privy tokens. */
import { useIdentityToken, useLinkAccount, usePrivy } from "@privy-io/react-auth";
import { useRef } from "react";
import { api } from "./api";

export type SocialProvider = "twitter" | "discord";

export function useSocialLink(token: string | null) {
  const { getAccessToken, ready, user } = usePrivy();
  const { identityToken } = useIdentityToken();
  const done = useRef<{ p: SocialProvider; ok: (m: string) => void; no: (e: Error) => void } | null>(null);
  const { linkTwitter, linkDiscord } = useLinkAccount({
    onSuccess: () => { void (async () => {
      const accessToken = await getAccessToken().catch(() => null);
      const r = await api<{ conflicts?: string[] }>("/api/social", { method: "POST", body: JSON.stringify({ idToken: identityToken || undefined, accessToken: accessToken || undefined }) }, token);
      done.current?.ok(r.conflicts?.[0] || `${done.current.p === "twitter" ? "X" : "Discord"} linked`);
    })().catch((e) => done.current?.no(e as Error)); },
    onError: (e) => done.current?.no(new Error(/linked_to_another_user|already/i.test(String(e)) ? "That account is already linked to another Lexari account." : "Linking did not finish.")),
  });
  return {
    inApp: ready && !!user,
    link: (p: SocialProvider) => new Promise<string>((ok, no) => {
      if (!ready || !user) { window.open("https://app.lexari.ai/settings#social", "_blank"); ok("Finish on lexari.ai. It shows here right after."); return; }
      done.current = { p, ok, no };
      if (p === "twitter") linkTwitter(); else linkDiscord();
    }),
  };
}
