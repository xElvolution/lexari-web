/**
 * SERVER ONLY. Settings > Models: your API keys (one per provider), your model switches, the account default, and which
 * model answers a turn (chat pick, else the agent's, else the account default, else Lamina). Only switched-on models
 * can be picked; switching one off or removing its key sends anything that used it back to the default.
 */
import { and, eq, inArray, like } from "drizzle-orm";
import { KEY_PROVIDERS, LAMINA, MODELS, MODEL_NAME_RE, enabledIds, keyModelId, keyModelInfo, keyProvider, modelById, modelCatalog, parseKeyModel, type KeyInfo, type KeyProvider, type ModelInfo, type ModelPrefs } from "@/content/models";
import { db } from "./db";
import { userModelKeys } from "./db/modelsSchema";
import { agents, chats, users } from "./db/schema";
import { open, seal, secretBoxReady } from "./secretBox";
import { cleanBaseUrl, verifyKey, type ByoTarget } from "./engram/byo";
import { ModelError, modelReady } from "./engram/cortex";
import { HttpError } from "./http";

export const MAX_EXTRA = 24;
type KeyRow = typeof userModelKeys.$inferSelect;
const aad = (userId: string) => `model:${userId}`;

const toInfo = (r: KeyRow): KeyInfo => ({ provider: r.provider as KeyProvider, last4: r.keyLast4, status: r.status as KeyInfo["status"], note: r.statusNote, testedAt: r.testedAt?.getTime() ?? null, baseUrl: r.baseUrl });
const available = () => Object.fromEntries(MODELS.map((m) => [m.id, modelReady(m)]));

export async function listKeys(userId: string) {
  const rows = await db().select().from(userModelKeys).where(eq(userModelKeys.userId, userId));
  return KEY_PROVIDERS.map((p) => rows.find((r) => r.provider === p.id)).filter((r): r is KeyRow => !!r).map(toInfo);
}
export async function getPrefs(userId: string): Promise<ModelPrefs> {
  const [u] = await db().select({ p: users.modelPrefs }).from(users).where(eq(users.id, userId)).limit(1);
  return (u?.p ?? {}) as ModelPrefs;
}
async function catalogFor(userId: string) {
  const [keys, prefs] = await Promise.all([listKeys(userId), getPrefs(userId)]);
  return modelCatalog(keys.map((k) => k.provider), prefs, available());
}

/** Sends agents, chats and the account default that use any of these ids back to the default. */
async function release(userId: string, ids: string[] | { provider: KeyProvider }) {
  const database = db();
  const agentMatch = Array.isArray(ids) ? inArray(agents.model, ids) : like(agents.model, `key:${ids.provider}:%`);
  const chatMatch = Array.isArray(ids) ? inArray(chats.model, ids) : like(chats.model, `key:${ids.provider}:%`);
  const userMatch = Array.isArray(ids) ? inArray(users.defaultModel, ids) : like(users.defaultModel, `key:${ids.provider}:%`);
  if (Array.isArray(ids) && !ids.length) return;
  await database.update(agents).set({ model: null }).where(and(eq(agents.userId, userId), agentMatch));
  await database.update(chats).set({ model: null }).where(and(eq(chats.userId, userId), chatMatch));
  await database.update(users).set({ defaultModel: null }).where(and(eq(users.id, userId), userMatch));
}

/** Saves a key after the provider accepts it (Verify). A rejected key is not stored. */
export async function saveKey(userId: string, provider: KeyProvider, rawKey: string) {
  if (!secretBoxReady()) throw new HttpError(503, "API keys aren't switched on on this server yet.");
  const key = rawKey.trim();
  const [have] = await db().select({ baseUrl: userModelKeys.baseUrl }).from(userModelKeys).where(and(eq(userModelKeys.userId, userId), eq(userModelKeys.provider, provider))).limit(1);
  const res = await verifyKey(provider, key, provider === "openai" ? have?.baseUrl : null);
  if (!res.ok) throw new HttpError(400, res.error);
  const now = new Date();
  const values = { keyEnc: seal(key, aad(userId)), keyLast4: key.slice(-4), status: "ok", statusNote: res.note, testedAt: now, updatedAt: now };
  await db().insert(userModelKeys).values({ userId, provider, ...values }).onConflictDoUpdate({ target: [userModelKeys.userId, userModelKeys.provider], set: values });
  return { note: res.note };
}

