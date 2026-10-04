/**
 * Devnet SOL for people who have none, paid by the server's faucet wallet (LEXARI_FAUCET_KEY).
 * Per-person cap (lifetime), per-wallet cap, a cooldown and a daily total keep it from being drained.
 * Mainnet never pays out.
 */
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { and, eq, gt, sql } from "drizzle-orm";
import { b58decode } from "./hub/keys";
import { cluster } from "./config";
import { connection } from "./hub/chain";
import { db } from "./db";
import { faucetGrants } from "./db/schema";
import { HttpError } from "./http";

export const FAUCET_CAP = Number(process.env.FAUCET_USER_CAP_LAMPORTS || 0.35 * LAMPORTS_PER_SOL);
export const FAUCET_STEP = Number(process.env.FAUCET_STEP_LAMPORTS || 0.1 * LAMPORTS_PER_SOL);
const DAILY = Number(process.env.FAUCET_DAILY_LAMPORTS || 5 * LAMPORTS_PER_SOL);
const COOLDOWN_MS = 20_000;

function faucetKey() {
  const raw = process.env.LEXARI_FAUCET_KEY?.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
    const b = b58decode(raw);
    return b.length === 64 ? Keypair.fromSecretKey(b) : Keypair.fromSeed(b);
  } catch { return null; }
}
const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58encode(bytes: Uint8Array) {
  let n = BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0"));
  let out = "";
  while (n > BigInt(0)) { out = ALPHA[Number(n % BigInt(58))] + out; n /= BigInt(58); }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}
export const faucetOn = () => cluster() === "devnet" && !!faucetKey();

export async function granted(userId: string, wallet: string) {
  const database = db();
  const [u] = await database.select({ n: sql<number>`coalesce(sum(${faucetGrants.lamports}),0)` }).from(faucetGrants).where(eq(faucetGrants.userId, userId));
  const [w] = await database.select({ n: sql<number>`coalesce(sum(${faucetGrants.lamports}),0)` }).from(faucetGrants).where(eq(faucetGrants.wallet, wallet));
  return Math.max(Number(u?.n ?? 0), Number(w?.n ?? 0));
}

/** Sends up to `want` lamports (default FAUCET_STEP) to the person's wallet. Returns the signature and amount. */
export async function drip(userId: string, wallet: string, want?: number) {
  if (cluster() !== "devnet") throw new HttpError(400, "The faucet only runs on devnet.");
  const key = faucetKey();
  if (!key) throw new HttpError(503, "The devnet faucet is not set up on this server.");
  const database = db();
  const [recent] = await database.select({ id: faucetGrants.id }).from(faucetGrants)
    .where(and(eq(faucetGrants.userId, userId), gt(faucetGrants.createdAt, new Date(Date.now() - COOLDOWN_MS)))).limit(1);
  if (recent) throw new HttpError(429, "You just got devnet SOL. Wait a few seconds for it to arrive.");
  const have = await granted(userId, wallet);
  const left = FAUCET_CAP - have;
  if (left < 0.005 * LAMPORTS_PER_SOL) throw new HttpError(403, `You've had the ${FAUCET_CAP / LAMPORTS_PER_SOL} devnet SOL limit. Get more at faucet.solana.com.`);
  const [day] = await database.select({ n: sql<number>`coalesce(sum(${faucetGrants.lamports}),0)` }).from(faucetGrants).where(gt(faucetGrants.createdAt, new Date(Date.now() - 86_400_000)));
  if (Number(day?.n ?? 0) >= DAILY) throw new HttpError(429, "The devnet faucet hit today's limit. Try faucet.solana.com, or come back tomorrow.");
  const amount = Math.min(left, Math.max(FAUCET_STEP, Math.ceil((want || 0) + 0.002 * LAMPORTS_PER_SOL)));
  const c = connection();
  const bal = await c.getBalance(key.publicKey, "confirmed");
  if (bal < amount + 10_000) throw new HttpError(503, "The devnet faucet is empty right now. Try faucet.solana.com.");
  const to = new PublicKey(wallet);
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: key.publicKey, blockhash, lastValidBlockHeight }).add(SystemProgram.transfer({ fromPubkey: key.publicKey, toPubkey: to, lamports: amount }));
  tx.sign(key);
  // Record first (so parallel taps can't double-spend the cap), then send.
  const sig = b58encode(tx.signature!);
  await database.insert(faucetGrants).values({ userId, wallet, tx: sig, lamports: amount });
  try {
    await c.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    const r = await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    if (r.value.err) throw new Error("failed");
  } catch (e) {
    await database.delete(faucetGrants).where(eq(faucetGrants.tx, sig));
    throw new HttpError(502, `Couldn't send devnet SOL just now. Try again. (${String((e as Error).message || "").slice(0, 60)})`);
  }
  return { tx: sig, lamports: amount, left: left - amount };
}
