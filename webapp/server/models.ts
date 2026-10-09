/**
 * SERVER ONLY. Settings > Models: the models you added with your own API key, the account default model, and which
 * model answers a turn (chat pick, else the agent's, else the account default, else Lamina).
 */
import { and, asc, eq } from "drizzle-orm";
import { LAMINA, customInfo, isByoId, modelById, type ByoProvider, type CustomModel, type ModelInfo } from "@/content/models";
import { db } from "./db";
import { userModels } from "./db/modelsSchema";
import { agents, chats, users } from "./db/schema";
import { open, seal, secretBoxReady } from "./secretBox";
import { cleanBaseUrl, testByo, type ByoTarget } from "./engram/byo";
import { ModelError } from "./engram/cortex";
import { HttpError } from "./http";

export const MAX_CUSTOM = 12;
type Row = typeof userModels.$inferSelect;
const uuidOf = (id: string) => id.replace(/^byo:/, "");

export function toCustom(r: Row): CustomModel {
  return { id: `byo:${r.id}`, provider: r.provider as ByoProvider, label: r.label, model: r.model, baseUrl: r.baseUrl, last4: r.keyLast4, status: r.status as CustomModel["status"], note: r.statusNote, testedAt: r.testedAt?.getTime() ?? null };
}

export async function listCustom(userId: string) {
  const rows = await db().select().from(userModels).where(eq(userModels.userId, userId)).orderBy(asc(userModels.createdAt));
  return rows.map(toCustom);
}

const target = (r: Row, userId: string): ByoTarget => ({ provider: r.provider as ByoProvider, model: r.model, key: open(r.keyEnc, `model:${userId}`), baseUrl: r.baseUrl, label: r.label || r.model });

export async function addCustom(userId: string, input: { provider: ByoProvider; model: string; key: string; label?: string; baseUrl?: string | null }) {
  if (!secretBoxReady()) throw new HttpError(503, "Adding your own models isn't switched on on this server yet.");
  const existing = await listCustom(userId);
  if (existing.length >= MAX_CUSTOM) throw new HttpError(400, `You can add up to ${MAX_CUSTOM} models.`);
  let baseUrl: string | null = null;
  if (input.provider === "custom") {
    if (!input.baseUrl) throw new HttpError(400, "Add the base URL of your OpenAI-compatible API.");
    try { baseUrl = cleanBaseUrl(input.baseUrl); } catch (e) { throw new HttpError(400, e instanceof ModelError ? e.friendly : "That base URL doesn't look right."); }
  }
  const key = input.key.trim();
  const [row] = await db().insert(userModels).values({
    userId, provider: input.provider, model: input.model.trim(), label: (input.label || "").trim() || input.model.trim(), baseUrl,
    keyEnc: seal(key, `model:${userId}`), keyLast4: key.slice(-4),
  }).returning();
  return toCustom(row);
}

async function rowFor(userId: string, id: string) {
  if (!isByoId(id)) return null;
  const [r] = await db().select().from(userModels).where(and(eq(userModels.userId, userId), eq(userModels.id, uuidOf(id)))).limit(1);
  return r ?? null;
}

export async function testCustom(userId: string, id: string) {
  const r = await rowFor(userId, id);
  if (!r) throw new HttpError(404, "That model isn't in your list.");
  const res = await testByo(target(r, userId));
  const [u] = await db().update(userModels).set({ status: res.ok ? "ok" : "failed", statusNote: res.ok ? `Answered in ${(res.ms / 1000).toFixed(1)}s` : res.error, testedAt: new Date(), updatedAt: new Date() })
    .where(eq(userModels.id, r.id)).returning();
  return { model: toCustom(u), result: res };
}

/** Removes a model. Agents, chats and the account default that used it fall back to Lamina. */
export async function removeCustom(userId: string, id: string) {
  const r = await rowFor(userId, id);
  if (!r) throw new HttpError(404, "That model isn't in your list.");
  const database = db();
  await database.transaction(async (tx) => {
    await tx.update(agents).set({ model: null }).where(and(eq(agents.userId, userId), eq(agents.model, id)));
    await tx.update(chats).set({ model: null }).where(and(eq(chats.userId, userId), eq(chats.model, id)));
    await tx.update(users).set({ defaultModel: null }).where(and(eq(users.id, userId), eq(users.defaultModel, id)));
    await tx.delete(userModels).where(eq(userModels.id, r.id));
  });
}

/** A model id someone may pick: a built-in, or one of their own. */
export async function pickable(userId: string, id: string) {
  if (modelById(id)) return true;
  return !!(await rowFor(userId, id));
}

export async function accountDefault(userId: string) {
  const [u] = await db().select({ m: users.defaultModel }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.m ?? null;
}
export async function setAccountDefault(userId: string, id: string) {
  if (!(await pickable(userId, id))) throw new HttpError(400, "Pick a model from the list.");
  await db().update(users).set({ defaultModel: id === LAMINA.id ? null : id }).where(eq(users.id, userId));
}

/**
 * The model for one turn. ids are tried in order (chat, agent, account default); an id that no longer exists is skipped.
 * A model on your own key comes back with its decrypted target (server memory only, for this turn).
 */
export async function resolveTurnModel(userId: string, ids: (string | null | undefined)[]): Promise<{ model: ModelInfo; byo: ByoTarget | null }> {
  for (const id of ids) {
    if (!id) continue;
    const m = modelById(id);
    if (m) return { model: m, byo: null };
    const r = await rowFor(userId, id).catch(() => null);
    if (r) {
      try { return { model: customInfo(toCustom(r)), byo: target(r, userId) }; } catch (e) { console.error(`[byo] key open failed: ${(e as Error).message}`); }
    }
  }
  return { model: LAMINA, byo: null };
}
