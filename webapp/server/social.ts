/**
 * Social accounts (X, Discord, Telegram) linked through Privy. The browser never tells us what is linked:
 * it hands over a Privy token and we read the linked accounts from it ourselves.
 *
 * - Identity token (preferred): an ES256 JWT signed with the same public key as access tokens, carrying a
 *   `linked_accounts` claim. Needs "Return user data in an identity token" on in the Privy dashboard.
 * - Privy REST API (fallback): when PRIVY_APP_SECRET is set, the access token is verified and the user is
 *   read from https://auth.privy.io/api/v1/users/{did}.
 *
 * The Privy account must be this Lexari account: the same Privy user id (Google or email sign-in), or a
 * Privy account that has this wallet linked (wallet sign-in, after a Sign-In With Solana to Privy).
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { socialLinks, socialSeen, users } from "./db/schema";
import { HttpError } from "./http";
import { verifyPrivyJwt } from "./auth/privy";
import { SOCIALS, SOCIAL_NAME, isSocial, socialStatus, type Social, type SocialLink } from "@/lib/socialInfo";
import { currentPlan } from "./plans";

type Found = { provider: Social; subject: string; handle: string | null };
type Snapshot = { did: string | null; wallets: string[]; accounts: Found[] };

const TYPE: Record<string, Social> = { twitter_oauth: "twitter", discord_oauth: "discord", telegram: "telegram" };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : typeof v === "number" ? String(v) : null);

/** Reads Privy linked accounts (identity token "light" format and REST format both use these snake_case keys). */
export function parseLinked(list: unknown): { wallets: string[]; accounts: Found[] } {
  const wallets: string[] = [], accounts: Found[] = [];
  if (!Array.isArray(list)) return { wallets, accounts };
  for (const a of list as Record<string, unknown>[]) {
    if (!a || typeof a !== "object") continue;
    if (a.type === "wallet" && a.chain_type === "solana" && typeof a.address === "string") { wallets.push(a.address); continue; }
    const provider = TYPE[String(a.type)];
    if (!provider || accounts.some((x) => x.provider === provider)) continue;
    const subject = provider === "telegram" ? str(a.telegram_user_id) : str(a.subject);
    if (!subject) continue;
    accounts.push({ provider, subject, handle: str(a.username) });
  }
  return { wallets, accounts };
}

export function socialVerifier(): "identity-token" | "api" {
  return process.env.PRIVY_APP_SECRET ? "api" : "identity-token";
}

async function fromIdentityToken(token: string): Promise<Snapshot> {
  const p = await verifyPrivyJwt(token, "Your social sign-in expired. Try again.");
  let list: unknown = p.linked_accounts;
  if (typeof list === "string") { try { list = JSON.parse(list); } catch { list = null; } }
  if (!Array.isArray(list)) throw new HttpError(400, "Privy did not include your linked accounts. Try again.");
  return { did: p.sub, ...parseLinked(list) };
}

