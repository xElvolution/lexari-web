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
import { TIER_FRIENDS, TIER_REWARD, boxClaimPda, claimQuestIx, claimTierIx, decodePlayer, initPlayerIx, openBoxIx, playerPda, questClaimPda, tierClaimPda } from "@/lib/lexari-ix";
import { QUEST_RULES, periodNumber, rollBox } from "./catalog";
import { connection, fetchMany, programStatus, utcDay } from "./chain";
import { attestorKeypair } from "./keys";
import { boxDayFor, hubState, referrerPlayer } from "./state";
import { qualifiedReferrals, questProgress } from "./rules";

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

let bh: { blockhash: string; lastValidBlockHeight: number; at: number } | null = null;
/** A recent blockhash, reused for up to 20 s (it stays valid for about a minute), so a claim doesn't wait on the RPC. */
async function recentBlockhash() {
  if (bh && Date.now() - bh.at < 20_000) return bh;
  const r = await connection().getLatestBlockhash("confirmed");
  bh = { ...r, at: Date.now() };
  return bh;
}

/**
 * Builds the claim with only what this one reward needs (its claim account, your player account and one progress
 * query, all in parallel) so the pop-up shows the coins quickly. Hard level quests fall back to the full Hub state.
 */
export async function buildClaim(user: { userId: string; wallet: string; referralCode: string }, req: ClaimRequest) {
  const attestor = attestorKeypair();
  const owner = new PublicKey(user.wallet);
  const player = playerPda(owner);
  const blockhashP = recentBlockhash();
  const [status] = await Promise.all([programStatus(), blockhashP.catch(() => null)]);
  if (!attestor || !status.ok || status.attestor !== attestor.publicKey.toBase58()) {
    if (attestor && status.ok && status.attestor !== attestor.publicKey.toBase58()) console.error("[hub] attestor key does not match the onchain config");
    throw new HttpError(503, "Rewards are not open yet. Try again later.");
  }
  let ix: TransactionInstruction;
  let coins = 0;
  let hasPlayer: boolean;
  if (req.kind === "quest") {
    const rule = QUEST_RULES.find((q) => q.id === req.questId);
    if (!rule) throw new HttpError(404, "There is no such quest.");
    if (rule.period === "hard" && rule.count === "level") {
      const state = await hubState(user);
      const q = state.quests.find((x) => x.id === req.questId)!;
      if (q.claimed) throw new HttpError(409, "You already claimed this one.");
      if (q.progress < rule.goal) throw new HttpError(400, "That quest is not finished yet.");
      hasPlayer = !!state.player;
    } else {
      const pda = questClaimPda(player, rule.chainId, periodNumber(rule.period));
      const accts = await fetchMany([player, pda]);
      const raw = accts.get(player.toBase58());
      const p = raw ? decodePlayer(raw.data) : null;
      const today = utcDay();
      const streak = p ? (Math.floor(p.lastCheckIn / 86_400) >= today - 1 ? p.streak : 0) : 0;
      if (accts.get(pda.toBase58())) throw new HttpError(409, "You already claimed this one.");
      const progress = await questProgress(user.userId, rule, { streak, maxLevel: 0 });
      if (progress < rule.goal) throw new HttpError(400, "That quest is not finished yet.");
      hasPlayer = !!raw;
    }
    coins = rule.reward;
    ix = claimQuestIx(owner, attestor.publicKey, rule.chainId, periodNumber(rule.period), coins);
  } else if (req.kind === "box") {
    const day = await boxDayFor(user.userId, utcDay());
    const box = boxClaimPda(player, day);
    const [accts, roll] = await Promise.all([fetchMany([player, box]), boxRoll(user.userId, day)]);
    if (accts.get(box.toBase58())) throw new HttpError(409, "You already opened today's box.");
    hasPlayer = !!accts.get(player.toBase58());
    coins = roll;
    ix = openBoxIx(owner, attestor.publicKey, day, coins);
  } else {
    if (!TIER_FRIENDS[req.tier]) throw new HttpError(404, "There is no such tier.");
    const pda = tierClaimPda(player, req.tier);
    const [accts, friends] = await Promise.all([fetchMany([player, pda]), qualifiedReferrals(user.userId)]);
    if (accts.get(pda.toBase58())) throw new HttpError(409, "You already claimed this tier.");
    if (friends < TIER_FRIENDS[req.tier]) throw new HttpError(400, "Not enough friends have joined with your code yet.");
    hasPlayer = !!accts.get(player.toBase58());
    coins = TIER_REWARD[req.tier];
    ix = claimTierIx(owner, attestor.publicKey, req.tier);
  }
  const state = { player: hasPlayer };

  const ixs: TransactionInstruction[] = [];
  if (!state.player) ixs.push(initPlayerIx(owner, await referrerPlayer(user.userId)));
  ixs.push(ix);
  const { blockhash, lastValidBlockHeight } = await blockhashP.catch(() => recentBlockhash());
  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(...ixs);
  tx.partialSign(attestor);
  return { tx: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"), coins, lastValidBlockHeight };
}

