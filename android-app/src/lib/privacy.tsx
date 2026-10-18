/**
 * Port of webapp/lib/privacy.ts. Hide balances (the eye): your Lexari balance, agent wallets, history amounts, card spend
 * and Hub coins show ••••. Saved to your account (prefs.hideBalance) so it follows you to every device, and kept on this
 * phone so the first paint is already hidden.
 */
import { useEffect } from "react";
import { api } from "@/lib/api";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useData } from "@/web/data";

export const MASK = "••••";

export function useHideBalance(): [boolean, (v: boolean) => void] {
  const { hideBalances, setBalances } = usePrefs();
  const { token } = useSession();
  const set = (v: boolean) => {
    setBalances(v);
    // saved for the account; a failure only means other devices don't follow yet
    if (token) void api("/api/me", { method: "PATCH", body: JSON.stringify({ prefs: { hideBalance: v } }) }, token).catch(() => {});
  };
  return [hideBalances, set];
}

/** From the account on load: the saved choice wins over this phone's cache. */
export function PrivacySync() {
  const { me } = useData();
  const { hideBalances, setBalances, loaded } = usePrefs();
  const server = me?.prefs?.hideBalance;
  useEffect(() => { if (loaded && typeof server === "boolean" && server !== hideBalances) setBalances(server); }, [server, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