async function fromApi(accessToken: string): Promise<Snapshot> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!, secret = process.env.PRIVY_APP_SECRET!;
  const { sub } = await verifyPrivyJwt(accessToken, "Your social sign-in expired. Try again.");
  const res = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(sub)}`, {
    headers: { authorization: `Basic ${Buffer.from(`${appId}:${secret}`).toString("base64")}`, "privy-app-id": appId },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) throw new HttpError(502, "Could not reach Privy to check your accounts. Try again.");
  const body = (await res.json().catch(() => ({}))) as { linked_accounts?: unknown };
  return { did: sub, ...parseLinked(body.linked_accounts) };
}

export async function listSocial(userId: string): Promise<SocialLink[]> {
  const rows = await db().select({ provider: socialLinks.provider, handle: socialLinks.handle, verifiedAt: socialLinks.verifiedAt }).from(socialLinks).where(eq(socialLinks.userId, userId));
  return SOCIALS.flatMap((p) => rows.filter((r) => r.provider === p).map((r) => ({ provider: p, handle: r.handle, verifiedAt: r.verifiedAt.getTime() })));
}

/** True when the person has at least one server-verified X, Discord or Telegram account linked. */
export async function hasVerifiedSocial(userId: string): Promise<boolean> {
  const [row] = await db().select({ one: sql<number>`1` }).from(socialLinks).where(eq(socialLinks.userId, userId)).limit(1);
  return !!row;
}

/** Throws a 403 unless the person has a verified social account. Use it to gate features that need a real person. */
export async function requireSocial(userId: string, what = "use this"): Promise<void> {
  if (!(await hasVerifiedSocial(userId))) throw new HttpError(403, `Link an X, Discord or Telegram account in Settings to ${what}.`);
}

const isUnique = (e: unknown) => (e as { code?: string })?.code === "23505" || (e as { cause?: { code?: string } })?.cause?.code === "23505";

/**
 * Makes the stored links for `scope` match `accounts`. A social account linked to another Lexari account is refused.
 * A link is rewardable only the first time that social account is ever seen (social_seen is never cleared).
 */
async function apply(userId: string, did: string | null, accounts: Found[], scope: readonly Social[]) {
  const conflicts: Social[] = [];
  await db().transaction(async (tx) => {
    const current = await tx.select().from(socialLinks).where(eq(socialLinks.userId, userId)).for("update");
    for (const provider of scope) {
      const found = accounts.find((a) => a.provider === provider);
      const cur = current.find((c) => c.provider === provider);
      if (!found) { if (cur) await tx.delete(socialLinks).where(and(eq(socialLinks.userId, userId), eq(socialLinks.provider, provider))); continue; }
      if (cur && cur.subject === found.subject) {
        await tx.update(socialLinks).set({ handle: found.handle, verifiedAt: new Date(), ...(did ? { privyDid: did } : {}) }).where(and(eq(socialLinks.userId, userId), eq(socialLinks.provider, provider)));
        continue;
      }
      const [owner] = await tx.select({ userId: socialLinks.userId }).from(socialLinks).where(and(eq(socialLinks.provider, provider), eq(socialLinks.subject, found.subject))).limit(1);
      if (owner && owner.userId !== userId) { conflicts.push(provider); continue; }
      const seen = await tx.insert(socialSeen).values({ provider, subject: found.subject, firstUserId: userId }).onConflictDoNothing().returning({ s: socialSeen.subject });
      const row = { provider, subject: found.subject, handle: found.handle, privyDid: did, rewardable: seen.length > 0, verifiedAt: new Date() };
      await tx.insert(socialLinks).values({ userId, ...row }).onConflictDoUpdate({ target: [socialLinks.userId, socialLinks.provider], set: row });
    }
  }).catch((e) => { if (isUnique(e)) throw new HttpError(409, "That account was just linked to another Lexari account."); throw e; });
  return conflicts;
}

/** Reads the person's Privy linked accounts from a token, checks the Privy account is theirs, and stores the result. */
export async function syncSocial(user: { userId: string; wallet: string }, tokens: { idToken?: string; accessToken?: string }) {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) throw new HttpError(503, "Linking accounts is not set up here yet.");
  let snap: Snapshot;
  if (tokens.idToken) snap = await fromIdentityToken(tokens.idToken);
  else if (tokens.accessToken && process.env.PRIVY_APP_SECRET) snap = await fromApi(tokens.accessToken);
  else throw new HttpError(503, "Linking accounts is not set up here yet.");

  const [me] = await db().select({ privyDid: users.privyDid, wallet: users.wallet }).from(users).where(eq(users.id, user.userId)).limit(1);
  if (!me) throw new HttpError(401, "You're signed out. Sign in again.");
  if (me.privyDid) {
    if (me.privyDid !== snap.did) throw new HttpError(409, "That Privy account belongs to a different Lexari account.");
  } else {
    if (!snap.wallets.includes(me.wallet)) throw new HttpError(403, "Confirm with the same wallet you use for Lexari, then try again.");
    const [other] = await db().select({ id: users.id }).from(users).where(eq(users.privyDid, snap.did!)).limit(1);
    if (other && other.id !== user.userId) throw new HttpError(409, "That Privy account belongs to a different Lexari account.");
  }
  const conflicts = await apply(user.userId, snap.did, snap.accounts, SOCIALS);
  return { links: await listSocial(user.userId), conflicts: conflicts.map((p) => `This ${SOCIAL_NAME[p]} account is already linked to another Lexari account.`) };
}

export async function unlinkSocial(userId: string, provider: Social) {
  await db().delete(socialLinks).where(and(eq(socialLinks.userId, userId), eq(socialLinks.provider, provider)));
  return listSocial(userId);
}

/**
 * Local testing without Privy. Off unless LEXARI_DEV_SOCIAL=1, and always off in a production build
 * (NODE_ENV is "production" for `next build` / `next start`), so it can never run on the live app.
 */
export function devSocialEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.LEXARI_DEV_SOCIAL === "1";
}
export async function devLink(userId: string, provider: string, handle: string) {
  if (!devSocialEnabled()) throw new HttpError(404, "Not found.");
  if (!isSocial(provider)) throw new HttpError(400, "Unknown account type.");
  const h = handle.replace(/[^a-z0-9_]/gi, "").slice(0, 30) || "tester";
  const conflicts = await apply(userId, null, [{ provider, subject: `dev:${h.toLowerCase()}`, handle: h }], [provider]);
  return { links: await listSocial(userId), conflicts: conflicts.map((p) => `This ${SOCIAL_NAME[p]} account is already linked to another Lexari account.`) };
}

/** The badge needs a linked account and a paid plan. */
export async function statusFor(userId: string, linked: number) {
  const plan = await currentPlan(userId);
  return socialStatus(linked, plan.id !== "free");
}

export async function socialSummary(userId: string) {
  const links = await listSocial(userId);
  return { links, status: await statusFor(userId, links.length) };
}
