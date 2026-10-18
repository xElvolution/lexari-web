/**
 * Developer accounts for the SDK alpha (invite-only): joining with an invite, the profile, developer keys and the
 * CLI's device-code login. Keys are shown once, stored only as a SHA-256 hash, scoped and revocable. Creating a key
 * (directly or by approving a device code) needs a fresh step-up; the routes call requireStepUp before these.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { developerDeviceCodes, developerInvites, developerKeys, developers } from "../db/marketSchema";
import { HttpError, rateLimit } from "../http";
import { KEY_PREFIX, KEY_SCOPES, MAX_KEYS, type KeyScope } from "./config";

export type Developer = typeof developers.$inferSelect;
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = (n: number) => Array.from(randomBytes(n), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
/** Invite and user codes ignore case, spaces and dashes when typed. */
const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/* ---------- profile ---------- */
const noDash = (s: string) => !s.includes("\u2014");
export const joinBody = z.object({
  invite: z.string().trim().min(6).max(40),
  handle: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9-]{2,31}$/, "3 to 32 characters: lowercase letters, digits and dashes."),
  name: z.string().trim().min(2).max(48).refine(noDash, "No em dashes, please."),
  terms: z.literal(true, { errorMap: () => ({ message: "Accept the developer terms to continue." }) }),
}).strict();
export const profileBody = z.object({
  name: z.string().trim().min(2).max(48).refine(noDash, "No em dashes, please.").optional(),
  bio: z.string().trim().max(280).refine(noDash, "No em dashes, please.").optional(),
  url: z.union([z.literal(""), z.string().trim().url().max(200).refine((u) => u.startsWith("https://"), "Use an https:// link.")]).optional(),
}).strict();

export async function developerOf(userId: string): Promise<Developer | null> {
  const [d] = await db().select().from(developers).where(eq(developers.userId, userId)).limit(1);
  return d ?? null;
}
export async function requireDeveloper(userId: string): Promise<Developer> {
  const d = await developerOf(userId);
  if (!d) throw new HttpError(403, "Join the developer alpha first.");
  if (d.status !== "active") throw new HttpError(403, "This developer account is suspended.");
  return d;
}

/** Join the alpha with a one-time invite code. */
export async function joinWithInvite(userId: string, b: z.output<typeof joinBody>): Promise<Developer> {
  if (!(await rateLimit(`dev:join:${userId}`, 10, 3_600_000))) throw new HttpError(429, "Too many tries. Wait an hour and try again.");
  if (await developerOf(userId)) throw new HttpError(409, "You're already a developer.");
  const hash = sha256(normCode(b.invite));
  return db().transaction(async (tx) => {
    const [inv] = await tx.select().from(developerInvites).where(eq(developerInvites.codeHash, hash)).for("update").limit(1);
    if (!inv || inv.usedAt) throw new HttpError(400, "That invite code isn't valid or was already used.");
    if (inv.expiresAt.getTime() < Date.now()) throw new HttpError(400, "That invite code expired. Ask for a new one.");
    const [taken] = await tx.select({ id: developers.id }).from(developers).where(eq(developers.handle, b.handle)).limit(1);
    if (taken || b.handle === "lexari") throw new HttpError(409, "That handle is taken. Try another.");
    const [d] = await tx.insert(developers).values({ userId, handle: b.handle, name: b.name, termsAt: new Date() }).returning();
    await tx.update(developerInvites).set({ usedBy: userId, usedAt: new Date() }).where(eq(developerInvites.id, inv.id));
    return d;
  });
}

export async function updateProfile(d: Developer, b: z.output<typeof profileBody>) {
  const [n] = await db().update(developers).set({ ...(b.name !== undefined ? { name: b.name } : {}), ...(b.bio !== undefined ? { bio: b.bio } : {}), ...(b.url !== undefined ? { url: b.url } : {}) }).where(eq(developers.id, d.id)).returning();
  return n;
}

