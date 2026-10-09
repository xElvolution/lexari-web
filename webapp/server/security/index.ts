/**
 * Account protection for money actions (Settings > Security):
 *  - sessions: where you're signed in, sign out one or all others;
 *  - step-up: high-risk actions (big or first-time sends, adding API keys, raising budgets or limits, changing email
 *    forwarding) need a fresh confirm with your PIN (or a wallet signature when no PIN is set), good for 5 minutes on
 *    this device only;
 *  - a daily money limit across agent sends, trades and payments and wallet sends your agent prepares;
 *  - an address book: first-time addresses get a warning, and "saved addresses only" blocks the rest;
 *  - an anti-phishing phrase shown on every sensitive sheet;
 *  - a security log (sign-ins and changes), with a bell notification for new devices.
 */
import crypto from "node:crypto";
import { and, desc, eq, gt, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { sessions } from "../db/schema";
import { addressBook, securityEvents, userSecurity } from "../db/securitySchema";
import { integrationActions } from "../db/integrationsSchema";
import { HttpError, rateLimit } from "../http";
import { checkPin, lockHashOf } from "../lock";
import { verifySolanaSignature } from "../auth/siws";
import { notify } from "../notify";
import type { SessionUser } from "../auth/session";

export const STEPUP_MS = 5 * 60_000;
/** sends at or over this need a fresh confirm (on top of the Confirm card) */
export const STEPUP_SEND_USD = 25;
export const DEFAULT_DAILY_CAP_USD = 100;
export const MAX_DAILY_CAP_USD = 5000;
const COUNTED = ["submitting", "submitted", "confirmed"];

/* ---------------- settings ---------------- */
export type SecuritySettings = { phrase: string; dailySendCapUsd: number; allowlistOnly: boolean };
export async function securityOf(userId: string): Promise<SecuritySettings> {
  const [r] = await db().select().from(userSecurity).where(eq(userSecurity.userId, userId)).limit(1);
  return { phrase: r?.phrase ?? "", dailySendCapUsd: r?.dailySendCapUsd ?? DEFAULT_DAILY_CAP_USD, allowlistOnly: r?.allowlistOnly ?? false };
}

/** Tightening (lower cap, allowlist on, first phrase) is free; loosening or replacing the phrase needs a fresh confirm. */
export async function updateSecurity(user: SessionUser, patch: Partial<SecuritySettings>) {
  const cur = await securityOf(user.userId);
  const next = { ...cur };
  if (patch.phrase !== undefined) next.phrase = patch.phrase.replace(/\s+/g, " ").trim().slice(0, 40);
  if (patch.dailySendCapUsd !== undefined) next.dailySendCapUsd = Math.max(0, Math.min(MAX_DAILY_CAP_USD, Math.round(patch.dailySendCapUsd)));
  if (patch.allowlistOnly !== undefined) next.allowlistOnly = patch.allowlistOnly;
  const loosens = next.dailySendCapUsd > cur.dailySendCapUsd || (cur.allowlistOnly && !next.allowlistOnly) || (!!cur.phrase && next.phrase !== cur.phrase);
  if (loosens) requireStepUp(user, "change your security settings");
  await db().insert(userSecurity).values({ userId: user.userId, ...next }).onConflictDoUpdate({ target: userSecurity.userId, set: { ...next, updatedAt: new Date() } });
  const what = [
    next.phrase !== cur.phrase ? (next.phrase ? "Anti-phishing phrase set" : "Anti-phishing phrase removed") : "",
    next.dailySendCapUsd !== cur.dailySendCapUsd ? `Daily money limit ${cur.dailySendCapUsd} → ${next.dailySendCapUsd} USD` : "",
    next.allowlistOnly !== cur.allowlistOnly ? (next.allowlistOnly ? "Saved addresses only: on" : "Saved addresses only: off") : "",
  ].filter(Boolean).join(". ");
  if (what) await logEvent(user, "settings", what);
  return next;
}

/* ---------------- security log ---------------- */
export async function logEvent(user: { userId: string; device?: string }, kind: string, detail: string) {
  await db().insert(securityEvents).values({ userId: user.userId, kind, detail: detail.slice(0, 200), device: (user.device || "").slice(0, 60) }).catch(() => {});
}
export async function recentEvents(userId: string) {
  return db().select({ id: securityEvents.id, kind: securityEvents.kind, detail: securityEvents.detail, device: securityEvents.device, at: securityEvents.createdAt })
    .from(securityEvents).where(eq(securityEvents.userId, userId)).orderBy(desc(securityEvents.createdAt)).limit(20);
}

/* ---------------- sessions ---------------- */
export async function listSessions(userId: string, currentId: string) {
  const rows = await db().select({ id: sessions.id, device: sessions.device, ipHint: sessions.ipHint, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt })
    .from(sessions).where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date()))).orderBy(desc(sessions.lastSeenAt)).limit(30);
  return rows.map((r) => ({ id: r.id, device: r.device || "Unknown device", network: r.ipHint, createdAt: r.createdAt.getTime(), lastSeenAt: r.lastSeenAt.getTime(), current: r.id === currentId }));
}
export async function revokeSession(user: SessionUser, id: string) {
  if (id === user.sessionId) throw new HttpError(400, "Use Sign out to end this session.");
  const gone = await db().delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, user.userId))).returning({ device: sessions.device });
  if (!gone.length) throw new HttpError(404, "That session already ended.");
  await logEvent(user, "signout", `Signed out ${gone[0].device || "a device"}`);
  return gone.length;
}
export async function revokeOthers(user: SessionUser) {
  const gone = await db().delete(sessions).where(and(eq(sessions.userId, user.userId), ne(sessions.id, user.sessionId))).returning({ id: sessions.id });
  if (gone.length) await logEvent(user, "signout", `Signed out ${gone.length} other ${gone.length === 1 ? "device" : "devices"}`);
  return gone.length;
}

