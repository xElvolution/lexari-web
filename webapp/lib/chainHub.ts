"use client";

import { checkIn, claimReward, levelUp, programIsLive } from "./chain";
import { friendly } from "./api";
import { MAX_LEVEL, QUESTS, TIERS, coinsOf, levelOf, type HubAdapter } from "./hub";
import { get, refreshHub } from "./store";
import { ensureBridge } from "./walletBridge";

async function ready() {
  const s = get();
  if (!(await programIsLive().catch(() => false))) return { who: null, error: "Rewards open soon. The Lexari program is not live on Solana yet." };
  const who = await ensureBridge(s.auth?.address, s.auth?.wallet);
  if (!who) return { who: null, error: s.auth?.method === "google" ? "Your wallet is still loading. Try again in a moment." : "Connect the wallet you signed in with first." };
  return { who, error: "" };
}

export const chainHub: HubAdapter = {
  async checkIn() {
    const r = await ready();
    if (!r.who) return { ok: false, coins: 0, day: 0, error: r.error };
    const s = get();
    if (s.live?.player?.checkedInToday) return { ok: false, coins: 0, day: s.live.player.streak, error: "You already checked in today." };
    try {
      const before = coinsOf(s);
      const res = await checkIn(r.who, s.live);
      const p = res.state.player;
      return { ok: true, coins: Math.max(0, (p?.coins ?? 0) - before), day: p?.streak ?? 1 };
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
      const res = await claimReward(r.who, { kind: "quest", questId: id });
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
      const res = await claimReward(r.who, { kind: "tier", tier: i });
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
      const res = await claimReward(r.who, { kind: "box" });
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
