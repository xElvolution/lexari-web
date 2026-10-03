import { PublicKey, Transaction } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { questProgress } from "../db/schema";
import { HttpError } from "../http";
import { questCount } from "../events";
import { TIER_FRIENDS, TIER_REWARD, periodNumber, questByChain, rollBox } from "./catalog";
import { attestorKeypair } from "./keys";

const PROGRAM = new PublicKey(process.env.NEXT_PUBLIC_LEXARI_PROGRAM_ID || "BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po");
const CLAIM_QUEST = Uint8Array.from([38, 197, 33, 123, 0, 108, 206, 161]);
const OPEN_BOX = Uint8Array.from([225, 220, 10, 104, 173, 151, 214, 199]);
const CLAIM_TIER = Uint8Array.from([197, 164, 29, 180, 105, 249, 176, 130]);

function same(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

function readU16(data: Buffer, at: number) { return data.readUInt16LE(at); }
function readU32(data: Buffer, at: number) { return data.readUInt32LE(at); }
function readU64(data: Buffer, at: number) { return Number(data.readBigUInt64LE(at)); }

export async function openBoxRoll(userId: string) {
  const day = Math.floor(Date.now() / 86_400_000);
  const database = db();
  const existing = await database.select().from(questProgress).where(and(
    eq(questProgress.userId, userId),
    eq(questProgress.questId, "box"),
    eq(questProgress.periodKey, String(day)),
  )).limit(1);
  if (existing[0]) return { day, coins: existing[0].count };
  const coins = rollBox();
  await database.insert(questProgress).values({ userId, questId: "box", periodKey: String(day), count: coins });
  return { day, coins };
}

/** Co-sign a quest, box, or referral transaction after the database says it was earned. */
export async function coSign(userId: string, txBase64: string) {
  const attestor = attestorKeypair();
  if (!attestor) throw new HttpError(503, "LEXARI_ATTESTOR_KEY is not set");
  const tx = Transaction.from(Buffer.from(txBase64, "base64"));
  const ix = tx.instructions.find((item) => item.programId.equals(PROGRAM));
  if (!ix) throw new HttpError(400, "The transaction does not call Lexari.");
  const data = Buffer.from(ix.data);
  const disc = data.subarray(0, 8);
  if (same(disc, CLAIM_QUEST)) {
    const chainId = readU16(data, 8);
    const period = readU32(data, 10);
    const coins = readU64(data, 14);
    const rule = questByChain(chainId);
    if (!rule) throw new HttpError(400, "Unknown quest.");
    if (coins !== rule.reward) throw new HttpError(400, "Quest payout does not match the catalog.");
    if (period !== periodNumber(rule.period)) throw new HttpError(400, "Quest period does not match today.");
    const have = await questCount(userId, rule);
    if (have < rule.goal) throw new HttpError(400, "That quest is not finished yet.");
  } else if (same(disc, OPEN_BOX)) {
    const day = readU32(data, 8);
    const coins = readU64(data, 12);
    const roll = await openBoxRoll(userId);
    if (day !== roll.day || coins !== roll.coins) throw new HttpError(400, "Mystery box payout does not match the server roll.");
  } else if (same(disc, CLAIM_TIER)) {
    const tier = data[8];
    if (tier === undefined || tier >= TIER_REWARD.length) throw new HttpError(400, "Unknown referral tier.");
    const friends = await questCount(userId, { id: "h-invite", chainId: 205, period: "hard", goal: TIER_FRIENDS[tier], reward: TIER_REWARD[tier], count: "referral" });
    if (friends < TIER_FRIENDS[tier]) throw new HttpError(400, "Not enough friends have joined with your code.");
  } else {
    throw new HttpError(400, "That instruction cannot be co-signed.");
  }
  tx.partialSign(attestor);
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}
