/**
 * Webhook signatures. Lexari signs every call to a developer's tool with that listing's webhook secret:
 *
 *   x-lexari-signature: t=<unix ms>,n=<nonce>,v1=<hex HMAC-SHA256(secret, "<t>.<n>.<raw body>")>
 *
 * A receiver accepts a call only when the HMAC matches (constant time), t is within 5 minutes, and the nonce
 * has not been seen in that window. Node only (uses node:crypto).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-lexari-signature";
export const TOLERANCE_MS = 5 * 60_000;

export function sign(secret: string, body: string, now = Date.now(), nonce = randomBytes(12).toString("hex")): string {
  const mac = createHmac("sha256", secret).update(`${now}.${nonce}.${body}`).digest("hex");
  return `t=${now},n=${nonce},v1=${mac}`;
}

export type NonceStore = { seen(nonce: string, ttlMs: number): boolean | Promise<boolean> };
/** In-memory nonce store for one process. Use a shared store (Redis, a database) when you run more than one. */
export function memoryNonceStore(max = 50_000): NonceStore {
  const map = new Map<string, number>();
  return {
    seen(nonce, ttlMs) {
      const now = Date.now();
      if (map.size > max) for (const [k, exp] of map) { if (exp < now) map.delete(k); if (map.size <= max / 2) break; }
      const exp = map.get(nonce);
      if (exp && exp > now) return true;
      map.set(nonce, now + ttlMs);
      return false;
    },
  };
}

export type VerifyResult = { ok: true; nonce: string; t: number } | { ok: false; reason: "missing" | "malformed" | "stale" | "bad_signature" | "replay" };

export async function verify(secret: string, body: string, header: string | null | undefined, opts: { now?: number; nonces?: NonceStore; toleranceMs?: number } = {}): Promise<VerifyResult> {
  if (!header) return { ok: false, reason: "missing" };
  const parts = Object.fromEntries(header.split(",").map((p) => { const i = p.indexOf("="); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }));
  const t = Number(parts.t), n = parts.n, v1 = parts.v1;
  if (!Number.isFinite(t) || !n || !/^[a-f0-9]{8,64}$/.test(n) || !v1 || !/^[a-f0-9]{64}$/.test(v1)) return { ok: false, reason: "malformed" };
  const tol = opts.toleranceMs ?? TOLERANCE_MS;
  if (Math.abs((opts.now ?? Date.now()) - t) > tol) return { ok: false, reason: "stale" };
  const want = createHmac("sha256", secret).update(`${t}.${n}.${body}`).digest();
  const got = Buffer.from(v1, "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, reason: "bad_signature" };
  if (opts.nonces && (await opts.nonces.seen(n, tol * 2))) return { ok: false, reason: "replay" };
  return { ok: true, nonce: n, t };
}
