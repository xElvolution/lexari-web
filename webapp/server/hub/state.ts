import { PublicKey } from "@solana/web3.js";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { agents, chainLedger, questProgress as progressTable, users } from "../db/schema";
import {
  TIER_FRIENDS, TIER_REWARD, agentPda, boxClaimPda, coreAssetOwner, decodeLevel, decodePlayer, levelPda, playerPda, questClaimPda, tierClaimPda,
  type PlayerAccount,
} from "@/lib/lexari-ix";
import { QUEST_RULES, periodNumber } from "./catalog";
import { fetchMany, programStatus, utcDay } from "./chain";
import { qualifiedReferrals, questProgress } from "./rules";
import { offchainState } from "./offchain";

export type HubState = Awaited<ReturnType<typeof offchainState>>;

/** A support reset gives someone a fresh box today: their box for that day uses a second onchain slot (day + 1,000,000),
 *  since an opened box account cannot be closed. Set with prefs.boxReset = <UTC day number>. */
export const BOX_RESET_OFFSET = 1_000_000;
export async function boxDayFor(userId: string, today: number) {
  const [u] = await db().select({ prefs: users.prefs }).from(users).where(eq(users.id, userId)).limit(1);
  return Number(u?.prefs?.boxReset) === today ? today + BOX_RESET_OFFSET : today;
}

/** Everything the Hub shows. Coins and levels are offchain now (database); see offchain.ts. */
export async function hubState(user: { userId: string; wallet: string; referralCode: string }) { return offchainState(user); }

/** The old chain read (kept for reference and support tooling). */
export async function chainHubState(user: { userId: string; wallet: string; referralCode: string }) {
  const owner = new PublicKey(user.wallet);
  const player = playerPda(owner);
  const today = utcDay();
  const boxDay = await boxDayFor(user.userId, today);
  const rows = await db().select().from(agents).where(and(eq(agents.userId, user.userId), isNotNull(agents.asset)));
  const minted = rows.filter((a) => a.asset).map((a) => ({ slug: a.slug, name: a.name, asset: new PublicKey(a.asset!) }));
  const quests = QUEST_RULES.map((rule) => ({ rule, period: periodNumber(rule.period), pda: questClaimPda(player, rule.chainId, periodNumber(rule.period)) }));
  const tiers = TIER_FRIENDS.map((_, i) => tierClaimPda(player, i));
  const box = boxClaimPda(player, boxDay);
  const keys = [player, box, ...quests.map((q) => q.pda), ...tiers, ...minted.map((a) => levelPda(agentPda(a.asset))), ...minted.map((a) => a.asset)];
  const [status, accts] = await Promise.all([programStatus(), fetchMany(keys)]);
  const raw = accts.get(player.toBase58());
  const p: PlayerAccount | null = raw ? decodePlayer(raw.data) : null;
  const checkedInToday = !!p && p.lastCheckIn > 0 && Math.floor(p.lastCheckIn / 86_400) === today;
  const streak = p ? (checkedInToday || Math.floor(p.lastCheckIn / 86_400) === today - 1 ? p.streak : 0) : 0;

  const levels = minted.map((a) => {
    const lv = accts.get(levelPda(agentPda(a.asset)).toBase58());
    const assetInfo = accts.get(a.asset.toBase58());
    const holder = assetInfo ? coreAssetOwner(assetInfo.owner, assetInfo.data) : null;
    const d = lv ? decodeLevel(lv.data) : null;
    return { slug: a.slug, name: a.name, asset: a.asset.toBase58(), level: d?.level || 1, xp: d?.xp || 0, owned: holder === user.wallet };
  });
  const maxLevel = levels.reduce((m, l) => Math.max(m, l.level), 0);

  const questsOut = await Promise.all(quests.map(async (q) => ({
    id: q.rule.id,
    period: q.rule.period,
    goal: q.rule.goal,
    reward: q.rule.reward,
    progress: Math.min(q.rule.goal, await questProgress(user.userId, q.rule, { streak, maxLevel })),
    claimed: !!accts.get(q.pda.toBase58()),
  })));

  const boxRow = await db().select().from(progressTable).where(and(eq(progressTable.userId, user.userId), eq(progressTable.questId, "box"), eq(progressTable.periodKey, String(boxDay)))).limit(1);
  const ledgerRows = await db().select({ kind: chainLedger.kind, amount: chainLedger.amount, data: chainLedger.data, at: chainLedger.createdAt, signature: chainLedger.signature })
    .from(chainLedger).where(eq(chainLedger.userId, user.userId)).orderBy(desc(chainLedger.createdAt)).limit(60);
  const [{ n: claimedTotal }] = await db().select({ n: sql<number>`count(*)::int` }).from(chainLedger).where(and(eq(chainLedger.userId, user.userId), eq(chainLedger.kind, "claim_quest")));
  const friends = await qualifiedReferrals(user.userId);
  return {
    program: { live: status.ok, attestorReady: !!status.attestor },
    wallet: user.wallet,
    player: p ? { coins: p.coins, lifetime: p.lifetime, streak, checkedInToday, lastCheckIn: p.lastCheckIn, referrer: p.referrer } : null,
    levels,
    quests: questsOut,
    box: { day: boxDay, opened: !!accts.get(box.toBase58()), coins: boxRow[0] && accts.get(box.toBase58()) ? boxRow[0].count : null },
    referral: {
      code: user.referralCode,
      friends,
      tiers: TIER_FRIENDS.map((need, i) => ({ tier: i, friends: need, reward: TIER_REWARD[i], claimed: !!accts.get(tiers[i].toBase58()) })),
    },
    active: ledgerRows.length > 0,
    claimedTotal: Number(claimedTotal),
    /** For a first check-in: the referrer's Player account to pass to init_player. */
    referrerPlayer: p ? null : (await referrerPlayer(user.userId))?.toBase58() ?? null,
    ledger: ledgerRows.map((r) => ({ kind: r.kind, amount: Number(r.amount), at: r.at.getTime(), tx: r.signature, data: r.data as Record<string, unknown> })),
  };
}

/** The referrer's player account, if they have one, so init_player records who invited this person. */
export async function referrerPlayer(userId: string): Promise<PublicKey | null> {
  const me = await db().select({ referredBy: users.referredBy }).from(users).where(eq(users.id, userId)).limit(1);
  if (!me[0]?.referredBy) return null;
  const ref = await db().select({ wallet: users.wallet }).from(users).where(eq(users.id, me[0].referredBy)).limit(1);
  if (!ref[0]) return null;
  const pda = playerPda(new PublicKey(ref[0].wallet));
  const info = (await fetchMany([pda])).get(pda.toBase58());
  return info ? pda : null;
}
