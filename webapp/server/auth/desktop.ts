import crypto from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db";
import { desktopAuthCodes } from "../db/desktopSchema";
import { hashToken } from "./session";

export const DESKTOP_CODE_MS = 60_000;

/** Only the Lexari desktop scheme may receive a code. No other scheme, no credentials, no fragments. */
export function desktopReturnUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  if (!/^lexari:\/\/[A-Za-z0-9/_.-]*$/.test(raw)) return null;
  return raw;
}

/** A single-use, 60-second code for the signed-in user. Only its hash is stored. */
export async function mintDesktopCode(userId: string) {
  const code = crypto.randomBytes(32).toString("base64url");
  const database = db();
  await database.delete(desktopAuthCodes).where(lt(desktopAuthCodes.expiresAt, new Date())).catch(() => {});
  await database.insert(desktopAuthCodes).values({ codeHash: hashToken("desktop:" + code), userId, expiresAt: new Date(Date.now() + DESKTOP_CODE_MS) });
  return code;
}

/** Burns the code (delete ... returning, so two racing exchanges cannot both win) and returns its user, or null. */
export async function redeemDesktopCode(code: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) return null;
  const rows = await db().delete(desktopAuthCodes)
    .where(and(eq(desktopAuthCodes.codeHash, hashToken("desktop:" + code)), gt(desktopAuthCodes.expiresAt, new Date())))
    .returning({ userId: desktopAuthCodes.userId });
  return rows[0]?.userId ?? null;
}
