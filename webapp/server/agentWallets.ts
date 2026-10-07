/**
 * Every agent's own wallet, one per chain. Solana is live (devnet); Base and Ethereum are listed for later and
 * return nothing until they exist, so the app never shows a made-up balance.
 *
 * Keys are derived from SESSION_SECRET per (person, agent, chain), so no key is stored. A hired specialist keeps
 * the task wallet it already had (server/hireWallet.ts) so nothing moves address.
 *
 * Funding: "Fund agent" moves dollars from the Lexari balance into the agent's wallet. For now that is test USDC on
 * devnet only, sent from Lexari's payout wallet. There is no mainnet fiat-to-crypto conversion here.
 */
import { createHmac } from "node:crypto";
import { Keypair, PublicKey, Transaction, type Connection } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { and, desc, eq, sql } from "drizzle-orm";
import { cluster, usdcMint } from "./config";
import { connection } from "./hub/chain";
import { b58decode } from "./hub/keys";
import { hireWallet } from "./hireWallet";
import { db } from "./db";
import { agentFundings } from "./db/billingSchema";
import { agents } from "./db/schema";
import { HttpError } from "./http";
import { charge, credit, usd } from "./billing/balance";

export type ChainId = "solana" | "base" | "ethereum";
export type Holding = { asset: string; amount: number; decimals: number; test: boolean };
export type AgentWallet = { chain: ChainId; network: string; address: string; holdings: Holding[]; explorer: string };

/** Chains an agent can hold funds on. Only live ones get an address. */
export const CHAINS: { id: ChainId; name: string; live: boolean }[] = [
  { id: "solana", name: "Solana", live: true },
  { id: "base", name: "Base", live: false },
  { id: "ethereum", name: "Ethereum", live: false },
];

const USDC_DECIMALS = 6;
export const FUND_AMOUNTS = [1, 5, 10] as const;
export const MAX_FUND_USD = 25;
/** Test funds only while the app runs on devnet. */
export const fundingOn = () => cluster() === "devnet" && !!usdcMint() && !!payoutKey();

function secret() {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 16) throw new HttpError(503, "Agent wallets are not set up on this server.");
  return s;
}

/** The agent's Solana keypair. Hired specialists keep their existing task wallet. */
export function solanaKeypair(userId: string, slug: string, kind: string) {
  if (kind === "hired") return hireWallet(userId, slug);
  const seed = createHmac("sha256", secret()).update(`lexari-agent-wallet:v1:solana:${userId}:${slug}`).digest();
  return Keypair.fromSeed(seed.subarray(0, 32));
}

/** Lexari's devnet payout wallet: holds test USDC and pays network fees. LEXARI_PAYOUT_KEY, else the faucet key. */
function payoutKey() {
  const raw = (process.env.LEXARI_PAYOUT_KEY || process.env.LEXARI_FAUCET_KEY || "").trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
    const b = b58decode(raw);
    return b.length === 64 ? Keypair.fromSecretKey(b) : Keypair.fromSeed(b);
  } catch { return null; }
}

const explorer = (addr: string) => `https://explorer.solana.com/address/${addr}${cluster() === "devnet" ? "?cluster=devnet" : ""}`;

async function solanaHoldings(c: Connection, owner: PublicKey): Promise<Holding[]> {
  const out: Holding[] = [];
  const mint = usdcMint();
  if (mint) {
    const ata = getAssociatedTokenAddressSync(new PublicKey(mint), owner, true);
    const bal = await c.getTokenAccountBalance(ata, "confirmed").then((r) => Number(r.value.amount)).catch(() => 0);
    out.push({ asset: "USDC", amount: bal, decimals: USDC_DECIMALS, test: cluster() === "devnet" });
  }
  const lamports = await c.getBalance(owner, "confirmed").catch(() => 0);
  if (lamports > 0) out.push({ asset: "SOL", amount: lamports, decimals: 9, test: cluster() === "devnet" });
  return out;
}

/** Wallets for one agent on every live chain, with what they hold. */
export async function walletsFor(userId: string, slug: string, kind: string): Promise<AgentWallet[]> {
  const kp = solanaKeypair(userId, slug, kind);
  return [{ chain: "solana", network: cluster(), address: kp.publicKey.toBase58(), holdings: await solanaHoldings(connection(), kp.publicKey), explorer: explorer(kp.publicKey.toBase58()) }];
}

/** The agent row (your own agent, one you made, or a hired specialist), or 404. */
export async function ownAgent(userId: string, slug: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) throw new HttpError(404, "That agent is not on your team.");
  const [row] = await db().select({ slug: agents.slug, kind: agents.kind, name: agents.name, meta: agents.meta }).from(agents).where(and(eq(agents.userId, userId), eq(agents.slug, slug))).limit(1);
  if (!row) throw new HttpError(404, "That agent is not on your team.");
  return row;
}

async function sendUsdc(from: Keypair, feePayer: Keypair, to: PublicKey, micros: number) {
  const c = connection();
  const mint = new PublicKey(usdcMint());
  const src = getAssociatedTokenAddressSync(mint, from.publicKey, true);
  const dst = getAssociatedTokenAddressSync(mint, to, true);
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: feePayer.publicKey, blockhash, lastValidBlockHeight })
    .add(createAssociatedTokenAccountIdempotentInstruction(feePayer.publicKey, dst, to, mint))
    .add(createTransferCheckedInstruction(src, mint, dst, from.publicKey, BigInt(micros), USDC_DECIMALS));
  const signers = from.publicKey.equals(feePayer.publicKey) ? [from] : [feePayer, from];
  tx.sign(...signers);
  const sig = await c.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed", maxRetries: 5 });
  const end = Date.now() + 30_000;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 800));
    const st = (await c.getSignatureStatuses([sig]).catch(() => null))?.value[0];
    if (st?.err) throw new Error("transfer failed on chain");
    if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return sig;
  }
  throw new Error("transfer not confirmed in time");
}

