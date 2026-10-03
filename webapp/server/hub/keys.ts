import { Keypair } from "@solana/web3.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function b58decode(text: string) {
  const map = new Map([...ALPHABET].map((char, i) => [char, i]));
  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") zeros++;
  const size = Math.ceil((text.length * Math.log(58)) / Math.log(256));
  const bytes = new Uint8Array(size);
  for (const char of text) {
    const value = map.get(char);
    if (value === undefined) throw new Error("Invalid base58");
    let carry = value;
    for (let i = size - 1; i >= 0; i--) {
      carry += 58 * bytes[i];
      bytes[i] = carry % 256;
      carry = Math.floor(carry / 256);
    }
  }
  let start = 0;
  while (start < bytes.length && bytes[start] === 0) start++;
  const out = new Uint8Array(zeros + (bytes.length - start));
  out.set(bytes.subarray(start), zeros);
  return out;
}

export function attestorKeypair() {
  const raw = process.env.LEXARI_ATTESTOR_KEY?.trim();
  if (!raw) return null;
  if (raw.startsWith("[")) {
    const parsed = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  }
  const bytes = b58decode(raw);
  if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  if (bytes.length === 32) return Keypair.fromSeed(bytes);
  throw new Error("LEXARI_ATTESTOR_KEY must be 32 or 64 bytes");
}
