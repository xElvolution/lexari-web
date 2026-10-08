"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getIdentityToken, useLinkAccount, useLoginWithSiws, usePrivy, useUnlinkOAuth, useUnlinkTelegram, useUser, type User } from "@privy-io/react-auth";
import { LANDING_URL } from "@shared/sites";
import Icon from "@/components/Icon";
import { friendly } from "@/lib/api";
import { DEV_SOCIAL, devLinkSocial, forgetSocial, loadSocial, syncSocial, useSocial } from "@/lib/social";
import { SOCIALS, SOCIAL_NAME, SOCIAL_QUEST, enabledSocials, socialStatus, type Social } from "@/lib/socialInfo";
import { planOf, toast, useApp, type State } from "@/lib/store";
import { openTopUp } from "@/lib/billing";
import { ensureBridge } from "@/lib/walletBridge";

const PRIVY_ON = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const ENABLED = enabledSocials();

/** Brand marks, drawn in currentColor so they follow the theme. */
export function SocialMark({ provider, size = 18 }: { provider: Social; size?: number }) {
  const d = {
    twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
    discord: "M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z",
    telegram: "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  }[provider];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={d} /></svg>;
}
export const TILE: Record<Social, string> = { twitter: "bg-ink text-[var(--bg)]", discord: "bg-[#5865f2] text-white", telegram: "bg-[#229ed9] text-white" };

type Actions = { ready: boolean; busy: Social | null; link: (p: Social) => void; unlink: (p: Social) => void; note?: string };

/** The status card and one row per network. Works the same with Privy, the local test mode, or neither. */
function Panel({ a }: { a: Actions }) {
  const s = useSocial();
  const app = useApp();
  // The badge follows the plan you are on right now, so it appears the moment you upgrade.
  const st = socialStatus(s.links.length, !!app && planOf(app).id !== "free");
  return (
    <>
      <section data-social-status className="grain relative overflow-hidden rounded-[22px] bg-[linear-gradient(130deg,#2a0f9a,#5b2bff_60%,#8f6bff)] p-5 text-white">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Icon name={st.badge ? "verified" : "link"} size={24} /></span>
          <div className="min-w-0 flex-1">
            <div className="label text-[9.5px] text-white/70">Your status</div>
            <div data-status-label className="display mt-1 flex items-center gap-2 text-[30px] leading-none">{st.label}{st.badge && <Icon name="verified" size={24} stroke={2.2} />}</div>
            <p className="mt-2 text-[13.5px] leading-snug text-white/80">{st.note}</p>
          </div>
        </div>
        {!st.paid && <button data-badge-pro onClick={() => openTopUp({ product: "plan", id: "pro" })} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-[13px] font-bold transition hover:bg-white/25"><Icon name="verified" size={14} stroke={2.2} />Get the badge with Pro</button>}
        <p className="mt-3 text-[12.5px] text-white/75">Your first linked account also finishes the Verified quest in the Hub for {SOCIAL_QUEST.reward} coins. Each social account can earn it once.</p>
      </section>

      <section className="mt-6">
        <h3 className="label mb-1 text-[9.5px] text-ink/50">Accounts</h3>
        <div className="divide-y divide-[var(--line)] rounded-[22px] bg-card px-4 ring-1 ring-line sm:px-5">
          {SOCIALS.map((p) => {
            const link = s.links.find((l) => l.provider === p);
            const on = ENABLED.includes(p);
            const busy = a.busy === p;
            return (
              <div key={p} data-social={p} className="flex items-center gap-3 py-3.5">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${on || link ? TILE[p] : "bg-tint text-ink/40"}`}><SocialMark provider={p} size={p === "twitter" ? 17 : 20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">{SOCIAL_NAME[p]}{link && <span className="inline-flex items-center gap-1 rounded-full bg-tint px-1.5 py-0.5 text-[10.5px] font-bold text-ink/70"><Icon name="check" size={11} stroke={2.6} />Linked</span>}</div>
                  <div className="truncate text-[13px] text-ink/55">{link ? (link.handle ? `@${link.handle}` : "Linked") : on ? "Not linked" : p === "telegram" ? "Not switched on yet" : "Not available yet"}</div>
                </div>
                {link
                  ? <button disabled={!a.ready || !!a.busy} onClick={() => a.unlink(p)} aria-label={`Unlink ${SOCIAL_NAME[p]}`} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold text-ink/70 ring-1 ring-line transition hover:text-[#e5484d] hover:ring-[#e5484d]/40 disabled:opacity-50">{busy ? "Unlinking…" : "Unlink"}</button>
                  : <button disabled={!on || !a.ready || !!a.busy} onClick={() => a.link(p)} aria-label={`Link ${SOCIAL_NAME[p]}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-tint px-4 text-[14px] font-semibold text-ink transition enabled:hover:bg-grape enabled:hover:text-white disabled:opacity-45">{busy ? "Linking…" : <><Icon name="link" size={15} />Link</>}</button>}
              </div>
            );
          })}
        </div>
        {a.note && <p className="mt-3 text-[13px] leading-snug text-ink/60">{a.note}</p>}
        {!ENABLED.includes("telegram") && <p className="mt-3 text-[13px] leading-snug text-ink/55">Telegram linking opens once our Telegram sign-in is switched on.</p>}
        {s.error && <p role="alert" className="mt-3 text-[13px] text-[#e5484d]">{s.error}</p>}
        <p className="mt-4 text-[12.5px] leading-snug text-ink/50">Privy checks the account and Lexari keeps only its ID and username. Lexari never posts for you or reads your messages. <Link href={`${LANDING_URL}/legal/privacy#processors`} className="font-semibold text-brand-ink hover:underline">Privacy policy</Link></p>
      </section>
    </>
  );
}

const report = (conflicts: string[], ok?: string) => { if (conflicts.length) conflicts.forEach((c) => toast({ text: c })); else if (ok) toast({ text: ok }); };

/** Local testing: links pretend accounts through /api/social/dev (refused by the server in production builds). */
function useDevActions(s: State): Actions {
  const [busy, setBusy] = useState<Social | null>(null);
  const run = async (p: Social, fn: () => Promise<string[]>, ok: string) => {
    setBusy(p);
    try { report(await fn(), ok); } catch (e) { toast({ text: friendly(e) }); } finally { setBusy(null); }
  };
  return {
    ready: true, busy,
    link: (p) => void run(p, () => devLinkSocial(p, s.profile?.username || "tester"), `${SOCIAL_NAME[p]} linked (test account)`),
    unlink: (p) => void run(p, () => forgetSocial(p), `${SOCIAL_NAME[p]} unlinked`),
    note: "Local test mode: links pretend accounts without Privy. This never runs in a production build.",
  };
}
function DevLinks({ s }: { s: State }) { return <Panel a={useDevActions(s)} />; }

type Linked = { provider: Social; subject: string };
function privyLinked(user: User | null): Linked[] {
  const out: Linked[] = [];
  for (const a of user?.linkedAccounts ?? []) {
    if (a.type === "twitter_oauth") out.push({ provider: "twitter", subject: a.subject });
    else if (a.type === "discord_oauth") out.push({ provider: "discord", subject: a.subject });
    else if (a.type === "telegram") out.push({ provider: "telegram", subject: a.telegramUserId });
  }
  return out;
}
const PENDING = "lexari-social-pending";

/** Real linking: Privy opens X, Discord or Telegram, then the server verifies the result from a Privy token. */
function usePrivyActions(s: State): Actions {
  const social = useSocial();
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { refreshUser } = useUser();
  const { generateSiwsMessage, loginWithSiws } = useLoginWithSiws();
  const { unlink: unlinkOAuth } = useUnlinkOAuth();
  const { unlink: unlinkTelegram } = useUnlinkTelegram();
  const [busy, setBusy] = useState<Social | null>(null);
  const google = s.auth?.method === "google";
  const address = s.auth?.address;

  const sync = useCallback(async (ok?: string) => {
    await refreshUser().catch(() => null);
    const [idToken, accessToken] = await Promise.all([getIdentityToken().catch(() => null), getAccessToken().catch(() => null)]);
    report(await syncSocial({ idToken, accessToken }), ok);
  }, [refreshUser, getAccessToken]);

  const { linkTwitter, linkDiscord, linkTelegram } = useLinkAccount({
    onSuccess: ({ linkMethod }) => {
      const p = linkMethod === "twitter" ? "twitter" : linkMethod === "discord" ? "discord" : linkMethod === "telegram" ? "telegram" : null;
      sessionStorage.removeItem(PENDING);
      void sync(p ? `${SOCIAL_NAME[p]} linked` : "Account linked").catch((e) => toast({ text: friendly(e, "Linking did not finish.") })).finally(() => setBusy(null));
    },
    onError: (err) => { sessionStorage.removeItem(PENDING); setBusy(null); if (!/exited|cancel/i.test(String(err))) toast({ text: /linked_to_another_user|already/i.test(String(err)) ? "That account is already linked to another Privy account." : "Linking did not finish. Try again." }); },
  });

  /** A Privy session for this Lexari account: Google users already have one; wallet users confirm once with their wallet. */
  const ensurePrivy = useCallback(async () => {
    const mine = (u: User | null) => !!u && (google || u.linkedAccounts.some((a) => a.type === "wallet" && a.address === address));
    if (authenticated && mine(user)) return true;
    if (authenticated) await logout().catch(() => {});
    if (google) { toast({ text: "Your Google or email session ended. Sign out and back in, then link again." }); return false; }
    const bridge = await ensureBridge(address);
    if (!bridge || !address) { toast({ text: "Connect your wallet to confirm it's you." }); return false; }
    const message = await generateSiwsMessage({ address });
    const sig = await bridge.signMessage(new TextEncoder().encode(message));
    await loginWithSiws({ message, signature: btoa(String.fromCharCode(...sig)) });
    return true;
  }, [authenticated, user, google, address, logout, generateSiwsMessage, loginWithSiws]);

  const link = async (p: Social) => {
    setBusy(p);
    try {
      if (!(await ensurePrivy())) { setBusy(null); return; }
      sessionStorage.setItem(PENDING, p);
      if (p === "twitter") linkTwitter(); else if (p === "discord") linkDiscord(); else linkTelegram();
    } catch (e) { setBusy(null); toast({ text: friendly(e, "Could not start linking.") }); }
  };
  const unlink = async (p: Social) => {
    setBusy(p);
    try {
      if (await ensurePrivy().catch(() => false)) {
        const acct = privyLinked(user).find((x) => x.provider === p);
        if (acct) { if (p === "telegram") await unlinkTelegram({ telegramUserId: acct.subject }); else await unlinkOAuth({ provider: p, subject: acct.subject }); }
      }
      report(await forgetSocial(p), `${SOCIAL_NAME[p]} unlinked`);
    } catch (e) { toast({ text: friendly(e, "Could not unlink. Try again.") }); } finally { setBusy(null); }
  };

  // Back from X or Discord, or linked on another device: if Privy's list differs from ours, let the server re-check it.
  const checked = useRef("");
  useEffect(() => {
    if (!ready || !authenticated || !user || !social.loaded) return;
    const theirs = privyLinked(user).map((x) => x.provider).sort().join(",");
    const ours = social.links.map((l) => l.provider).sort().join(",");
    if (theirs === ours || checked.current === theirs) return;
    if (!google && !user.linkedAccounts.some((a) => a.type === "wallet" && a.address === address)) return;
    checked.current = theirs;
    void sync().catch(() => {});
  }, [ready, authenticated, user, social.loaded, social.links, google, address, sync]);
  useEffect(() => { if (ready && sessionStorage.getItem(PENDING) && !busy) setBusy(sessionStorage.getItem(PENDING) as Social); }, [ready, busy]);
  useEffect(() => { if (!busy) return; const t = setTimeout(() => { setBusy(null); sessionStorage.removeItem(PENDING); }, 90_000); return () => clearTimeout(t); }, [busy]);

  return { ready, busy, link: (p) => void link(p), unlink: (p) => void unlink(p), note: google ? undefined : "You signed in with a wallet, so linking first asks your wallet to confirm it's you (no transaction, no fee)." };
}
function PrivyLinks({ s }: { s: State }) { return <Panel a={usePrivyActions(s)} />; }

/**
 * One-tap link buttons for other screens (Settings > Integrations while it is locked). Same linking as the
 * Connected accounts section: Privy, the local test mode, or nothing when linking isn't set up here.
 */
export function SocialConnect({ s, children }: { s: State; children: (a: Actions, enabled: Social[]) => React.ReactNode }) {
  if (DEV_SOCIAL) return <DevConnect s={s}>{children}</DevConnect>;
  if (PRIVY_ON) return <PrivyConnect s={s}>{children}</PrivyConnect>;
  return <>{children({ ready: false, busy: null, link: () => {}, unlink: () => {}, note: "Linking accounts is not set up on this server yet." }, [])}</>;
}
type ConnectProps = { s: State; children: (a: Actions, enabled: Social[]) => React.ReactNode };
function DevConnect({ s, children }: ConnectProps) { return <>{children(useDevActions(s), ENABLED)}</>; }
function PrivyConnect({ s, children }: ConnectProps) { return <>{children(usePrivyActions(s), ENABLED)}</>; }
export type SocialActions = Actions;

/** Settings > Connected accounts. */
export default function SocialLinks({ s }: { s: State }) {
  useEffect(() => { void loadSocial(true); }, []);
  if (DEV_SOCIAL) return <DevLinks s={s} />;
  if (PRIVY_ON) return <PrivyLinks s={s} />;
  return <Panel a={{ ready: false, busy: null, link: () => {}, unlink: () => {}, note: "Linking accounts is not set up on this server yet." }} />;
}
