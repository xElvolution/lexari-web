import { useRef } from "react";
import { useEmbeddedSolanaWallet, useLoginWithEmail, useLoginWithOAuth, usePrivy } from "@privy-io/expo";
import { nonceFor, signInWithServer } from "@/lib/authFlow";
import type { SavedSession } from "@/lib/session";
import { KEY_MESSAGE, rememberKeys } from "@/lib/vault";

/** signedIn: Privy already has a user (e.g. the OAuth redirect remounted the screen); resume() finishes the server exchange for it. */
export type Methods = { google: () => Promise<void>; sendCode: (email: string) => Promise<void>; verify: (email: string, code: string) => Promise<void>; signedIn?: boolean; resume?: () => Promise<void> };

const RETRY = "We couldn't finish signing you in. Please try again.";
/** Keep our own sentences; never show Privy's raw SDK text. */
function readable(e: unknown): Error {
  const m = e instanceof Error ? e.message : "";
  if (e instanceof TypeError && /failed to fetch|network request failed/i.test(m)) return new Error("Couldn't reach Lexari. The sign-in server did not answer.");
  if (!m || /privy|`|already logged in|oauth/i.test(m) || (e as { code?: unknown })?.code !== undefined || m.length >= 120) return new Error(RETRY);
  return e as Error;
}

/** The embedded Solana provider takes the message as base64 of its bytes (Privy signs with encoding "base64").
 *  Sending the plain text made it sign the base64-decoded bytes, so the server's UTF-8 check failed. */
function utf8Base64(text: string) {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function usePlatformMethods(onSession: (s: SavedSession) => Promise<void>): Methods {
  const emailLogin = useLoginWithEmail();
  const oauth = useLoginWithOAuth();
  const privy = usePrivy();
  const solana = useEmbeddedSolanaWallet();
  // finish() runs right after login resolves, before React re-renders with the new wallet state.
  // Read the latest hook values through refs so we never act on the render that started the login.
  const solanaRef = useRef(solana);
  solanaRef.current = solana;
  const privyRef = useRef(privy);
  privyRef.current = privy;
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;

  const settle = async (ms: number) => {
    for (let waited = 0; waited < ms; waited += 250) {
      const s = solanaRef.current;
      if (s.wallets?.[0]) return;
      if (s.status === "not-created" || s.status === "error" || s.status === "needs-recovery") return;
      await sleep(250);
    }
  };

  const finish = async (email?: string) => {
    await settle(10000);
    let wallet = solanaRef.current.wallets?.[0];
    if (!wallet) {
      const create = solanaRef.current.create;
      if (create) {
        try { await create(); } catch { /* already created on another device or still settling */ }
      }
      for (let i = 0; i < 40 && !solanaRef.current.wallets?.[0]; i++) await sleep(250);
      wallet = solanaRef.current.wallets?.[0];
    }
    if (!wallet) throw new Error("We couldn't set up your wallet. Please try again.");
    const provider = await wallet.getProvider();
    const message = await nonceFor(wallet.address);
    const signed = await provider.request({ method: "signMessage", params: { message: utf8Base64(message) } });
    const token = await privyRef.current.getAccessToken();
    const session = await signInWithServer({ wallet: wallet.address, message, signature: signed.signature, privyToken: token || undefined, email });
    // the memory key, from the same embedded wallet (no prompt), so memories open on this phone like on the web
    try { const k = await provider.request({ method: "signMessage", params: { message: utf8Base64(KEY_MESSAGE) } }); await rememberKeys(wallet.address, k.signature); } catch { /* memories stay sealed until next sign-in */ }
    await onSessionRef.current(session);
  };
  // one exchange at a time: the mount/user effect and a button tap can both ask for it
  const running = useRef<Promise<void> | null>(null);
  const exchange = (email?: string) => {
    if (running.current) return running.current;
    running.current = (async () => {
      try { await finish(email); }
      catch (e) {
        console.warn("[lexari] sign-in exchange failed", e);
        // drop the Privy session so the next tap starts a clean login instead of "Already logged in"
        try { await privyRef.current.logout(); } catch { /* already signed out */ }
        throw readable(e);
      } finally { running.current = null; }
    })();
    return running.current;
  };
  // stable identity so the sign-in screen's effect only re-runs when Privy's user/isReady changes
  const resume = useRef(() => exchange()).current;
  const authed = () => !!privyRef.current.user;
  const login = async (run: () => Promise<unknown>) => {
    try { await run(); } catch (e) { if (!authed()) throw readable(e); }
  };
  return {
    // Privy may already hold the session (the OAuth return remounted this screen): skip login and just exchange
    google: async () => { if (!authed()) await login(() => oauth.login({ provider: "google", redirectUri: "/sign-in" })); await exchange(); },
    sendCode: async (email) => { if (authed()) return; try { await emailLogin.sendCode({ email }); } catch (e) { throw readable(e); } },
    verify: async (email, code) => { if (!authed()) await login(() => emailLogin.loginWithCode({ code, email })); await exchange(email); },
    signedIn: privy.isReady && !!privy.user,
    resume,
  };
}

/** Sign a plain message with this account's Privy embedded wallet (no prompt). Base64, like sign-in. Null when there's none. */
export function usePrivySigner(): ((message: string) => Promise<string>) | null {
  const solana = useEmbeddedSolanaWallet();
  const wallet = solana.wallets?.[0];
  if (!wallet) return null;
  return async (message: string) => {
    const provider = await wallet.getProvider();
    const signed = await provider.request({ method: "signMessage", params: { message: utf8Base64(message) } });
    return signed.signature;
  };
}