/**
 * Fund an agent: one ledger debit (idempotent on the client key), then test USDC from the payout wallet to the
 * agent's Solana wallet. If the transfer fails, the balance is refunded in full.
 */
export async function fundAgent(userId: string, slug: string, amountUsd: number, key: string) {
  if (!fundingOn()) throw new HttpError(503, "Funding agents is not switched on here yet.");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw new HttpError(400, "Missing request key.");
  if (!(amountUsd >= 1 && amountUsd <= MAX_FUND_USD) || Math.round(amountUsd * 100) !== amountUsd * 100) throw new HttpError(400, `Fund between $1 and $${MAX_FUND_USD}.`);
  const agent = await ownAgent(userId, slug);
  const micros = Math.round(amountUsd * 1_000_000);
  const address = solanaKeypair(userId, slug, agent.kind).publicKey;
  const database = db();
  const [prev] = await database.select().from(agentFundings).where(eq(agentFundings.clientKey, `${userId}:${key}`)).limit(1);
  if (prev) return { funding: prev, already: true };
  const funding = await database.transaction(async (tx) => {
    const [f] = await tx.insert(agentFundings).values({ userId, agentSlug: slug, chain: "solana", direction: "in", amount: micros, status: "pending", clientKey: `${userId}:${key}`, address: address.toBase58() }).returning();
    await charge(tx, userId, micros, "fund", `fund:${f.id}`, `Funding ${agent.name}`);
    return f;
  });
  const payout = payoutKey()!;
  try {
    const sig = await sendUsdc(payout, payout, address, micros);
    const [done] = await database.update(agentFundings).set({ status: "sent", txSig: sig, settledAt: new Date() }).where(eq(agentFundings.id, funding.id)).returning();
    return { funding: done, already: false };
  } catch (e) {
    const why = (e as Error).message.slice(0, 160);
    console.error(`[fund-agent] transfer failed, refunding: ${why}`);
    await database.transaction(async (tx) => {
      await credit(tx, userId, micros, "fund_refund", `fund-refund:${funding.id}`);
      await tx.update(agentFundings).set({ status: "refunded", error: why, settledAt: new Date() }).where(eq(agentFundings.id, funding.id));
    });
    throw new HttpError(502, `The transfer to ${agent.name}'s wallet didn't go through, so ${usd(micros)} went back to your balance.`, { refunded: true });
  }
}

/** Sends what the agent holds of the dollars you funded back to Lexari and credits them to your balance. */
export async function returnToBalance(userId: string, slug: string) {
  if (!fundingOn()) throw new HttpError(503, "Funding agents is not switched on here yet.");
  const agent = await ownAgent(userId, slug);
  const kp = solanaKeypair(userId, slug, agent.kind);
  const payout = payoutKey()!;
  const c = connection();
  const ata = getAssociatedTokenAddressSync(new PublicKey(usdcMint()), kp.publicKey, true);
  // One return at a time per agent (a lock held while the transfer runs), so two taps can't credit twice.
  return db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`agent-return:${userId}:${slug}`}))`);
    const held = await c.getTokenAccountBalance(ata, "confirmed").then((r) => Number(r.value.amount)).catch(() => 0);
    // Only dollars that came from your balance go back to it: test USDC sent to the agent from anywhere else (a
    // faucet) stays in its wallet, so the balance can never be topped up for free. Credited total <= funded total.
    const [net] = await tx.select({ v: sql<number>`coalesce(sum(case when ${agentFundings.direction} = 'in' and ${agentFundings.status} = 'sent' then ${agentFundings.amount} when ${agentFundings.direction} = 'out' then -${agentFundings.amount} else 0 end), 0)::bigint` })
      .from(agentFundings).where(and(eq(agentFundings.userId, userId), eq(agentFundings.agentSlug, slug), eq(agentFundings.chain, "solana")));
    const micros = Math.min(held, Math.max(0, Number(net?.v ?? 0)));
    if (micros <= 0) return { micros: 0, sig: null as string | null };
    const sig = await sendUsdc(kp, payout, payout.publicKey, micros);
    const [f] = await tx.insert(agentFundings).values({ userId, agentSlug: slug, chain: "solana", direction: "out", amount: micros, status: "sent", txSig: sig, address: kp.publicKey.toBase58(), settledAt: new Date() }).onConflictDoNothing().returning();
    if (f) await credit(tx, userId, micros, "fund_return", `fund-return:${sig}`);
    return { micros, sig: sig as string | null };
  });
}

/** Recent funding receipts for one agent (or all agents). */
export async function fundingHistory(userId: string, slug?: string) {
  const where = slug ? and(eq(agentFundings.userId, userId), eq(agentFundings.agentSlug, slug)) : eq(agentFundings.userId, userId);
  const rows = await db().select().from(agentFundings).where(where).orderBy(desc(agentFundings.createdAt)).limit(20);
  return rows.map((r) => ({ id: r.id, agent: r.agentSlug, chain: r.chain, direction: r.direction, asset: r.asset, amount: r.amount, status: r.status, sig: r.txSig, at: r.createdAt.getTime() }));
}
