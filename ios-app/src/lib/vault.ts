/** The memory key on this phone (OS keystore), per wallet. See vaultCore.ts for the crypto, shared with the web. */
import * as Store from "./storage";
import { deriveKeys, fromB64, packKeys, unpackKeys, type Keys } from "./vaultCore";

export { KEY_MESSAGE, sealNote, openNote } from "./vaultCore";
const slot = (wallet: string) => `lexari.vault.${wallet.replace(/[^A-Za-z0-9]/g, "")}`;
const cache = new Map<string, Keys>();

/** Keys already on this device, without asking the wallet. */
export async function savedKeys(wallet?: string): Promise<Keys | null> {
  if (!wallet) return null;
  if (cache.has(wallet)) return cache.get(wallet)!;
  const raw = await Store.getItem(slot(wallet));
  const k = raw ? unpackKeys(raw) : null;
  if (k) cache.set(wallet, k);
  return k;
}

/** Keep the keys from a base64 signature over KEY_MESSAGE (taken at sign-in, so there is no extra prompt later). */
export async function rememberKeys(wallet: string, signatureB64: string): Promise<Keys | null> {
  const sig = fromB64(signatureB64);
  if (sig.length !== 64) return null;
  const k = deriveKeys(sig);
  cache.set(wallet, k);
  await Store.setItem(slot(wallet), packKeys(k));
  return k;
}

export async function forgetKeys(wallet: string) { cache.delete(wallet); await Store.deleteItem(slot(wallet)); }
