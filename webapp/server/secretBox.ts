/**
 * SERVER ONLY. Encrypts secrets people give Lexari (their own model API keys) at rest with AES-256-GCM.
 * Env: MODEL_KEYS_SECRET, 32 random bytes as base64 (or hex). Stored as "v1.<iv>.<tag>.<ciphertext>" (base64url).
 * The user id is bound in as associated data, so a ciphertext copied to another account does not decrypt.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer | null {
  const raw = (process.env.MODEL_KEYS_SECRET || "").trim();
  if (!raw) return null;
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return buf.length === 32 ? buf : null;
}
export const secretBoxReady = () => !!key();

export function seal(plain: string, aad: string): string {
  const k = key();
  if (!k) throw new Error("MODEL_KEYS_SECRET is not set");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function open(sealed: string, aad: string): string {
  const k = key();
  if (!k) throw new Error("MODEL_KEYS_SECRET is not set");
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("bad sealed value");
  const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