async function keyRow(userId: string, provider: KeyProvider) {
  const [r] = await db().select().from(userModelKeys).where(and(eq(userModelKeys.userId, userId), eq(userModelKeys.provider, provider))).limit(1);
  return r ?? null;
}

/** Verify a saved key again. */
export async function recheckKey(userId: string, provider: KeyProvider) {
  const r = await keyRow(userId, provider);
  if (!r) throw new HttpError(404, "Add a key first.");
  const res = await verifyKey(provider, open(r.keyEnc, aad(userId)), r.baseUrl);
  await db().update(userModelKeys).set({ status: res.ok ? "ok" : "failed", statusNote: res.ok ? res.note : res.error, testedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(userModelKeys.userId, userId), eq(userModelKeys.provider, provider)));
  return res;
}

/** OpenAI only: point the OpenAI key at an OpenAI-compatible endpoint (null = api.openai.com). */
export async function setBaseUrl(userId: string, raw: string | null) {
  const r = await keyRow(userId, "openai");
  if (!r) throw new HttpError(400, "Add your OpenAI key first, then override its base URL.");
  let baseUrl: string | null = null;
  if (raw) { try { baseUrl = cleanBaseUrl(raw); } catch (e) { throw new HttpError(400, e instanceof ModelError ? e.friendly : "That base URL doesn't look right."); } }
  if (baseUrl) {
    const res = await verifyKey("openai", open(r.keyEnc, aad(userId)), baseUrl);
    if (!res.ok) throw new HttpError(400, res.error);
  }
  await db().update(userModelKeys).set({ baseUrl, updatedAt: new Date(), ...(baseUrl ? { status: "ok", statusNote: "Using your base URL", testedAt: new Date() } : {}) })
    .where(and(eq(userModelKeys.userId, userId), eq(userModelKeys.provider, "openai")));
}

/** Removes the key. That provider's models leave the list; anything that used them goes back to the default. */
export async function removeKey(userId: string, provider: KeyProvider) {
  await release(userId, { provider });
  await db().delete(userModelKeys).where(and(eq(userModelKeys.userId, userId), eq(userModelKeys.provider, provider)));
}

async function writePrefs(userId: string, p: ModelPrefs) {
  const clean = { on: [...new Set(p.on ?? [])].slice(0, 200), off: [...new Set(p.off ?? [])].slice(0, 200), extra: [...new Set(p.extra ?? [])].slice(0, MAX_EXTRA) };
  await db().update(users).set({ modelPrefs: clean }).where(eq(users.id, userId));
}

/** A model's switch. Lamina stays on. Switching one off sends anything that used it back to the default. */
export async function toggleModel(userId: string, id: string, on: boolean) {
  if (id === LAMINA.id) throw new HttpError(400, "Lamina is always on.");
  const rows = await catalogFor(userId);
  if (!rows.some((r) => r.m.id === id)) throw new HttpError(404, "That model isn't in your list.");
  const p = await getPrefs(userId);
  const next: ModelPrefs = { ...p, on: (p.on ?? []).filter((x) => x !== id), off: (p.off ?? []).filter((x) => x !== id) };
  (on ? next.on! : next.off!).push(id);
  await writePrefs(userId, next);
  if (!on) await release(userId, [id]);
}

