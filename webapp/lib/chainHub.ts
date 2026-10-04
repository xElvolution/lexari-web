"use client";

import { checkInFast, claimRewardFast, levelUp, programIsLive, recentBlockhash } from "./chain";
import { friendly } from "./api";
import { MAX_LEVEL, QUESTS, STREAK_PAY, TIERS, coinsOf, levelOf, type HubAdapter } from "./hub";
import { get, hubReady, refreshHub, set, toast } from "./store";
import { ensureBridge } from "./walletBridge";

async function ready() {
  if (!get().live && !hubReady()) await refreshHub(); // never act on the empty pre-load state
  const s = get();
  if (!(await programIsLive().catch(() => false))) return { who: null, error: "Rewards open soon. The Lexari program is not live on Solana yet." };
  const who = await ensureBridge(s.auth?.address, s.auth?.wallet, s.auth?.method === "google");
  if (!who) return { who: null, error: s.auth?.method === "google" ? "Your wallet is still loading. Try again in a moment." : "Connect the wallet you signed in with first." };
  return { who, error: "" };
}

/** Show the reward now; the chain confirm and server record finish in the background (rolled back if they fail). */
function optimistic(kind: "quest" | "box" | "tier" | "checkin", key: string | number, coins: number, sig: string, settled: Promise<unknown>, what: string, streak = 0) {
  set((x) => {
    const live = x.live; if (!live) return x;
    const nowS = Math.floor(Date.now() / 1000);
    const base = live.player ?? { coins: 0, lifetime: 0, streak: 0, checkedInToday: false, lastCheckIn: 0, referrer: null };
    const player = kind === "checkin" ? { ...base, coins: base.coins + coins, lifetime: base.lifetime + coins, streak, checkedInToday: true, lastCheckIn: nowS }
      : live.player ? { ...live.player, coins: live.player.coins + coins, lifetime: live.player.lifetime + coins } : live.player;
    return {
      ...x, bond: { ...x.bond, coins: (player?.coins ?? x.bond.coins) },
      live: {
        ...live, player,
        quests: kind === "quest" ? live.quests.map((q) => (q.id === key ? { ...q, claimed: true } : q)) : live.quests,
        box: kind === "box" ? { ...live.box, opened: true, coins } : live.box,
        referral: kind === "tier" ? { ...live.referral, tiers: live.referral.tiers.map((t) => (t.tier === key ? { ...t, claimed: true } : t)) } : live.referral,
        ledger: [{ kind: kind === "quest" ? "claim_quest" : kind === "box" ? "open_box" : kind === "checkin" ? "check_in" : "claim_referral_tier", amount: coins, at: Date.now(), tx: sig, data: {} }, ...live.ledger],
      },
    };
  });
  settled.catch((e) => { void refreshHub(); toast({ text: friendly(e, `${what} didn't go through on Solana. Your coins were not added.`), face: "home" }); });
}

export const chainHub: HubAdapter = {
  async checkIn() {
    const r = await ready();
    if (!r.who) return { ok: false, coins: 0, day: 0, error: r.error };
    const s = get();
    if (s.live?.player?.checkedInToday) return { ok: false, coins: 0, day: s.live.player.streak, error: "You already checked in today." };
    try {
      // the streak the program will compute: +1 after yesterday, otherwise a fresh start
      const p = s.live?.player;
      const today = Math.floor(Date.now() / 86_400_000);
      const streak = p && p.lastCheckIn > 0 && Math.floor(p.lastCheckIn / 86_400) === today - 1 ? p.streak + 1 : 1;
      const coins = STREAK_PAY[Math.min(STREAK_PAY.length, streak) - 1];
      const res = await checkInFast(r.who, s.live);
      optimistic("checkin", 0, coins, res.sig, res.settled, "Your check-in", streak);
      return { ok: true, coins, day: streak };
    } catch (e) {
      void refreshHub();
      return { ok: false, coins: 0, day: 0, error: friendly(e, "Check-in failed.") };
    }
  },
  async claimQuest(id) {
    const r = await ready();
    if (!r.who) return { ok: false, coins: 0, error: r.error };
    if (!QUESTS.some((q) => q.id === id)) return { ok: false, coins: 0, error: "Unknown quest." };
    try {
      const res = await claimRewardFast(r.who, { kind: "quest", questId: id });
      optimistic("quest", id, res.coins, res.sig, res.settled, "That claim");
      return { ok: true, coins: res.coins };
    } catch (e) {
      void refreshHub();
      return { ok: false, coins: 0, error: friendly(e, "Quest claim failed.") };
    }
  },
  async train(agent, amount) {
    const r = await ready();
    const s = get();
    const cur = levelOf(s, agent);
    if (!r.who) return { ok: false, levelsGained: 0, level: cur.level, error: r.error };
    const asset = s.live?.levels.find((l) => l.slug === agent)?.asset || s.meta[agent]?.nft?.tokenId;
    if (!asset) return { ok: false, levelsGained: 0, level: cur.level, error: "Mint this agent's ID card first. Tap the agent in chat to open its ID card." };
    if (cur.level >= MAX_LEVEL) return { ok: false, levelsGained: 0, level: cur.level, error: "This agent is already at the top level." };
    const spend = Math.min(Math.floor(amount), coinsOf(s));
    if (spend <= 0) return { ok: false, levelsGained: 0, level: cur.level, error: "Not enough coins." };
    try {
      const res = await levelUp(r.who, asset, spend);
      const after = res.state.levels.find((l) => l.slug === agent)?.level ?? cur.level;
      return { ok: true, levelsGained: Math.max(0, after - cur.level), level: after };
    } catch (e) {
      void refreshHub();
      return { ok: false, levelsGained: 0, level: cur.level, error: friendly(e, "Level up failed.") };
    }
  },
  async claimTier(i) {
    const r = await ready();
    if (!r.who) return { ok: false, coins: 0, error: r.error };
    if (!TIERS[i]) return { ok: false, coins: 0, error: "Unknown tier." };
    try {
      const res = await claimRewardFast(r.who, { kind: "tier", tier: i });
      optimistic("tier", i, res.coins, res.sig, res.settled, "That reward");
      return { ok: true, coins: res.coins };
    } catch (e) {
      void refreshHub();
      return { ok: false, coins: 0, error: friendly(e, "Referral claim failed.") };
    }
  },
  async openBox() {
    const r = await ready();
    if (!r.who) return { ok: false, coins: 0, error: r.error };
    try {
      const res = await claimRewardFast(r.who, { kind: "box" });
      optimistic("box", 0, res.coins, res.sig, res.settled, "The box");
      return { ok: true, coins: res.coins };
    } catch (e) {
      void refreshHub();
      return { ok: false, coins: 0, error: friendly(e, "The box could not be opened.") };
    }
  },
  async invite() {
    throw new Error("Friends join when they sign up with your invite link.");
  },
};

// Warm the "is the program live" check so the first tap doesn't wait on it.
if (typeof window !== "undefined") setTimeout(() => { void programIsLive().catch(() => {}); void recentBlockhash().catch(() => {}); }, 1500);