/** Admin: a one-time invite code (shown once). */
export async function createInvite(adminUserId: string, note: string, days = 14) {
  const plain = `LXDEV-${code(4)}-${code(4)}`;
  const [row] = await db().insert(developerInvites).values({ codeHash: sha256(normCode(plain)), note: note.slice(0, 120), createdBy: adminUserId, expiresAt: new Date(Date.now() + days * 86_400_000) }).returning();
  return { code: plain, id: row.id, expiresAt: row.expiresAt.getTime() };
}
export async function listInvites() {
  const rows = await db().select().from(developerInvites).orderBy(desc(developerInvites.createdAt)).limit(100);
  return rows.map((r) => ({ id: r.id, note: r.note, used: !!r.usedAt, usedAt: r.usedAt?.getTime() ?? null, expiresAt: r.expiresAt.getTime(), createdAt: r.createdAt.getTime() }));
}

/* ---------- keys ---------- */
export const keyBody = z.object({
  name: z.string().trim().min(1).max(40).refine(noDash, "No em dashes, please."),
  scopes: z.array(z.enum(KEY_SCOPES)).min(1).max(KEY_SCOPES.length),
}).strict();
export type KeyView = { id: string; name: string; prefix: string; scopes: string[]; createdAt: number; lastUsedAt: number | null; revokedAt: number | null };
const view = (k: typeof developerKeys.$inferSelect): KeyView => ({ id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, createdAt: k.createdAt.getTime(), lastUsedAt: k.lastUsedAt?.getTime() ?? null, revokedAt: k.revokedAt?.getTime() ?? null });

export async function listKeys(developerId: string): Promise<KeyView[]> {
  const rows = await db().select().from(developerKeys).where(eq(developerKeys.developerId, developerId)).orderBy(desc(developerKeys.createdAt)).limit(50);
  return rows.map(view);
}

/** A new key. Returns the whole key once; only its hash is kept. */
export async function createKey(developerId: string, name: string, scopes: KeyScope[], tx = db()): Promise<{ key: string; view: KeyView }> {
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(developerKeys).where(and(eq(developerKeys.developerId, developerId), isNull(developerKeys.revokedAt)));
  if (Number(n) >= MAX_KEYS) throw new HttpError(409, `You have ${MAX_KEYS} active keys. Revoke one first.`);
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const [row] = await tx.insert(developerKeys).values({ developerId, name, prefix: key.slice(0, KEY_PREFIX.length + 4), keyHash: sha256(key), scopes: [...new Set(scopes)] }).returning();
  return { key, view: view(row) };
}

export async function revokeKey(developerId: string, id: string) {
  const [row] = await db().update(developerKeys).set({ revokedAt: new Date() }).where(and(eq(developerKeys.id, id), eq(developerKeys.developerId, developerId), isNull(developerKeys.revokedAt))).returning();
  if (!row) throw new HttpError(404, "There's no such active key.");
  return view(row);
}

/** Authenticates an SDK / CLI request: "Authorization: Bearer lxk_test_...", active key, active developer, the scope. */
export async function authKey(req: Request, scope: KeyScope): Promise<{ developer: Developer; keyId: string }> {
  const m = /^Bearer\s+(lxk_test_[A-Za-z0-9_-]{43})$/.exec(req.headers.get("authorization") || "");
  if (!m) throw new HttpError(401, "Send your developer key as Authorization: Bearer lxk_test_...");
  const hash = sha256(m[1]);
  const [row] = await db().select({ k: developerKeys, d: developers }).from(developerKeys).innerJoin(developers, eq(developers.id, developerKeys.developerId)).where(eq(developerKeys.keyHash, hash)).limit(1);
  if (!row || row.k.revokedAt) throw new HttpError(401, "That developer key isn't valid or was revoked.");
  if (row.d.status !== "active") throw new HttpError(403, "This developer account is suspended.");
  if (!row.k.scopes.includes(scope)) throw new HttpError(403, `That key can't ${scope}. Make one with the ${scope} scope.`);
  if (!(await rateLimit(`devkey:${row.k.id}`, 120, 60_000))) throw new HttpError(429, "Too many requests with this key. Slow down a little.");
  if (!row.k.lastUsedAt || Date.now() - row.k.lastUsedAt.getTime() > 60_000) void db().update(developerKeys).set({ lastUsedAt: new Date() }).where(eq(developerKeys.id, row.k.id)).catch(() => {});
  return { developer: row.d, keyId: row.k.id };
}