/** After a sign-in: a new device (not seen on any of your live sessions) is logged and announced on the bell. */
export async function noteSignIn(userId: string, sessionId: string, device: string, hint: string) {
  const others = await db().select({ device: sessions.device, ipHint: sessions.ipHint }).from(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, sessionId)));
  const [prevEvent] = await db().select({ id: securityEvents.id }).from(securityEvents).where(eq(securityEvents.userId, userId)).limit(1);
  const known = others.some((o) => o.device === device && o.ipHint === hint);
  await logEvent({ userId, device }, "signin", `Signed in${hint ? ` from network ${hint}` : ""}`);
  // The very first sign-in of an account isn't news.
  if (!known && (others.length || prevEvent)) {
    await notify(userId, { kind: "security", title: "New sign-in to your Lexari account", body: `${device}${hint ? ` · network ${hint}` : ""}. Not you? Open Settings > Security and sign out other devices.`, url: "/settings#security", key: `signin:${sessionId}` });
  }
}

/* ---------------- step-up ---------------- */
const stepupFresh = (user: SessionUser) => !!user.stepupUntil && user.stepupUntil.getTime() > Date.now();

/** Throws 401 { stepup } unless this session re-confirmed in the last 5 minutes. The app opens the confirm sheet and retries. */
export function requireStepUp(user: SessionUser, what: string) {
  if (stepupFresh(user)) return;
  throw new HttpError(401, `Confirm it's you to ${what}.`, { stepup: { what } });
}

export const STEPUP_MESSAGE = "Lexari: confirm it's you";
/** Re-confirms this session: the PIN when one is set, otherwise a fresh wallet signature (single use, 2 minutes). */
export async function grantStepUp(user: SessionUser, proof: { pin?: string; message?: string; signature?: string }) {
  if (!(await rateLimit(`stepup:${user.userId}`, 10, 600_000))) throw new HttpError(429, "Too many tries. Wait 10 minutes and try again.");
  const hasPin = !!(await lockHashOf(user.userId));
  if (hasPin) {
    if (!proof.pin) throw new HttpError(400, "Enter your PIN.");
    await checkPin(user.userId, proof.pin);
  } else {
    if (!proof.message || !proof.signature) throw new HttpError(400, "Confirm with your wallet.");
    const m = /^Lexari: confirm it's you\nSession: ([a-f0-9]{8})\nTime: (\d{13})$/.exec(proof.message);
    if (!m || m[1] !== user.sessionId.replace(/-/g, "").slice(0, 8)) throw new HttpError(400, "That confirmation is for something else.");
    if (Math.abs(Date.now() - Number(m[2])) > 120_000) throw new HttpError(400, "That confirmation expired. Try again.");
    if (!verifySolanaSignature(proof.message, proof.signature, user.wallet)) throw new HttpError(403, "That signature isn't from your wallet.");
    await useOnce(proof.signature);
  }
  const until = new Date(Date.now() + STEPUP_MS);
  await db().update(sessions).set({ stepupUntil: until }).where(eq(sessions.id, user.sessionId));
  await logEvent(user, "stepup", hasPin ? "Confirmed with PIN" : "Confirmed with wallet signature");
  return { until: until.getTime(), method: hasPin ? "pin" : "wallet" };
}

/** A signed confirmation works once: a copied signature can't be replayed inside its 2-minute window. */
export async function useOnce(signature: string) {
  const h = crypto.createHash("sha256").update(signature).digest("hex").slice(0, 40);
  if (!(await rateLimit(`sig-used:${h}`, 1, 300_000))) throw new HttpError(400, "That confirmation was already used. Try again.");
}

/* ---------------- address book ---------------- */
export const chainOfAddress = (a: string) => (/^0x[0-9a-fA-F]{40}$/.test(a) ? "evm" : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) ? "solana" : "");
const norm = (chain: string, a: string) => (chain === "evm" ? a.toLowerCase() : a);

