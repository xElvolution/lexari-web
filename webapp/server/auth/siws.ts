import nacl from "tweetnacl";
import { SOLANA_CLUSTER_FOR_MODE } from "@/lib/network";
import { PublicKey } from "@solana/web3.js";

export function clusterChain() {
  return SOLANA_CLUSTER_FOR_MODE === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
}

export function buildSignInMessage(opts: {
  domain: string;
  wallet: string;
  uri: string;
  nonce: string;
  issuedAt: string;
  chainId?: string;
}) {
  const chainId = opts.chainId || clusterChain();
  return [
    `${opts.domain} wants you to sign in with your Solana account:`,
    opts.wallet,
    "",
    "Sign in to Lexari. This does not send a transaction.",
    "",
    `URI: ${opts.uri}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.issuedAt}`,
  ].join("\n");
}

export function isWallet(value: string) {
  try {
    const key = new PublicKey(value);
    return PublicKey.isOnCurve(key.toBytes());
  } catch {
    return false;
  }
}

/** Ed25519 check of a base64 signature over the exact UTF-8 message. */
export function verifySolanaSignature(message: string, signatureB64: string, wallet: string) {
  let signature: Uint8Array;
  try {
    signature = Buffer.from(signatureB64, "base64");
  } catch {
    return false;
  }
  if (signature.length !== 64) return false;
  let key: Uint8Array;
  try {
    key = new PublicKey(wallet).toBytes();
  } catch {
    return false;
  }
  return nacl.sign.detached.verify(new TextEncoder().encode(message), signature, key);
}