/* ---------- device-code login (lexari login) ---------- */
export const DEVICE_TTL_S = 600;
export const DEVICE_INTERVAL_S = 5;

export async function startDevice(label: string, ip: string) {
  if (!(await rateLimit(`dev:device:${ip}`, 20, 3_600_000))) throw new HttpError(429, "Too many login attempts from here. Try again later.");
  const deviceCode = randomBytes(32).toString("base64url");
  const userCode = `${code(4)}-${code(4)}`;
  await db().insert(developerDeviceCodes).values({ deviceHash: sha256(deviceCode), userCode: normCode(userCode), label: label.replace(/[^\w .@-]/g, "").slice(0, 60), expiresAt: new Date(Date.now() + DEVICE_TTL_S * 1000) });
  return { deviceCode, userCode, expiresIn: DEVICE_TTL_S, interval: DEVICE_INTERVAL_S };
}

export async function deviceInfo(userCode: string) {
  const [row] = await db().select().from(developerDeviceCodes).where(and(eq(developerDeviceCodes.userCode, normCode(userCode)), gt(developerDeviceCodes.expiresAt, new Date()))).limit(1);
  if (!row || row.status !== "pending") throw new HttpError(404, "That code isn't valid any more. Run lexari login again.");
  return { label: row.label, expiresAt: row.expiresAt.getTime() };
}

/** You approve (or deny) a CLI login. The key itself is made when the CLI picks it up, and shown only to the CLI. */
export async function decideDevice(developerId: string, userCode: string, approve: boolean) {
  const [row] = await db().update(developerDeviceCodes).set({ status: approve ? "approved" : "denied", developerId })
    .where(and(eq(developerDeviceCodes.userCode, normCode(userCode)), eq(developerDeviceCodes.status, "pending"), gt(developerDeviceCodes.expiresAt, new Date()))).returning();
  if (!row) throw new HttpError(404, "That code isn't valid any more. Run lexari login again.");
  return { ok: true, approved: approve };
}

export type DevicePoll = { status: "pending" | "denied" | "expired" | "slow_down" } | { status: "approved"; key: string; developer: { handle: string; name: string } };
/** The CLI polls with its device code. On approval it gets a new publish + read key, exactly once. */
export async function pollDevice(deviceCode: string): Promise<DevicePoll> {
  const hash = sha256(deviceCode);
  if (!(await rateLimit(`dev:poll:${hash.slice(0, 24)}`, 1, (DEVICE_INTERVAL_S - 1) * 1000))) return { status: "slow_down" };
  return db().transaction(async (tx) => {
    const [row] = await tx.select().from(developerDeviceCodes).where(eq(developerDeviceCodes.deviceHash, hash)).for("update").limit(1);
    if (!row || row.status === "used") return { status: "expired" as const };
    if (row.expiresAt.getTime() < Date.now()) return { status: "expired" as const };
    if (row.status === "denied") return { status: "denied" as const };
    if (row.status !== "approved" || !row.developerId) return { status: "pending" as const };
    const [d] = await tx.select().from(developers).where(eq(developers.id, row.developerId)).limit(1);
    if (!d || d.status !== "active") return { status: "denied" as const };
    const made = await createKey(d.id, `CLI${row.label ? ` on ${row.label}` : ""}`.slice(0, 40), ["publish", "read"], tx as never);
    await tx.update(developerDeviceCodes).set({ status: "used", keyId: made.view.id }).where(eq(developerDeviceCodes.id, row.id));
    return { status: "approved" as const, key: made.key, developer: { handle: d.handle, name: d.name } };
  });
}
