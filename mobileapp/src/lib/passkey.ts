/**
 * Native passkeys (Mera, same as webapp/lib/mera.ts): Android Credential Manager through react-native-passkey, with the
 * WebAuthn PRF extension. The passkey's PRF output is the root; from it the same HKDF steps as the web derive the Solana
 * sign-in key and one EVM key per agent, so a passkey made here works on app.lexari.ai and the other way round.
 * Nothing secret leaves the phone or is stored; this only calls the existing /api/mera/keys endpoint.
 */
import "react-native-get-random-values";
import { Buffer } from "buffer";
import { Platform } from "react-native";
import { Passkey } from "react-native-passkey";
import { createEd25519SigningSession, createPasskeyWithPrfOutput, createSecp256k1SigningSession, getEvmAddress, getPasskeyPrfOutput, getSolanaAddress } from "@category-labs/mera";
import { reactNativeWebAuthnClient } from "@category-labs/mera/react-native-webauthn-client";
import { toViemAccount } from "@category-labs/mera/viem";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { api } from "./api";
import * as Store from "./storage";

/** The relying party is the web app's domain, so the passkey is shared with app.lexari.ai (Digital Asset Links). */
export const RP_ID = "app.lexari.ai";
const CRED = "lexari.mera.cred";
const salt = new TextEncoder().encode("lexari.mera.v1");
const derive = (prf: Uint8Array, info: string) => hkdf(sha256, prf, salt, new TextEncoder().encode(info), 32);
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

export function passkeySupported() {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return false;
  try { return Passkey.isSupported(); } catch { return false; }
}

async function passkeyRoot(create: boolean, name: string) {
  if (create) {
    const r = await createPasskeyWithPrfOutput({ rp: { id: RP_ID, name: "Lexari" }, user: { name, displayName: name }, webAuthnClient: reactNativeWebAuthnClient });
    await Store.setItem(CRED, JSON.stringify({ credentialId: r.credentialId, transports: r.transports }));
    return { prf: r.prfOutput, credentialId: r.credentialId };
  }
  const stored = await Store.getItem(CRED);
  const r = await getPasskeyPrfOutput({ rpId: RP_ID, credential: stored ? JSON.parse(stored) : undefined, webAuthnClient: reactNativeWebAuthnClient });
  await Store.setItem(CRED, JSON.stringify({ credentialId: r.credentialId }));
  return { prf: r.prfOutput, credentialId: r.credentialId };
}

/** What a failed ceremony means, in plain words. */
export function passkeyError(e: unknown) {
  const code = (e as { code?: string })?.code;
  const cause = String((e as { cause?: { message?: string; error?: string } })?.cause?.message ?? (e as { cause?: { error?: string } })?.cause?.error ?? "");
  const msg = String((e as Error)?.message ?? "");
  if (/cancel/i.test(cause + msg)) return "The passkey was cancelled.";
  if (code === "PRF_UNAVAILABLE") return "This phone's passkey provider can't make Lexari keys yet. Update Google Play services, or use Google Password Manager.";
  if (/NoCredential|no credential|not found/i.test(cause + msg)) return "No Lexari passkey on this phone yet. Tap Connect a passkey to make one.";
  if (/domain|asset|rp ?id|relying/i.test(cause + msg)) return "Passkeys aren't set up for this app build yet.";
  return msg && !/Passkey (creation|assertion) failed/.test(msg) ? msg : "The passkey didn't finish.";
}

/** Link a passkey to this account and give every agent its own passkey key (POST /api/mera/keys, as on the web). */
export async function linkPasskey(slugs: string[], create: boolean, token: string, label = "Lexari") {
  const { prf, credentialId } = await passkeyRoot(create, label);
  const signIn = createEd25519SigningSession({ privateKey: derive(prf, "signin/solana") });
  const address = getSolanaAddress(signIn.publicKey);
  const proof = `Link this passkey to my Lexari account: ${address}`;
  const signature = b64(await signIn.signMessage(new TextEncoder().encode(proof)));
  const keys = await Promise.all(slugs.map(async (slug) => {
    const s = createSecp256k1SigningSession({ privateKey: derive(prf, `agent/${slug}/evm`) });
    const addr = getEvmAddress(s.publicKey);
    return { agent: slug, address: addr, signature: await toViemAccount(s).signMessage({ message: `Lexari agent key for ${slug}: ${addr}` }) };
  }));
  return api<{ ok: true }>("/api/mera/keys", { method: "POST", body: JSON.stringify({ address, credentialId, proof, signature, keys }) }, token);
}

export type MeraKeys = { passkeys: { address: string }[]; keys: { agent: string; address: string }[] };
export const loadKeys = (token: string) => api<MeraKeys>("/api/mera/keys", {}, token);
