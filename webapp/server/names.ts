import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { agents, users } from "./db/schema";

/** Usernames: 3 to 20 of a-z, 0-9, _ and . (stored lowercase, unique). */
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

/** True for text that must never be used to address someone: an email address, a wallet, a URL. */
export function notAName(s: string) {
  const t = s.trim();
  return !t || t.includes("@") || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t) || /^0x[0-9a-f]{40}$/i.test(t) || /https?:|www\./i.test(t);
}

/** A display name as typed, tidied. "" when it isn't a usable name. */
export function cleanName(s: unknown, max: number) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return notAName(t) ? "" : t;
}

export const firstName = (full: string) => cleanName(full, 60).split(" ")[0] || "";

/** What agents call the person: their chosen call name, else their first name, else "" (agents then use no name). */
export function addressOf(u: { callName?: string | null; fullName?: string | null } | undefined, homeYou?: unknown) {
  return cleanName(u?.callName, 30) || firstName(u?.fullName || "") || cleanName(homeYou, 30);
}

export async function addressName(userId: string) {
  const database = db();
  const [[u], [h]] = await Promise.all([
    database.select({ callName: users.callName, fullName: users.fullName }).from(users).where(eq(users.id, userId)).limit(1),
    database.select({ meta: agents.meta }).from(agents).where(and(eq(agents.userId, userId), eq(agents.slug, "home"))).limit(1),
  ]);
  return addressOf(u, (h?.meta as { you?: string } | undefined)?.you);
}

export class NameError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

/**
 * Validates and saves names. Keeps the profile (name, username) and the home agent's "you" in step so every app and
 * older client shows the same thing. Throws NameError with a plain message.
 */
export async function saveNames(userId: string, input: { fullName?: string; username?: string; callName?: string }) {
  const database = db();
  const set: { fullName?: string | null; username?: string | null; callName?: string | null } = {};
  if (input.fullName !== undefined) {
    const f = cleanName(input.fullName, 60);
    if (!f) throw new NameError("Add your full name (not an email address).");
    if (f.length < 2) throw new NameError("Your full name looks too short.");
    set.fullName = f;
  }
  if (input.username !== undefined) {
    const u = String(input.username).trim().replace(/^@/, "").toLowerCase();
    if (!USERNAME_RE.test(u)) throw new NameError("Usernames are 3 to 20 letters, numbers, dots or underscores.");
    const [taken] = await database.select({ id: users.id }).from(users).where(and(eq(users.username, u), ne(users.id, userId))).limit(1);
    if (taken) throw new NameError("That username is taken. Try another.", 409);
    set.username = u;
  }
  if (input.callName !== undefined) {
    const raw = String(input.callName).trim();
    if (raw && notAName(raw)) throw new NameError("Pick a name for your agents to use, not an email address.");
    set.callName = cleanName(raw, 30) || null;
  }
  if (!Object.keys(set).length) return;
  const [me] = await database.select({ profile: users.profile, fullName: users.fullName, callName: users.callName }).from(users).where(eq(users.id, userId)).limit(1);
  const profile = { ...(me?.profile || {}) } as Record<string, unknown>;
  if (set.fullName) profile.name = set.fullName;
  if (set.username) profile.username = set.username;
  try {
    await database.update(users).set({ ...set, profile }).where(eq(users.id, userId));
  } catch (e) {
    if (/users_username_unique|duplicate key/i.test((e as Error).message)) throw new NameError("That username is taken. Try another.", 409);
    throw e;
  }
  const call = addressOf({ callName: set.callName !== undefined ? set.callName : me?.callName, fullName: set.fullName ?? me?.fullName });
  // the home agent's "It calls you" follows (older apps read it from there)
  await database.update(agents).set({ meta: sql`coalesce(${agents.meta}, '{}'::jsonb) || jsonb_build_object('you', ${call}::text)` }).where(and(eq(agents.userId, userId), eq(agents.slug, "home"))).catch(() => {});
}
