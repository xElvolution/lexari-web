/** App lock: a 4–6 digit PIN, stored only as a salted scrypt hash. Checks are rate limited per account. */
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";
import { HttpError, rateLimit } from "./http";
import { verifySolanaSignature } from "./auth/siws";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, 32);
  return `s1$${salt.toString("base64")}$${key.toString("base64")}`;
}
async function matches(pin: string, stored: string) {
  const [v, salt, key] = stored.split("$");
  if (v !== "s1" || !salt || !key) return false;
  const got = await scrypt(pin, Buffer.from(salt, "base64"), 32);
  const want = Buffer.from(key, "base64");
  return got.length === want.length && timingSafeEqual(got, want);
}
export async function lockHashOf(userId: string) {
  const [u] = await db().select({ h: users.lockHash }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.h || null;
}
/** Throws 429 after 5 wrong tries in 10 minutes, 403 on a wrong PIN. */
export async function checkPin(userId: string, pin: string) {
  const h = await lockHashOf(userId);
  if (!h) throw new HttpError(400, "There's no PIN on this account.");
  if (!(await rateLimit(`lock:${userId}`, 5, 600_000))) throw new HttpError(429, "Too many tries. Wait 10 minutes and try again.");
  if (!(await matches(pin, h))) throw new HttpError(403, "That PIN isn't right.");
}
/** A fresh "view card" message signed by the account's wallet (used when no PIN is set). */
export function checkSignedConfirm(wallet: string, message: string, signature: string, what: string) {
  const m = /^Lexari: (.+)\nTime: (\d{13})$/.exec(message);
  if (!m || m[1] !== what) throw new HttpError(400, "That confirmation is for something else.");
  if (Math.abs(Date.now() - Number(m[2])) > 120_000) throw new HttpError(400, "That confirmation expired. Try again.");
  if (!verifySolanaSignature(message, signature, wallet)) throw new HttpError(403, "That signature isn't from your wallet.");
}