/** Adds a model by its provider id (from the search field). Needs that provider's key. */
export async function addModel(userId: string, provider: KeyProvider, model: string) {
  const name = model.trim();
  if (!MODEL_NAME_RE.test(name)) throw new HttpError(400, "Model ids use letters, numbers and . : / @ + - _");
  if (!(await keyRow(userId, provider))) throw new HttpError(400, `Add your ${keyProvider(provider)!.name} key first.`);
  const id = keyModelId(provider, name);
  const p = await getPrefs(userId);
  if ((p.extra ?? []).length >= MAX_EXTRA && !(p.extra ?? []).includes(id)) throw new HttpError(400, `You can add up to ${MAX_EXTRA} models.`);
  await writePrefs(userId, { ...p, extra: [...(p.extra ?? []).filter((x) => x !== id), id], off: (p.off ?? []).filter((x) => x !== id) });
  return id;
}
/** Removes a model you added by name. */
export async function dropModel(userId: string, id: string) {
  const p = await getPrefs(userId);
  await writePrefs(userId, { on: (p.on ?? []).filter((x) => x !== id), off: (p.off ?? []).filter((x) => x !== id), extra: (p.extra ?? []).filter((x) => x !== id) });
  await release(userId, [id]);
}

/** A model id someone may pick: switched on in their list. */
export async function pickable(userId: string, id: string) {
  return enabledIds(await catalogFor(userId)).has(id);
}

export async function accountDefault(userId: string) {
  const [u] = await db().select({ m: users.defaultModel }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.m ?? null;
}
export async function setAccountDefault(userId: string, id: string) {
  if (!(await pickable(userId, id))) throw new HttpError(400, "Switch that model on in Settings > Models first.");
  await db().update(users).set({ defaultModel: id === LAMINA.id ? null : id }).where(eq(users.id, userId));
}

/** The provider target for a model on your key, with the key decrypted (server memory only, for this turn). */
async function targetFor(userId: string, id: string): Promise<ByoTarget | null> {
  const k = parseKeyModel(id);
  if (!k) return null;
  const r = await keyRow(userId, k.provider);
  if (!r) return null;
  const p = keyProvider(k.provider)!;
  const key = open(r.keyEnc, aad(userId));
  if (k.provider === "openai" && r.baseUrl) return { provider: "custom", model: k.model, key, baseUrl: r.baseUrl, label: keyModelInfo(id)!.label, who: "Your OpenAI base URL" };
  return { provider: k.provider, model: k.model, key, label: keyModelInfo(id)!.label, who: p.name };
}

/**
 * The model for one turn. ids are tried in order (chat, agent, account default); an id that's switched off or whose key
 * is gone is skipped. A model on your key comes back with its provider target.
 */
export async function resolveTurnModel(userId: string, ids: (string | null | undefined)[]): Promise<{ model: ModelInfo; byo: ByoTarget | null }> {
  let enabled: Set<string> | null = null;
  for (const id of ids) {
    if (!id) continue;
    enabled ??= enabledIds(await catalogFor(userId).catch(() => []));
    if (!enabled.has(id)) continue;
    const m = modelById(id);
    if (m) return { model: m, byo: null };
    try {
      const t = await targetFor(userId, id);
      if (t) return { model: keyModelInfo(id)!, byo: t };
    } catch (e) { console.error(`[byo] key open failed: ${(e as Error).message}`); }
  }
  return { model: LAMINA, byo: null };
}


/** Your own key that can make pictures (Settings > Models), in this order; null when you have none that works. */
export async function imageKeyFor(userId: string): Promise<{ provider: "xai" | "openai" | "gemini" | "openrouter"; key: string; own: true } | null> {
  if (!secretBoxReady()) return null;
  const rows = await db().select().from(userModelKeys).where(eq(userModelKeys.userId, userId));
  for (const p of ["xai", "openai", "gemini", "openrouter"] as const) {
    const r = rows.find((x) => x.provider === p && x.status === "ok" && (p !== "openai" || !x.baseUrl));
    if (r) { try { return { provider: p, key: open(r.keyEnc, aad(userId)), own: true }; } catch { /* unreadable: try the next */ } }
  }
  return null;
}