export async function listAddresses(userId: string) {
  return (await db().select().from(addressBook).where(eq(addressBook.userId, userId)).orderBy(desc(addressBook.createdAt)).limit(200))
    .map((r) => ({ id: r.id, chain: r.chain, address: r.address, label: r.label, at: r.createdAt.getTime() }));
}
export async function addAddress(user: SessionUser, address: string, label: string) {
  const chain = chainOfAddress(address.trim());
  if (!chain) throw new HttpError(400, "That isn't a Solana or EVM (0x…) address.");
  requireStepUp(user, "save a send address");
  const a = norm(chain, address.trim());
  await db().insert(addressBook).values({ userId: user.userId, chain, address: a, label: label.trim().slice(0, 40) })
    .onConflictDoUpdate({ target: [addressBook.userId, addressBook.chain, addressBook.address], set: { label: label.trim().slice(0, 40) } });
  await logEvent(user, "address", `Saved ${label.trim() ? `"${label.trim().slice(0, 40)}" ` : ""}${a.slice(0, 4)}…${a.slice(-4)}`);
  return listAddresses(user.userId);
}
export async function removeAddress(user: SessionUser, id: string) {
  const gone = await db().delete(addressBook).where(and(eq(addressBook.id, id), eq(addressBook.userId, user.userId))).returning({ address: addressBook.address });
  if (gone.length) await logEvent(user, "address", `Removed ${gone[0].address.slice(0, 4)}…${gone[0].address.slice(-4)}`);
  return listAddresses(user.userId);
}
export async function knownAddress(userId: string, address: string) {
  const chain = chainOfAddress(address);
  if (!chain) return false;
  const [r] = await db().select({ id: addressBook.id }).from(addressBook).where(and(eq(addressBook.userId, userId), eq(addressBook.chain, chain), eq(addressBook.address, norm(chain, address)))).limit(1);
  return !!r;
}

/* ---------------- daily money limit ---------------- */
/** What moved in the last 24 hours: agent sends, trades and payments (integration actions) and wallet sends from chat. */
export async function movedToday(userId: string) {
  const since = new Date(Date.now() - 86_400_000);
  const [a] = await db().select({ v: sql<string>`coalesce(sum(${integrationActions.usdMicros}), 0)` }).from(integrationActions)
    .where(and(eq(integrationActions.userId, userId), inArray(integrationActions.status, COUNTED), gte(integrationActions.createdAt, since)));
  const [w] = await db().select({ v: sql<string>`coalesce(sum((nullif(${securityEvents.detail}, '')::bigint)), 0)` }).from(securityEvents)
    .where(and(eq(securityEvents.userId, userId), eq(securityEvents.kind, "walletsend"), gte(securityEvents.createdAt, since)));
  return Number(a?.v || 0) + Number(w?.v || 0);
}

export type SendCheck = { firstTime: boolean; needsStepUp: boolean; phrase: string };
/**
 * Before an agent prepares a send, trade or payment: inside the daily money limit, and (with "saved addresses only")
 * only to a saved address. Returns whether the address is new and whether Confirm needs a fresh PIN/wallet confirm.
 * `excludeId`: an action already counted (status submitting) that is being checked again.
 */
export async function checkMoney(userId: string, m: { usdMicros: number; to?: string | null; alreadyCounted?: number }): Promise<SendCheck> {
  const s = await securityOf(userId);
  const used = (await movedToday(userId)) - (m.alreadyCounted || 0);
  const cap = s.dailySendCapUsd * 1_000_000;
  const usd = (x: number) => `$${(x / 1e6).toFixed(2)}`;
  if (m.usdMicros > 0 && used + m.usdMicros > cap) {
    throw new HttpError(403, s.dailySendCapUsd === 0
      ? "Your daily money limit is $0, so agents can't send, pay or trade. Change it in Settings > Security."
      : `That would take today's total to ${usd(used + m.usdMicros)}, over your ${usd(cap)} daily money limit (Settings > Security).`);
  }
  let firstTime = false;
  if (m.to) {
    const known = await knownAddress(userId, m.to);
    if (!known && s.allowlistOnly) throw new HttpError(403, "You only allow sends to saved addresses. Save this address in Settings > Security first.");
    firstTime = !known && !(await sentBefore(userId, m.to));
  }
  return { firstTime, needsStepUp: firstTime || m.usdMicros >= STEPUP_SEND_USD * 1_000_000, phrase: s.phrase };
}

/** An address you already sent to successfully (from an agent wallet), so it's not "first time". */
async function sentBefore(userId: string, to: string) {
  const [r] = await db().select({ id: integrationActions.id }).from(integrationActions)
    .where(and(eq(integrationActions.userId, userId), eq(integrationActions.status, "confirmed"), sql`${integrationActions.preview}->'plan'->>'to' = ${to}`)).limit(1);
  return !!r;
}

/** A wallet send from chat went through: count it toward the daily limit (USD micros in detail). */
export async function countWalletSend(userId: string, usdMicros: number, ref: string) {
  if (!(usdMicros > 0)) return;
  // once per transaction (the signature is kept in `device`, which the log never shows for this kind)
  const [seen] = await db().select({ id: securityEvents.id }).from(securityEvents).where(and(eq(securityEvents.userId, userId), eq(securityEvents.kind, "walletsend"), eq(securityEvents.device, ref))).limit(1);
  if (seen) return;
  await db().insert(securityEvents).values({ userId, kind: "walletsend", detail: String(Math.round(usdMicros)), device: ref }).catch(() => {});
}
