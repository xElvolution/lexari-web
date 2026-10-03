/**
 * Records what a confirmed transaction did, from the chain itself.
 * The transaction must have succeeded and be signed by the session wallet, and each Lexari
 * instruction must act for that wallet. Each (signature, instruction) is recorded once.
 */
import { PublicKey, type VersionedTransactionResponse } from "@solana/web3.js";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { agents, chainLedger, memories } from "../db/schema";
import { recordEvent } from "../events";
import { HttpError } from "../http";
import { PROGRAM_ID, STREAK_PAY, TIER_REWARD, decodePlayer, playerPda, agentPda, coreAssetOwner, decodeAgent, decodeLevel, levelPda, parseLexariIx, type ParsedIx } from "@/lib/lexari-ix";
import { connection, fetchMany } from "./chain";

export async function fetchConfirmed(signature: string, tries = 10): Promise<VersionedTransactionResponse> {
  for (let i = 0; i < tries; i++) {
    const tx = await connection().getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (tx) return tx;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new HttpError(404, "That transaction is not confirmed yet. Try again in a moment.");
}

/** Lexari instructions in a transaction, with their account keys resolved. */
export function lexariInstructions(tx: VersionedTransactionResponse) {
  const msg = tx.transaction.message;
  const keys = msg.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses }).keySegments().flat().map((k) => k.toBase58());
  const signers = keys.slice(0, msg.header.numRequiredSignatures);
  const out: { index: number; ix: ParsedIx }[] = [];
  msg.compiledInstructions.forEach((ci, index) => {
    if (keys[ci.programIdIndex] !== PROGRAM_ID.toBase58()) return;
    const parsed = parseLexariIx(ci.data, ci.accountKeyIndexes.map((i) => keys[i]));
    if (parsed) out.push({ index, ix: parsed });
  });
  return { signers, out };
}

const OWNER_FIRST = new Set(["register_agent", "update_agent", "sync_agent_owner", "write_memory", "revoke_memory", "delete_memory", "init_player", "check_in", "claim_quest", "open_box", "level_up", "claim_referral_tier"]);

export async function confirmSignature(user: { userId: string; wallet: string }, signature: string) {
  const tx = await fetchConfirmed(signature);
  if (tx.meta?.err) throw new HttpError(400, "That transaction failed on Solana.");
  const { signers, out } = lexariInstructions(tx);
  if (!signers.includes(user.wallet)) throw new HttpError(403, "That transaction was not signed by your wallet.");
  const recorded: string[] = [];
  const database = db();
  for (const { index, ix } of out) {
    if (OWNER_FIRST.has(ix.name) && ix.accounts[0] !== user.wallet) continue;
    const amount = "args" in ix && "coins" in ix.args ? ix.args.coins : 0;
    const data: Record<string, unknown> = "args" in ix ? { ...ix.args } : {};
    let coins = amount;
    if (ix.name === "check_in") {
      // The pay depends on the streak, which the program computes. Read it back from the Player account.
      const pl = (await fetchMany([playerPda(new PublicKey(user.wallet))])).get(playerPda(new PublicKey(user.wallet)).toBase58());
      const streak = pl ? decodePlayer(pl.data)?.streak ?? 1 : 1;
      coins = STREAK_PAY[Math.min(STREAK_PAY.length, Math.max(1, streak)) - 1];
      data.streak = streak;
    }
    if (ix.name === "claim_referral_tier") coins = TIER_REWARD[ix.args.tier] ?? 0;
    if (ix.name === "level_up") {
      const agent = ix.accounts[2];
      const lv = (await fetchMany([levelPda(new PublicKey(agent))])).get(levelPda(new PublicKey(agent)).toBase58());
      data.agent = agent;
      data.levelAfter = lv ? decodeLevel(lv.data)?.level ?? 1 : 1;
    }
    const inserted = await database.insert(chainLedger).values({ signature, ixIndex: index, userId: user.userId, kind: ix.name, amount: coins, data, slot: tx.slot })
      .onConflictDoNothing().returning({ kind: chainLedger.kind });
    if (!inserted.length) continue;
    recorded.push(ix.name);
    await sideEffects(user, signature, index, ix, data);
  }
  return { recorded };
}

async function sideEffects(user: { userId: string; wallet: string }, signature: string, index: number, ix: ParsedIx, data: Record<string, unknown>) {
  const database = db();
  const ref = `${signature}:${index}`;
  if (ix.name === "check_in") await recordEvent(user.userId, "checkin", { ref });
  if (ix.name === "open_box") await recordEvent(user.userId, "box", { ref });
  if (ix.name === "level_up") {
    // Levels gained = level now minus the highest level we had seen for this agent.
    const prev = await database.select({ m: sql<number>`coalesce(max((${chainLedger.data}->>'levelAfter')::int), 1)::int` }).from(chainLedger)
      .where(and(eq(chainLedger.userId, user.userId), eq(chainLedger.kind, "level_up"), sql`${chainLedger.data}->>'agent' = ${String(data.agent)}`, sql`not (${chainLedger.signature} = ${signature} and ${chainLedger.ixIndex} = ${index})`));
    const gained = Number(data.levelAfter) - Number(prev[0]?.m ?? 1);
    if (gained > 0) await recordEvent(user.userId, "level", { ref, amount: gained });
  }
  if (ix.name === "register_agent" || ix.name === "update_agent" || ix.name === "sync_agent_owner") {
    const asset = ix.name === "register_agent" ? ix.accounts[1] : ix.accounts[2];
    await linkAgent(user, asset, signature);
  }
  if (ix.name === "write_memory") {
    await database.update(memories).set({ onchainPda: ix.accounts[3], chainTx: signature, uri: ix.args.uri })
      .where(and(eq(memories.userId, user.userId), eq(memories.contentHash, ix.args.hash)));
  }
  if (ix.name === "delete_memory") {
    await database.update(memories).set({ onchainPda: null }).where(and(eq(memories.userId, user.userId), eq(memories.onchainPda, ix.accounts[1])));
  }
}

/** Ties a minted card to the person's agent row, after checking the chain says it is theirs. */
async function linkAgent(user: { userId: string; wallet: string }, asset: string, signature: string) {
  const assetKey = new PublicKey(asset);
  const pda = agentPda(assetKey);
  const m = await fetchMany([assetKey, pda]);
  const a = m.get(asset);
  const rec = m.get(pda.toBase58());
  const owner = a ? coreAssetOwner(a.owner, a.data) : null;
  const agent = rec ? decodeAgent(rec.data) : null;
  if (owner !== user.wallet || agent?.owner !== user.wallet) return;
  const database = db();
  const byAsset = await database.select().from(agents).where(eq(agents.asset, asset)).limit(1);
  if (byAsset[0]) {
    if (byAsset[0].userId !== user.userId) {
      // The card was transferred to this person: the agent comes with it.
      await database.update(agents).set({ userId: user.userId, kind: "custom", slug: `c-${asset.slice(0, 8).toLowerCase()}`, updatedAt: new Date() }).where(eq(agents.id, byAsset[0].id));
    }
    return;
  }
  // First mint: attach to the agent with this name, else the home agent.
  const mine = await database.select().from(agents).where(eq(agents.userId, user.userId));
  const target = mine.find((r) => !r.asset && r.name === agent.name) || mine.find((r) => !r.asset && r.slug === "home");
  if (target) await database.update(agents).set({ asset, agentPda: pda.toBase58(), mintedAt: new Date(), meta: { ...(target.meta || {}), mintTx: signature }, updatedAt: new Date() }).where(eq(agents.id, target.id));
}
