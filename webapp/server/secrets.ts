/**
 * SERVER ONLY. The secrets vault: API keys, tokens and passwords a person saves through the secure card in chat or
 * Settings > Secrets. Values are sealed with AES-256-GCM (server/secretBox.ts, MODEL_KEYS_SECRET) and bound to the
 * user and row, never logged, never returned to the browser, and never put in a model prompt or chat history.
 *
 * Agents only ever see NAMES. A value is used two ways, both server-side:
 *  - injected as an environment variable into the agent's container command at exec time (secretEnv), and the
 *    command's output is scrubbed of every saved value before it reaches the model, the chat or the terminal;
 *  - read by integration code for a server-side call (secretValue).
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { messages, chats } from "./db/schema";
import { secretRequests, userSecrets } from "./db/secretsSchema";
import { open, seal, secretBoxReady } from "./secretBox";
import { HttpError } from "./http";
import { SECRET_NAME_RE, redactPatterns, toSecretName } from "@/lib/secretScan";
import type { SecretCard, SecretInfo } from "@/content/secrets";

export const MAX_SECRETS = 50;
const aad = (userId: string, id: string) => `secret:${userId}:${id}`;
type Row = typeof userSecrets.$inferSelect;
const info = (r: Row): SecretInfo => ({ id: r.id, name: r.name, label: r.label, service: r.service, last4: r.last4, agents: r.agents || [], createdAt: r.createdAt.getTime(), updatedAt: r.updatedAt.getTime(), lastUsedAt: r.lastUsedAt?.getTime() ?? null });
/** Only long values show their last 4 characters (a short password would give too much away). */
const last4Of = (v: string) => (v.length >= 16 ? v.slice(-4) : "");
const allowed = (r: Pick<Row, "agents">, agent: string) => !r.agents?.length || r.agents.includes(agent);

export async function listSecrets(userId: string): Promise<SecretInfo[]> {
  const rows = await db().select().from(userSecrets).where(eq(userSecrets.userId, userId)).orderBy(desc(userSecrets.createdAt));
  return rows.map(info);
}

/** Names (and what they're for) an agent may use, for its prompt. Never values. */
export async function secretNames(userId: string, agent: string) {
  const rows = await db().select({ name: userSecrets.name, service: userSecrets.service, label: userSecrets.label, agents: userSecrets.agents }).from(userSecrets).where(eq(userSecrets.userId, userId));
  return rows.filter((r) => allowed(r, agent)).map((r) => ({ name: r.name, service: r.service, label: r.label }));
}

export type SaveInput = { name: string; value: string; label?: string; service?: string; agents?: string[] };
/** Saves (or replaces) one secret. Returns its summary; the value never comes back. */
export async function saveSecret(userId: string, input: SaveInput): Promise<SecretInfo> {
  if (!secretBoxReady()) throw new HttpError(503, "The secure vault isn't set up on this server yet.");
  const name = toSecretName(input.name);
  if (!SECRET_NAME_RE.test(name)) throw new HttpError(400, "Give it a name like CLOUDFLARE_API_TOKEN (letters, numbers and _).");
  const value = input.value.replace(/^\s+|\s+$/g, "");
  if (!value) throw new HttpError(400, "Paste the value first.");
  const database = db();
  const [have] = await database.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.name, name))).limit(1);
  const now = new Date();
  if (have) {
    const [r] = await database.update(userSecrets).set({
      valueEnc: seal(value, aad(userId, have.id)), last4: last4Of(value), updatedAt: now,
      ...(input.label !== undefined ? { label: input.label.slice(0, 80) } : {}), ...(input.service !== undefined ? { service: input.service.slice(0, 40) } : {}),
      ...(input.agents ? { agents: input.agents.slice(0, 40) } : {}),
    }).where(eq(userSecrets.id, have.id)).returning();
    return info(r);
  }
  const [{ n }] = await database.select({ n: sql<number>`count(*)::int` }).from(userSecrets).where(eq(userSecrets.userId, userId));
  if (n >= MAX_SECRETS) throw new HttpError(400, `You can keep up to ${MAX_SECRETS} secrets. Delete one first.`);
  const id = randomUUID();
  const [r] = await database.insert(userSecrets).values({
    id, userId, name, label: (input.label || "").slice(0, 80), service: (input.service || "").slice(0, 40),
    valueEnc: seal(value, aad(userId, id)), last4: last4Of(value), agents: (input.agents || []).slice(0, 40), createdAt: now, updatedAt: now,
  }).returning();
  return info(r);
}

