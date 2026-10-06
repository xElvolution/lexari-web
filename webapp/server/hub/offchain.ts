/**
 * The Hub without Solana: coins, streaks, agent levels and one-time claims are database rows.
 * Every action runs in one transaction with the player row locked, so double taps and races can't pay twice;
 * a one-time reward is a row in hub_claims (primary key = idempotency). Rewards follow the same rules as the program did.
 * Each person's row is seeded once from their onchain Player and Level accounts, so balances carry over.
 */
import { randomUUID } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { agents, chainLedger, hubClaims, hubLevels, hubPlayers } from "../db/schema";
import { HttpError } from "../http";
import { recordEvent } from "../events";
import {
  STREAK_PAY, TIER_FRIENDS, TIER_REWARD, agentPda, boxClaimPda, decodeLevel, decodePlayer, levelPda, playerPda, questClaimPda, tierClaimPda,
} from "@/lib/lexari-ix";
import { QUEST_RULES, periodNumber } from "./catalog";
import { fetchMany, utcDay } from "./chain";
import { boxRoll } from "./claims";
import { boxDayFor } from "./state";
import { qualifiedReferrals, questProgress } from "./rules";

type User = { userId: string; wallet: string; referralCode: string };
export const MAX_LEVEL = 10;
export const xpFor = (level: number) => 60 + (level - 1) * 40;
const questKey = (id: string, period: "daily" | "weekly" | "hard") => `quest:${id}:${periodNumber(period)}`;

const seeded = new Set<string>();
/** Creates the person's Hub row the first time, copying coins, streak, levels and claims from their onchain accounts. */
export async function ensurePlayer(user: User) {
  if (seeded.has(user.userId)) return;
  const database = db();
  const have = await database.select({ id: hubPlayers.userId }).from(hubPlayers).where(eq(hubPlayers.userId, user.userId)).limit(1);
  if (have[0]) { seeded.add(user.userId); return; }
  let coins = 0, lifetime = 0, streak = 0, lastCheckIn = 0, from = "new";
  const levels: { slug: string; level: number; xp: number }[] = [];
  const claims: string[] = [];
  try {
    const owner = new PublicKey(user.wallet);
    const player = playerPda(owner);
    const rows = await database.select({ slug: agents.slug, asset: agents.asset }).from(agents).where(eq(agents.userId, user.userId));
    const minted = rows.filter((r) => r.asset).map((r) => ({ slug: r.slug, asset: new PublicKey(r.asset!) }));
    const today = utcDay();
    const boxDay = await boxDayFor(user.userId, today);
    const quests = QUEST_RULES.map((q) => ({ q, pda: questClaimPda(player, q.chainId, periodNumber(q.period)) }));
    const tiers = TIER_FRIENDS.map((_, i) => tierClaimPda(player, i));
    const box = boxClaimPda(player, boxDay);
    const accts = await fetchMany([player, box, ...quests.map((x) => x.pda), ...tiers, ...minted.map((a) => levelPda(agentPda(a.asset)))]);
    const raw = accts.get(player.toBase58());
    const p = raw ? decodePlayer(raw.data) : null;
    if (p) { coins = Number(p.coins); lifetime = Number(p.lifetime); streak = p.streak; lastCheckIn = Number(p.lastCheckIn); from = "chain"; }
    for (const a of minted) { const d = accts.get(levelPda(agentPda(a.asset)).toBase58()); const lv = d ? decodeLevel(d.data) : null; if (lv && (lv.level > 1 || lv.xp > 0)) levels.push({ slug: a.slug, level: lv.level, xp: lv.xp }); }
    for (const x of quests) if (accts.get(x.pda.toBase58())) claims.push(questKey(x.q.id, x.q.period));
    tiers.forEach((t, i) => { if (accts.get(t.toBase58())) claims.push(`tier:${i}`); });
    if (accts.get(box.toBase58())) claims.push(`box:${boxDay}`);
    if (p && lastCheckIn > 0 && Math.floor(lastCheckIn / 86_400) === today) claims.push(`checkin:${today}`);
  } catch (e) {
    // The chain read failed: don't create a zero row that would hide real coins. Try again on the next request.
    console.error("[hub] seed from chain failed", (e as Error).message);
    throw new HttpError(503, "Your coins are still loading. Try again in a moment.");
  }
  await database.transaction(async (tx) => {
    const ins = await tx.insert(hubPlayers).values({ userId: user.userId, coins, lifetime, streak, lastCheckIn, seededFrom: from }).onConflictDoNothing().returning({ id: hubPlayers.userId });
    if (!ins.length) return;
    if (levels.length) await tx.insert(hubLevels).values(levels.map((l) => ({ userId: user.userId, ...l }))).onConflictDoNothing();
    if (claims.length) await tx.insert(hubClaims).values(claims.map((key) => ({ userId: user.userId, key }))).onConflictDoNothing();
  });
  seeded.add(user.userId);
}

