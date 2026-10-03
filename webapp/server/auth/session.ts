import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "../db";
import { referrals, sessions, users } from "../db/schema";
import { HttpError } from "../http";
import { buildSignInMessage, isWallet, verifySolanaSignature } from "./siws";

export const SESSION_COOKIE = "lexari_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const NONCE_MS = 10 * 60 * 1000;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function hashToken(token: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new HttpError(503, "SESSION_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

function referralCode() {
  const bytes = crypto.randomBytes(8);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

async function freshCode() {
  const database = db();
  for (let i = 0; i < 6; i++) {
    const code = referralCode();
    const taken = await database.select({ id: users.id }).from(users).where(eq(users.referralCode, code)).limit(1);
    if (!taken.length) return code;
  }
  throw new HttpError(500, "Could not mint a referral code.");
}

export async function issueNonce(wallet: string, origin: { domain: string; uri: string }) {
  if (!isWallet(wallet)) throw new HttpError(400, "That is not a Solana wallet address.");
  const database = db();
  const nonce = crypto.randomBytes(16).toString("base64url");
  const issuedAt = new Date().toISOString();
  const message = buildSignInMessage({ domain: origin.domain, wallet, uri: origin.uri, nonce, issuedAt });
  const nonceExpires = new Date(Date.now() + NONCE_MS);
  const patch = { nonce, nonceMessage: message, nonceExpires };

  const existing = await database.select().from(users).where(eq(users.wallet, wallet)).limit(1);
  if (existing[0]) {
    await database.update(users).set(patch).where(eq(users.id, existing[0].id));
  } else {
    try {
      await database.insert(users).values({ wallet, referralCode: await freshCode(), ...patch });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      await database.update(users).set(patch).where(eq(users.wallet, wallet));
    }
  }
  return { message, expiresAt: nonceExpires.toISOString() };
}

export async function verifySignIn(input: { wallet: string; message: string; signature: string; referral?: string }) {
  if (!isWallet(input.wallet)) throw new HttpError(400, "That is not a Solana wallet address.");
  if (!verifySolanaSignature(input.message, input.signature, input.wallet)) {
    throw new HttpError(401, "Signature does not match this wallet.");
  }
  const database = db();
  const found = await database.select().from(users).where(eq(users.wallet, input.wallet)).limit(1);
  const user = found[0];
  if (!user?.nonceMessage || !user.nonceExpires) throw new HttpError(400, "Start sign-in again.");
  if (user.nonceExpires.getTime() < Date.now()) throw new HttpError(400, "That sign-in expired. Start again.");
  if (user.nonceMessage !== input.message) throw new HttpError(400, "The signed message does not match the one we issued.");

  await database.update(users).set({ nonce: null, nonceMessage: null, nonceExpires: null }).where(eq(users.id, user.id));

  if (input.referral && !user.referredBy) {
    const referrer = await database.select().from(users).where(eq(users.referralCode, input.referral)).limit(1);
    const ref = referrer[0];
    if (ref && ref.id !== user.id) {
      await database.update(users).set({ referredBy: ref.id }).where(and(eq(users.id, user.id), isNull(users.referredBy)));
      await database.insert(referrals).values({ referrerId: ref.id, refereeId: user.id }).onConflictDoNothing({ target: referrals.refereeId });
    }
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_MS);
  await database.insert(sessions).values({ userId: user.id, tokenHash: hashToken(token), expiresAt: expires });
  return { token, expires, wallet: user.wallet, referralCode: user.referralCode };
}

export async function currentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db()
    .select({ wallet: users.wallet, referralCode: users.referralCode, userId: users.id })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}