export async function setSecretAgents(userId: string, id: string, agents: string[]) {
  const [r] = await db().update(userSecrets).set({ agents: agents.slice(0, 40), updatedAt: new Date() }).where(and(eq(userSecrets.id, id), eq(userSecrets.userId, userId))).returning();
  if (!r) throw new HttpError(404, "That secret is gone.");
  return info(r);
}
export async function replaceSecret(userId: string, id: string, value: string) {
  const [r] = await db().select().from(userSecrets).where(and(eq(userSecrets.id, id), eq(userSecrets.userId, userId))).limit(1);
  if (!r) throw new HttpError(404, "That secret is gone.");
  return saveSecret(userId, { name: r.name, value });
}
export async function deleteSecret(userId: string, id: string) {
  const r = await db().delete(userSecrets).where(and(eq(userSecrets.id, id), eq(userSecrets.userId, userId))).returning({ id: userSecrets.id });
  if (!r.length) throw new HttpError(404, "That secret is gone.");
}

const decrypt = (userId: string, r: Pick<Row, "id" | "valueEnc">) => { try { return open(r.valueEnc, aad(userId, r.id)); } catch { return null; } };

/** For server-side integration calls: one secret's value if this agent may use it, else null. Never log the result. */
export async function secretValue(userId: string, name: string, agent: string): Promise<string | null> {
  const [r] = await db().select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.name, name))).limit(1);
  if (!r || !allowed(r, agent)) return null;
  const v = decrypt(userId, r);
  if (v) await db().update(userSecrets).set({ lastUsedAt: new Date() }).where(eq(userSecrets.id, r.id)).catch(() => {});
  return v;
}

/** Names a command refers to as $NAME or ${NAME}. */
export const referencedNames = (cmd: string) => [...new Set([...cmd.matchAll(/\$\{?([A-Z][A-Z0-9_]{1,63})\}?/g)].map((m) => m[1]))];

/**
 * What one container command gets: the secrets it references (that this agent may use) as env vars, plus every value
 * this person has saved (for scrubbing output). Values stay in memory only for the call.
 */
export async function secretEnv(userId: string, agent: string, cmd: string): Promise<{ env: Record<string, string>; scrub: Scrubber }> {
  const rows = await db().select().from(userSecrets).where(eq(userSecrets.userId, userId));
  if (!rows.length) return { env: {}, scrub: scrubber([]) };
  const want = new Set(referencedNames(cmd));
  const env: Record<string, string> = {};
  const known: { name: string; value: string }[] = [];
  const used: string[] = [];
  for (const r of rows) {
    const v = decrypt(userId, r);
    if (!v) continue;
    known.push({ name: r.name, value: v });
    if (want.has(r.name) && allowed(r, agent)) { env[r.name] = v; used.push(r.id); }
  }
  if (used.length) await db().update(userSecrets).set({ lastUsedAt: new Date() }).where(and(eq(userSecrets.userId, userId), inArray(userSecrets.id, used))).catch(() => {});
  return { env, scrub: scrubber(known) };
}

export type Scrubber = (text: string) => string;
/**
 * Replaces every saved value (and its base64 / URL-encoded forms) with [secret:NAME], then anything else that looks
 * like a key, recovery phrase or private key. Used on command output and tool results before a model or the chat sees them.
 */
export function scrubber(known: { name: string; value: string }[]): Scrubber {
  const forms: [string, string][] = [];
  for (const k of known) {
    if (k.value.length < 4) continue;
    const tag = `[secret:${k.name}]`;
    forms.push([k.value, tag]);
    const b64 = Buffer.from(k.value).toString("base64").replace(/=+$/, "");
    if (b64.length >= 8) forms.push([b64, tag]);
    const url = encodeURIComponent(k.value);
    if (url !== k.value) forms.push([url, tag]);
  }
  forms.sort((a, b) => b[0].length - a[0].length);
  return (text: string) => {
    let out = text;
    for (const [v, tag] of forms) if (out.includes(v)) out = out.split(v).join(tag);
    return redactPatterns(out);
  };
}

/* ---------- the secure card in chat ---------- */

/** <secret name="CLOUDFLARE_API_TOKEN" service="Cloudflare" label="Cloudflare API token">why</secret> in an agent's reply. */
export function secretRequestTag(text: string): { name: string; label: string; service: string; why: string } | null {
  const m = /<secret\b([^>]*?)(?:\/>|>([\s\S]*?)<\/secret>)/i.exec(text);
  if (!m) return null;
  const attr = (k: string) => new RegExp(`${k}\\s*=\\s*"([^"]*)"|${k}\\s*=\\s*'([^']*)'`, "i").exec(m[1]);
  const pick = (k: string) => { const a = attr(k); return (a?.[1] ?? a?.[2] ?? "").trim(); };
  const name = toSecretName(pick("name"));
  if (!SECRET_NAME_RE.test(name)) return null;
  return { name, label: pick("label").slice(0, 80) || name, service: pick("service").slice(0, 40), why: (m[2] || pick("why")).replace(/\s+/g, " ").trim().slice(0, 200) };
}
export const hasSecretTag = (t: string) => /<secret\b/i.test(t);
export const stripSecretTags = (t: string) => t.replace(/<secret\b[^>]*?\/>/gi, "").replace(/<secret\b[\s\S]*?(<\/secret>|$)/gi, "").trim();