function streakNow(p: { streak: number; lastCheckIn: number }, today = utcDay()) {
  const last = p.lastCheckIn > 0 ? Math.floor(p.lastCheckIn / 86_400) : -10;
  return last >= today - 1 ? p.streak : 0;
}

/** Everything the Hub shows, from the database (same shape the app used with the chain). */
export async function offchainState(user: User) {
  await ensurePlayer(user);
  const database = db();
  const today = utcDay();
  const [[p], levelRows, agentRows, claimRows, boxDay, friends, ledgerRows, [{ n: claimedTotal }]] = await Promise.all([
    database.select().from(hubPlayers).where(eq(hubPlayers.userId, user.userId)).limit(1),
    database.select().from(hubLevels).where(eq(hubLevels.userId, user.userId)),
    database.select({ slug: agents.slug, name: agents.name, asset: agents.asset, kind: agents.kind }).from(agents).where(eq(agents.userId, user.userId)),
    database.select({ key: hubClaims.key, coins: hubClaims.coins }).from(hubClaims).where(eq(hubClaims.userId, user.userId)),
    boxDayFor(user.userId, today),
    qualifiedReferrals(user.userId),
    database.select({ kind: chainLedger.kind, amount: chainLedger.amount, data: chainLedger.data, at: chainLedger.createdAt, signature: chainLedger.signature })
      .from(chainLedger).where(eq(chainLedger.userId, user.userId)).orderBy(desc(chainLedger.createdAt)).limit(60),
    database.select({ n: sql<number>`count(*)::int` }).from(chainLedger).where(and(eq(chainLedger.userId, user.userId), eq(chainLedger.kind, "claim_quest"))),
  ]);
  const claimed = new Map(claimRows.map((c) => [c.key, c.coins]));
  const streak = p ? streakNow(p, today) : 0;
  const checkedInToday = claimed.has(`checkin:${today}`) || (!!p && p.lastCheckIn > 0 && Math.floor(p.lastCheckIn / 86_400) === today);
  const lv = new Map(levelRows.map((l) => [l.slug, l]));
  const levels = agentRows.filter((a) => a.kind === "home" || a.kind === "custom").map((a) => ({ slug: a.slug, name: a.name, asset: a.asset ?? "", level: lv.get(a.slug)?.level ?? 1, xp: lv.get(a.slug)?.xp ?? 0, owned: true }));
  const maxLevel = levels.reduce((m, l) => Math.max(m, l.level), 0);
  const quests = await Promise.all(QUEST_RULES.map(async (rule) => ({
    id: rule.id, period: rule.period, goal: rule.goal, reward: rule.reward,
    progress: Math.min(rule.goal, await questProgress(user.userId, rule, { streak, maxLevel })),
    claimed: claimed.has(questKey(rule.id, rule.period)),
  })));
  const boxKey = `box:${boxDay}`;
  return {
    program: { live: true, attestorReady: true },
    wallet: user.wallet,
    player: p ? { coins: Number(p.coins), lifetime: Number(p.lifetime), streak, checkedInToday, lastCheckIn: Number(p.lastCheckIn), referrer: null as string | null } : null,
    levels,
    quests,
    box: { day: boxDay, opened: claimed.has(boxKey), coins: claimed.has(boxKey) ? claimed.get(boxKey) ?? null : null },
    referral: { code: user.referralCode, friends, tiers: TIER_FRIENDS.map((need, i) => ({ tier: i, friends: need, reward: TIER_REWARD[i], claimed: claimed.has(`tier:${i}`) })) },
    active: ledgerRows.length > 0,
    claimedTotal: Number(claimedTotal),
    referrerPlayer: null as string | null,
    cosmetics: (p?.cosmetics ?? {}) as { owned?: string[]; bg?: string; bubble?: string },
    ledger: ledgerRows.map((r) => ({ kind: r.kind, amount: Number(r.amount), at: r.at.getTime(), tx: r.signature, data: r.data as Record<string, unknown> })),
  };
}

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];
/** Locks the person's row, runs `fn`, and writes a ledger line. A unique claim key makes it pay once. */
async function act<T>(user: User, kind: string, fn: (tx: Tx, p: typeof hubPlayers.$inferSelect) => Promise<{ delta: number; earned?: boolean; claim?: string; data?: Record<string, unknown>; out: T }>) {
  await ensurePlayer(user);
  const sig = `off:${randomUUID()}`;
  return db().transaction(async (tx) => {
    const [p] = await tx.select().from(hubPlayers).where(eq(hubPlayers.userId, user.userId)).for("update");
    if (!p) throw new HttpError(503, "Your coins are still loading. Try again in a moment.");
    const r = await fn(tx, p);
    if (r.claim) {
      const ok = await tx.insert(hubClaims).values({ userId: user.userId, key: r.claim, coins: Math.abs(r.delta) }).onConflictDoNothing().returning({ k: hubClaims.key });
      if (!ok.length) throw new HttpError(409, "You already claimed this one.");
    }
    if (r.delta < 0 && Number(p.coins) + r.delta < 0) throw new HttpError(400, "Not enough coins.");
    await tx.update(hubPlayers).set({
      coins: sql`${hubPlayers.coins} + ${r.delta}`,
      ...(r.earned !== false && r.delta > 0 ? { lifetime: sql`${hubPlayers.lifetime} + ${r.delta}` } : {}),
      updatedAt: new Date(),
    }).where(eq(hubPlayers.userId, user.userId));
    await tx.insert(chainLedger).values({ signature: sig, ixIndex: 0, userId: user.userId, kind, amount: Math.abs(r.delta), data: r.data ?? {} });
    return { ...r.out, coins: Number(p.coins) + r.delta, tx: sig };
  });
}

