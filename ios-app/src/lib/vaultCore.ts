/**
 * Memory encryption, byte for byte the same as webapp/lib/vault.ts: the key comes from one wallet signature over a
 * fixed message (ed25519 is deterministic, so web and phone get the same key). HKDF-SHA256 (salt "lexari") gives an
 * AES-256-GCM key ("memory-enc") and an HMAC-SHA256 key ("memory-mac"). The server only sees ciphertext and the HMAC.
 */
import { hkdf } from "@noble/hashes/hkdf";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import { gcm } from "@noble/ciphers/aes";

export const KEY_MESSAGE = "Lexari memory key v1";
export type Keys = { enc: Uint8Array; mac: Uint8Array };

const te = new TextEncoder();
const td = new TextDecoder();
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function toB64(b: Uint8Array): string {
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < b.length ? B64[n & 63] : "=");
  }
  return out;
}
export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2] ?? "A") & 63) << 6) | (B64.indexOf(clean[i + 3] ?? "A") & 63);
    out.push((n >> 16) & 255);
    if (clean[i + 2] !== undefined) out.push((n >> 8) & 255);
    if (clean[i + 3] !== undefined) out.push(n & 255);
  }
  return Uint8Array.from(out);
}
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const fromHex = (h: string) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));

export function deriveKeys(signature: Uint8Array): Keys {
  const salt = te.encode("lexari");
  return { enc: hkdf(sha256, signature, salt, te.encode("memory-enc"), 32), mac: hkdf(sha256, signature, salt, te.encode("memory-mac"), 32) };
}

export function sealNote(keys: Keys, text: string, iv: Uint8Array = globalThis.crypto.getRandomValues(new Uint8Array(12))) {
  const ct = gcm(keys.enc, iv).encrypt(te.encode(text));
  const contentHash = hex(hmac(sha256, keys.mac, te.encode(text.trim().toLowerCase())));
  return { ciphertext: toB64(ct), iv: toB64(iv), contentHash };
}

export function openNote(keys: Keys, ciphertext: string, iv: string): string {
  return td.decode(gcm(keys.enc, fromB64(iv)).decrypt(fromB64(ciphertext)));
}

export const packKeys = (k: Keys) => hex(k.enc) + ":" + hex(k.mac);
export const unpackKeys = (s: string): Keys | null => { const [e, m] = s.split(":"); return e?.length === 64 && m?.length === 64 ? { enc: fromHex(e), mac: fromHex(m) } : null; };
