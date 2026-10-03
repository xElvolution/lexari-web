/**
 * Builds attested Hub transactions on the server. The client never sends us a transaction to sign:
 * we pick the instruction, the accounts (derived from the session wallet) and the amount,
 * set the session wallet as fee payer, and partial-sign as the attestor.
 * The wallet adds its signature and sends it. Replays fail: each claim creates a one-time PDA,
 * and the blockhash expires in about a minute.
 */
import { PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { questProgress as progressTable, users } from "../db/schema";
import { HttpError } from "../http";
import { TIER_FRIENDS, TIER_REWARD, claimQuestIx, claimTierIx, initPlayerIx, openBoxIx, playerPda } from "@/lib/lexari-ix";
import { QUEST_RULES, periodNumber, rollBox } from "./catalog";
import { connection, fetchMany, programStatus, utcDay } from "./chain";
import { attestorKeypair } from "./keys";
import { hubState, referrerPlayer } from "./state";

export type ClaimRequest = { kind: "quest"; questId: string } | { kind: "box" } | { kind: "tier"; tier: number };

/** The day's mystery box roll, fixed the first time it is asked for. */
export async function boxRoll(userId: string, day = utcDay()) {
  const database = db();
  const key = String(day);
  const existing = await database.select().from(progressTable).where(and(eq(progressTable.userId, userId), eq(progressTable.questId, "box"), eq(progressTable.periodKey, key))).limit(1);
  if (existing[0]) return existing[0].count;
  await database.insert(progressTable).values({ userId, questId: "box", periodKey: key, count: rollBox() }).onConflictDoNothing();
  const row = await database.select().from(progressTable).where(and(eq(progressTable.userId, userId), eq(progressTable.questId, "box"), eq(progressTable.periodKey, key))).limit(1);
  return row[0]!.count;
}

export async function buildClaim(user: { userId: string; wallet: string; referralCode: string }, req: ClaimRequest) {
  const attestor = attestorKeypair();
  const status = await programStatus();
  if (!attestor || !status.ok || status.attestor !== attestor.publicKey.toBase58()) {
    if (attestor && status.ok && status.attestor !== attestor.publicKey.toBase58()) console.error("[hub] attestor key does not match the onchain config");
    throw new HttpError(503, "Rewards are not open yet. Try again later.");
  }
  const owner = new PublicKey(user.wallet);
  const state = await hubState(user);
  let ix: TransactionInstruction;
  let coins = 0;
  if (req.kind === "quest") {
    const rule = QUEST_RULES.find((q) => q.id === req.questId);
    const q = state.quests.find((x) => x.id === req.questId);
    if (!rule || !q) throw new HttpError(404, "There is no such quest.");
    if (q.claimed) throw new HttpError(409, "You already claimed this one.");
    if (q.progress < rule.goal) throw new HttpError(400, "That quest is not finished yet.");
    coins = rule.reward;
    ix = claimQuestIx(owner, attestor.publicKey, rule.chainId, periodNumber(rule.period), coins);
  } else if (req.kind === "box") {
    if (state.box.opened) throw new HttpError(409, "You already opened today's box.");
    coins = await boxRoll(user.userId, state.box.day);
    ix = openBoxIx(owner, attestor.publicKey, state.box.day, coins);
  } else {
    const t = state.referral.tiers[req.tier];
    if (!t) throw new HttpError(404, "There is no such tier.");
    if (t.claimed) throw new HttpError(409, "You already claimed this tier.");
    if (state.referral.friends < TIER_FRIENDS[req.tier]) throw new HttpError(400, "Not enough friends have joined with your code yet.");
    coins = TIER_REWARD[req.tier];
    ix = claimTierIx(owner, attestor.publicKey, req.tier);
  }

  const ixs: TransactionInstruction[] = [];
  if (!state.player) ixs.push(initPlayerIx(owner, await referrerPlayer(user.userId)));
  ixs.push(ix);
  const { blockhash, lastValidBlockHeight } = await connection().getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(...ixs);
  tx.partialSign(attestor);
  return { tx: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"), coins, lastValidBlockHeight };
}