export async function checkIn(user: User) {
  const today = utcDay();
  const res = await act(user, "check_in", async (tx, p) => {
    const last = p.lastCheckIn > 0 ? Math.floor(Number(p.lastCheckIn) / 86_400) : -10;
    if (last >= today) throw new HttpError(409, "You already checked in today.");
    const streak = last === today - 1 ? p.streak + 1 : 1;
    const pay = STREAK_PAY[Math.min(STREAK_PAY.length, streak) - 1];
    await tx.update(hubPlayers).set({ streak, lastCheckIn: Math.floor(Date.now() / 1000) }).where(eq(hubPlayers.userId, user.userId));
    return { delta: pay, claim: `checkin:${today}`, data: { streak }, out: { pay, day: streak } };
  });
  void recordEvent(user.userId, "checkin", { ref: res.tx });
  return res;
}

export async function claimQuest(user: User, questId: string) {
  const rule = QUEST_RULES.find((q) => q.id === questId);
  if (!rule) throw new HttpError(404, "There is no such quest.");
  const [p] = await db().select().from(hubPlayers).where(eq(hubPlayers.userId, user.userId)).limit(1);
  let maxLevel = 0;
  if (rule.count === "level" && rule.period === "hard") {
    const [r] = await db().select({ m: sql<number>`coalesce(max(${hubLevels.level}), 1)::int` }).from(hubLevels).where(eq(hubLevels.userId, user.userId));
    maxLevel = Number(r?.m ?? 1);
  }
  const progress = await questProgress(user.userId, rule, { streak: p ? streakNow(p) : 0, maxLevel });
  if (progress < rule.goal) throw new HttpError(400, "That quest is not finished yet.");
  return act(user, "claim_quest", async () => ({ delta: rule.reward, claim: questKey(rule.id, rule.period), data: { questId: rule.chainId, quest: rule.id, period: periodNumber(rule.period), coins: rule.reward }, out: { reward: rule.reward } }));
}

export async function openBox(user: User) {
  const day = await boxDayFor(user.userId, utcDay());
  const roll = await boxRoll(user.userId, day);
  const res = await act(user, "open_box", async () => ({ delta: roll, claim: `box:${day}`, data: { day, coins: roll }, out: { won: roll } }));
  void recordEvent(user.userId, "box", { ref: res.tx });
  return res;
}

export async function claimTier(user: User, tier: number) {
  if (!TIER_FRIENDS[tier]) throw new HttpError(404, "There is no such tier.");
  const friends = await qualifiedReferrals(user.userId);
  if (friends < TIER_FRIENDS[tier]) throw new HttpError(400, "Not enough friends have joined with your code yet.");
  return act(user, "claim_referral_tier", async () => ({ delta: TIER_REWARD[tier], claim: `tier:${tier}`, data: { tier }, out: { reward: TIER_REWARD[tier] } }));
}