export async function createSecretRequest(userId: string, ctx: { agent: string; convo: string; messageId: string }, req: { name: string; label: string; service: string; why: string }): Promise<SecretCard> {
  const [r] = await db().insert(secretRequests).values({ userId, agent: ctx.agent, convo: ctx.convo, messageId: ctx.messageId, ...req }).returning();
  return { id: r.id, name: r.name, label: r.label, service: r.service, why: r.why, agent: r.agent, status: "pending" };
}

/** Marks a request saved or cancelled and updates the card stored with the chat message. */
export async function finishSecretRequest(userId: string, id: string, status: "saved" | "cancelled", name?: string): Promise<SecretCard> {
  const database = db();
  const [r] = await database.select().from(secretRequests).where(and(eq(secretRequests.id, id), eq(secretRequests.userId, userId))).limit(1);
  if (!r) throw new HttpError(404, "That request is gone.");
  if (r.status !== "pending" && r.status !== status) throw new HttpError(409, r.status === "saved" ? "Already saved." : "This request was cancelled.");
  const finalName = name || r.name;
  await database.update(secretRequests).set({ status, name: finalName, doneAt: new Date() }).where(eq(secretRequests.id, id));
  const card: SecretCard = { id: r.id, name: finalName, label: r.label, service: r.service, why: r.why, agent: r.agent, status };
  const [chat] = await database.select({ id: chats.id }).from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, r.convo))).limit(1);
  if (chat) await database.update(messages).set({ metaJson: sql`coalesce(${messages.metaJson}, '{}'::jsonb) || ${JSON.stringify({ secret: card })}::jsonb` })
    .where(and(eq(messages.chatId, chat.id), eq(messages.clientId, r.messageId))).catch(() => {});
  return card;
}
export async function pendingRequest(userId: string, id: string) {
  const [r] = await db().select().from(secretRequests).where(and(eq(secretRequests.id, id), eq(secretRequests.userId, userId))).limit(1);
  return r || null;
}

/** The prompt block every chat turn gets: how to ask for credentials, and the names this agent may use. */
export function secretsHint(names: { name: string; service: string }[], desktop: boolean) {
  const list = names.length ? names.map((n) => `${n.name}${n.service ? ` (${n.service})` : ""}`).join(", ") : "none yet";
  return [
    "Credentials and privacy: NEVER ask the person to type or paste an API key, token, password, recovery phrase or private key into the chat, and never repeat or reveal one.",
    "When you need a credential for a service, write <secret name=\"CLOUDFLARE_API_TOKEN\" service=\"Cloudflare\" label=\"Cloudflare API token\">one short sentence on why you need it</secret> (name in UPPER_SNAKE_CASE, at most one per reply) plus a short sentence asking them to fill in the secure card. Lexari shows a secure card; the value goes into their encrypted vault and you never see it. You'll then be told it was saved as NAME.",
    `Saved credentials you may use: ${list}. Don't ask again for one that's already saved.`,
    desktop ? "Use a saved credential only inside a <run> command as an environment variable, for example <run>curl -s -H \"Authorization: Bearer $CLOUDFLARE_API_TOKEN\" https://api.cloudflare.com/client/v4/user/tokens/verify</run>. Lexari injects it when the command runs. Never echo, print, log or write a credential to a file, and never send it anywhere but the service it is for; any value that shows up in output is blocked out as [secret:NAME]." : "",
    "Never ask for a wallet recovery phrase or private key for any reason; if the person offers one, tell them to keep it private.",
    desktop ? "If a website on your computer needs the person to sign in (or solve a CAPTCHA or enter a 2FA code), don't ask for their password: write <takeover>Sign in to the site name</takeover> and Lexari asks them to take over your desktop and sign in themselves." : "",
  ].filter(Boolean).join(" ");
}

/** <takeover>reason</takeover>: the agent asks the person to take over its desktop (to sign in themselves). */
export function takeoverTag(text: string) {
  const m = /<takeover>([\s\S]*?)<\/takeover>/i.exec(text);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 140) || "Sign in on my computer" : null;
}
export const stripTakeover = (t: string) => t.replace(/<takeover>[\s\S]*?(<\/takeover>|$)/gi, "").trim();
