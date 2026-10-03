import { PublicKey } from "@solana/web3.js";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { agents, chainLedger, questProgress as progressTable } from "../db/schema";
import {
  TIER_FRIENDS, TIER_REWARD, agentPda, boxClaimPda, coreAssetOwner, decodeLevel, decodePlayer, levelPda, playerPda, questClaimPda, tierClaimPda,
  type PlayerAccount,
} from "@/lib/lexari-ix";
import { QUEST_RULES, periodNumber } from "./catalog";
import { fetchMany, programStatus, utcDay } from "./chain";
import { qualifiedReferrals, questProgress } from "./rules";

export type HubState = Awaited<ReturnType<typeof hubState>>;

/** Everything the Hub shows, from chain accounts and server records. */
export async function hubState(user: { userId: string; wallet: string; referralCode: string }) {
  const owner = new PublicKey(user.wallet);
  const player = playerPda(owner);
  const today = utcDay();
  const rows = await db().select().from(agents).where(and(eq(agents.userId, user.userId), isNotNull(agents.asset)));
  const minted = rows.filter((a) => a.asset).map((a) => ({ slug: a.slug, name: a.name, asset: new PublicKey(a.asset!) }));
  const quests = QUEST_RULES.map((rule) => ({ rule, period: periodNumber(rule.period), pda: questClaimPda(player, rule.chainId, periodNumber(rule.period)) }));
  const tiers = TIER_FRIENDS.map((_, i) => tierClaimPda(player, i));
  const box = boxClaimPda(player, today);
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

  const boxRow = await db().select().from(progressTable).where(and(eq(progressTable.userId, user.userId), eq(progressTable.questId, "box"), eq(progressTable.periodKey, String(today)))).limit(1);
  const lifetimeLedger = await db().select({ kind: chainLedger.kind }).from(chainLedger).where(eq(chainLedger.userId, user.userId)).limit(1);
  const friends = await qualifiedReferrals(user.userId);
  return {
    program: { live: status.ok, attestorReady: !!status.attestor },
    wallet: user.wallet,
    player: p ? { coins: p.coins, lifetime: p.lifetime, streak, checkedInToday, lastCheckIn: p.lastCheckIn, referrer: p.referrer } : null,
    levels,
    quests: questsOut,
    box: { day: today, opened: !!accts.get(box.toBase58()), coins: boxRow[0] && accts.get(box.toBase58()) ? boxRow[0].count : null },
    referral: {
      code: user.referralCode,
      friends,
      tiers: TIER_FRIENDS.map((need, i) => ({ tier: i, friends: need, reward: TIER_REWARD[i], claimed: !!accts.get(tiers[i].toBase58()) })),
    },
    active: lifetimeLedger.length > 0,
  };
}