/** Spends coins as XP on one of your agents (same rule as the program: carry XP over levels, never past the top). */
export async function train(user: User, slug: string, amount: number) {
  const spendReq = Math.floor(amount);
  if (!(spendReq > 0)) throw new HttpError(400, "Pick an amount of XP.");
  const [a] = await db().select({ kind: agents.kind }).from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, slug), inArray(agents.kind, ["home", "custom"]))).limit(1);
  if (!a) throw new HttpError(404, "Only agents you made can level up.");
  const res = await act(user, "level_up", async (tx, p) => {
    const [cur] = await tx.select().from(hubLevels).where(and(eq(hubLevels.userId, user.userId), eq(hubLevels.slug, slug))).limit(1);
    let lv = cur?.level ?? 1, xp = cur?.xp ?? 0;
    if (lv >= MAX_LEVEL) throw new HttpError(400, "This agent is already at the top level.");
    let need = 0; for (let l = lv; l < MAX_LEVEL; l++) need += xpFor(l);
    const spend = Math.min(spendReq, need - xp, Number(p.coins));
    if (spend <= 0) throw new HttpError(400, "Not enough coins.");
    const before = lv;
    xp += spend;
    while (lv < MAX_LEVEL && xp >= xpFor(lv)) { xp -= xpFor(lv); lv++; }
    if (lv >= MAX_LEVEL) xp = 0;
    await tx.insert(hubLevels).values({ userId: user.userId, slug, level: lv, xp }).onConflictDoUpdate({ target: [hubLevels.userId, hubLevels.slug], set: { level: lv, xp, updatedAt: new Date() } });
    return { delta: -spend, data: { slug, coins: spend, levelBefore: before, levelAfter: lv }, out: { level: lv, xp, gained: lv - before, spent: spend } };
  });
  // Written before answering, so the Hub's next read already shows the weekly "Level up" quest moved.
  if (res.gained > 0) await recordEvent(user.userId, "level", { ref: res.tx, amount: res.gained }).catch((e) => console.error("[hub] level event", (e as Error).message));
  return res;
}

/* ---------- store: cosmetics bought with coins ---------- */
export const STORE: { id: string; kind: "bg" | "bubble"; price: number }[] = [
  { id: "bg-aurora", kind: "bg", price: 120 },
  { id: "bg-grid", kind: "bg", price: 80 },
  { id: "bg-sunset", kind: "bg", price: 150 },
  { id: "bg-stars", kind: "bg", price: 200 },
  { id: "bubble-glass", kind: "bubble", price: 90 },
  { id: "bubble-neon", kind: "bubble", price: 140 },
  { id: "bubble-candy", kind: "bubble", price: 110 },
  { id: "bg-lavender", kind: "bg", price: 60 },
  { id: "bg-dots", kind: "bg", price: 70 },
  { id: "bg-pinstripe", kind: "bg", price: 100 },
  { id: "bg-ripple", kind: "bg", price: 130 },
  { id: "bg-deepsea", kind: "bg", price: 170 },
  { id: "bg-velvet", kind: "bg", price: 240 },
  { id: "bubble-outline", kind: "bubble", price: 60 },
  { id: "bubble-midnight", kind: "bubble", price: 70 },
  { id: "bubble-lilac", kind: "bubble", price: 100 },
  { id: "bubble-mint", kind: "bubble", price: 120 },
  { id: "bubble-sunset", kind: "bubble", price: 160 },
  { id: "bubble-gold", kind: "bubble", price: 220 },
];
export async function buy(user: User, item: string) {
  const it = STORE.find((x) => x.id === item);
  if (!it) throw new HttpError(404, "That item isn't in the store.");
  return act(user, "store_buy", async (tx, p) => {
    const cos = { ...(p.cosmetics || {}) };
    if (cos.owned?.includes(it.id)) throw new HttpError(409, "You already own this.");
    cos.owned = [...(cos.owned || []), it.id];
    cos[it.kind] = it.id; // wear it right away
    await tx.update(hubPlayers).set({ cosmetics: cos }).where(eq(hubPlayers.userId, user.userId));
    return { delta: -it.price, claim: `store:${it.id}`, data: { item: it.id, coins: it.price }, out: { cosmetics: cos } };
  });
}
export async function applyCosmetic(user: User, kind: "bg" | "bubble", item: string | null) {
  await ensurePlayer(user);
  const database = db();
  const [p] = await database.select({ cosmetics: hubPlayers.cosmetics }).from(hubPlayers).where(eq(hubPlayers.userId, user.userId)).limit(1);
  const cos = { ...(p?.cosmetics || {}) };
  if (item && (!cos.owned?.includes(item) || !STORE.some((x) => x.id === item && x.kind === kind))) throw new HttpError(400, "Buy it first.");
  if (item) cos[kind] = item; else delete cos[kind];
  await database.update(hubPlayers).set({ cosmetics: cos, updatedAt: new Date() }).where(eq(hubPlayers.userId, user.userId));
  return { cosmetics: cos };
}
