"use client";

/**
 * Memory encryption. The key comes from one wallet signature over a fixed message
 * (ed25519 signatures are deterministic, so the same wallet gets the same key on any device).
 * The server only ever sees ciphertext and an HMAC of the text (for de-duplication).
 * Keys are kept as non-extractable CryptoKeys in IndexedDB, per wallet.
 */
const KEY_MESSAGE = "Lexari memory key v1";
const DB = "lexari-vault";
type Keys = { enc: CryptoKey; mac: CryptoKey };
const cache = new Map<string, Keys>();

const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (b: Uint8Array) => { let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    let open: IDBOpenDBRequest;
    try { open = indexedDB.open(DB, 1); } catch { resolve(undefined); return; }
    open.onupgradeneeded = () => open.result.createObjectStore("keys");
    open.onerror = () => resolve(undefined);
    open.onsuccess = () => {
      try {
        const tx = open.result.transaction("keys", mode);
        const req = run(tx.objectStore("keys"));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch { resolve(undefined); }
    };
  });
}

async function derive(signature: Uint8Array): Promise<Keys> {
  const base = await crypto.subtle.importKey("raw", signature as BufferSource, "HKDF", false, ["deriveKey"]);
  const salt = enc.encode("lexari");
  const encKey = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode("memory-enc") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const macKey = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode("memory-mac") }, base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  return { enc: encKey, mac: macKey };
}

/** Keys already on this device, without asking the wallet. */
export async function savedKeys(wallet: string): Promise<Keys | null> {
  if (cache.has(wallet)) return cache.get(wallet)!;
  const got = await idb<Keys>("readonly", (s) => s.get(wallet) as IDBRequest<Keys>);
  if (got?.enc && got?.mac) { cache.set(wallet, got); return got; }
  return null;
}

/** Keys for this wallet; asks for the one signature the first time on a device. */
export async function unlock(wallet: string, signMessage: (m: Uint8Array) => Promise<Uint8Array>): Promise<Keys> {
  const have = await savedKeys(wallet);
  if (have) return have;
  const keys = await derive(await signMessage(enc.encode(KEY_MESSAGE)));
  cache.set(wallet, keys);
  await idb("readwrite", (s) => s.put(keys, wallet));
  return keys;
}

export async function forgetKeys(wallet: string) {
  cache.delete(wallet);
  await idb("readwrite", (s) => s.delete(wallet));
}

export async function sealNote(keys: Keys, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keys.enc, enc.encode(text)));
  const contentHash = hex(await crypto.subtle.sign("HMAC", keys.mac, enc.encode(text.trim().toLowerCase())));
  return { ciphertext: toB64(ct), iv: toB64(iv), contentHash };
}

export async function openNote(keys: Keys, ciphertext: string, iv: string) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) as BufferSource }, keys.enc, fromB64(ciphertext) as BufferSource);
  return dec.decode(pt);
}

export const hexToBytes = (h: string) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
