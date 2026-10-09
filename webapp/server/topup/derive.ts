/**
 * Per-person deposit addresses for every non-Solana chain in content/topup.ts. Each key is derived from
 * SESSION_SECRET per (family, person) with HMAC-SHA256, the same way agent wallets are, so no key is stored and the
 * server can always re-derive (and later sweep) it. Testnet encodings here; MAINNET changes only the prefixes
 * (bc1 / ltc1) and keeps the derivation.
 *
 *  evm  : one secp256k1 key, the same 0x address on Ethereum, Base, Arbitrum, BNB Chain and Tempo
 *  btc  : P2WPKH (bech32 v0), tb1… on Bitcoin testnet4, tltc1… on Litecoin testnet
 *  tron : base58check T… address (0x41 + keccak(pubkey)[12:])
 *  xrpl : ONE Lexari address for everyone plus a per-person destination tag (no 1 XRP reserve per person)
 */
import { createHash, createHmac } from "node:crypto";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { ripemd160 } from "@noble/hashes/legacy";
import { HttpError } from "../http";
import { addressOfKey } from "../integrations/evm";

const secret = () => {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 16) throw new HttpError(503, "Deposits are not set up on this server.");
  return s;
};
/** The private key for a family; `who` is a person id, or "lexari" for shared Lexari accounts. */
export function depositKey(family: "evm" | "btc" | "ltc" | "tron" | "xrpl", who: string): Uint8Array {
  let k = createHmac("sha256", secret()).update(`lexari-deposit:v1:${family}:${who}`).digest();
  // a valid secp256k1 scalar (astronomically unlikely to need a second round)
  while (!secp256k1.utils.isValidPrivateKey(k)) k = createHash("sha256").update(k).digest();
  return new Uint8Array(k);
}

const sha256 = (b: Uint8Array) => new Uint8Array(createHash("sha256").update(b).digest());
const hash160 = (b: Uint8Array) => ripemd160(sha256(b));

/* ---------- base58check (Bitcoin and Ripple alphabets) ---------- */
const BTC58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const XRP58 = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";
export function base58check(payload: Uint8Array, alphabet = BTC58) {
  const data = new Uint8Array([...payload, ...sha256(sha256(payload)).subarray(0, 4)]);
  let n = BigInt("0x" + (Buffer.from(data).toString("hex") || "0"));
  let out = "";
  while (n > BigInt(0)) { out = alphabet[Number(n % BigInt(58))] + out; n /= BigInt(58); }
  for (const b of data) { if (b !== 0) break; out = alphabet[0] + out; }
  return out;
}
export function base58checkDecode(s: string, alphabet = BTC58): Uint8Array | null {
  let n = BigInt(0);
  for (const ch of s) { const i = alphabet.indexOf(ch); if (i < 0) return null; n = n * BigInt(58) + BigInt(i); }
  let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex;
  const lead = [...s].findIndex((c) => c !== alphabet[0]);
  const bytes = new Uint8Array([...new Array(lead < 0 ? s.length : lead).fill(0), ...Buffer.from(n === BigInt(0) ? "" : hex, "hex")]);
  if (bytes.length < 5) return null;
  const body = bytes.subarray(0, -4), sum = bytes.subarray(-4);
  const want = sha256(sha256(body)).subarray(0, 4);
  return sum.every((b, i) => b === want[i]) ? body : null;
}

/* ---------- bech32 (BIP-173, witness v0) ---------- */
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function polymod(values: number[]) {
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) { const b = chk >> 25; chk = ((chk & 0x1ffffff) << 5) ^ v; for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= G[i]; }
  return chk;
}
const hrpExpand = (hrp: string) => [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];
function convertBits(data: Uint8Array, from: number, to: number) {
  let acc = 0, bits = 0; const out: number[] = []; const maxv = (1 << to) - 1;
  for (const v of data) { acc = (acc << from) | v; bits += from; while (bits >= to) { bits -= to; out.push((acc >> bits) & maxv); } }
  if (bits > 0) out.push((acc << (to - bits)) & maxv);
  return out;
}
export function segwitV0(hrp: string, program: Uint8Array) {
  const data = [0, ...convertBits(program, 8, 5)];
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const chk = [0, 1, 2, 3, 4, 5].map((i) => (mod >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...chk].map((d) => CHARSET[d]).join("")}`;
}

/* ---------- addresses ---------- */
export const evmDepositAddress = (userId: string) => addressOfKey(depositKey("evm", userId));
export const btcDepositAddress = (userId: string) => segwitV0("tb", hash160(secp256k1.getPublicKey(depositKey("btc", userId), true)));
export const ltcDepositAddress = (userId: string) => segwitV0("tltc", hash160(secp256k1.getPublicKey(depositKey("ltc", userId), true)));
export function tronAddressOfKey(priv: Uint8Array) {
  const pub = secp256k1.getPublicKey(priv, false).subarray(1);
  return base58check(new Uint8Array([0x41, ...keccak_256(pub).subarray(12)]));
}
export const tronDepositAddress = (userId: string) => tronAddressOfKey(depositKey("tron", userId));
/** The shared Lexari XRP Ledger account (deposits are told apart by destination tag). */
export const xrpLexariAddress = () => base58check(new Uint8Array([0x00, ...hash160(secp256k1.getPublicKey(depositKey("xrpl", "lexari"), true))]), XRP58);
/** Tron hex (41…) form of a T… address, for contract calls. */
export function tronHex(addr: string) {
  const b = base58checkDecode(addr);
  if (!b || b.length !== 21 || b[0] !== 0x41) throw new Error("bad tron address");
  return Buffer.from(b).toString("hex");
}
