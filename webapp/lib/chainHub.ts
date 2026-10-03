"use client";

import { Connection, PublicKey } from "@solana/web3.js";
import { SOLANA_RPC } from "./nft";
import {
  boxTransaction, checkInOnchain, levelUpOnchain, playerPda, programIsLive,
  questTransaction, readPlayer, registryAsset, sendCoSigned, tierTransaction,
} from "./chain";
import { QUEST_RULES, TIER_REWARD, periodNumber } from "@/server/hub/catalog";
import { MAX_LEVEL, QUESTS, STREAK_PAY, TIERS, coinsOf, hubOf, levelOf, periodKey, xpFor, type HubAdapter, type HubData } from "./hub";
import { get, set, todayKey } from "./store";
import { walletBridge } from "./walletBridge";

const connection = () => new Connection(SOLANA_RPC, "confirmed");

function payer() {
  const bridge = walletBridge();
  if (!bridge?.publicKey || !bridge.signTransaction) return null;
  return { publicKey: bridge.publicKey, signTransaction: bridge.signTransaction };
}

async function live() {
  const who = payer();
  if (!who) return { who: null, error: "Connect a Solana wallet first." };
  if (!(await programIsLive(connection()))) return { who, error: "The Lexari program is not on devnet yet." };
  return { who, error: "" };
}

async function attestor() {
  const res = await fetch("/api/hub/attestor");
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.attestor !== "string") throw new Error(typeof data.error === "string" ? data.error : "The attestor key is not set.");
  return new PublicKey(data.attestor);
}

function mirrorCoins(coins: number, days?: string[], hub?: Partial<HubData>) {
  set((s) => ({
    ...s,
    hub: { ...hubOf(s), ...hub },
    bond: { ...(s.bond || { days: [], coins: 0, claimed: [] }), coins, days: days ?? (s.bond?.days || []) },
  }));
}

export const chainHub: HubAdapter = {
  async checkIn(now = Date.now()) {
    const ready = await live();
    if (!ready.who) return { ok: false, coins: 0, day: 0, error: ready.error };
    try {
      await checkInOnchain(connection(), ready.who);
      const info = await connection().getAccountInfo(playerPda(ready.who.publicKey));
      const row = info ? readPlayer(info.data) : { coins: coinsOf(get()), streak: 1 };
      const dayKey = todayKey(now);
      const days = Array.from(new Set([...(get().bond?.days || []), dayKey]));
      const pay = STREAK_PAY[Math.min(STREAK_PAY.length, row.streak) - 1] ?? STREAK_PAY[0];
      mirrorCoins(row.coins, days, { lifetime: Math.max(hubOf(get()).lifetime, row.coins) });
      return { ok: true, coins: pay, day: row.streak };
    } catch (error) {
      return { ok: false, coins: 0, day: 0, error: (error as Error).message || "Check-in failed." };
    }
  },
  async claimQuest(id, now = Date.now()) {
    const ready = await live();
    if (!ready.who) return { ok: false, coins: 0, error: ready.error };
    const rule = QUEST_RULES.find((q) => q.id === id);
    const view = QUESTS.find((q) => q.id === id);
    if (!rule || !view) return { ok: false, coins: 0, error: "Unknown quest." };
    try {
      const who = await attestor();
      const period = periodNumber(rule.period, new Date(now));
      await sendCoSigned(connection(), ready.who, questTransaction(ready.who.publicKey, who, rule.chainId, period, rule.reward));
      const key = `${id}@${periodKey(view.period, now)}`;
      const info = await connection().getAccountInfo(playerPda(ready.who.publicKey));
      const coins = info ? readPlayer(info.data).coins : coinsOf(get()) + rule.reward;
      mirrorCoins(coins, undefined, { claimed: [...hubOf(get()).claimed, key] });
      return { ok: true, coins: rule.reward };
    } catch (error) {
      return { ok: false, coins: 0, error: (error as Error).message || "Quest claim failed." };
    }
  },
  async train(agent, amount) {
    const ready = await live();
    if (!ready.who) return { ok: false, levelsGained: 0, level: 1, error: ready.error };
    const state = get();
    const assetId = agent === "home" ? registryAsset(state.meta) : state.meta[agent]?.nft?.tokenId;
    if (!assetId) return { ok: false, levelsGained: 0, level: levelOf(state, agent).level, error: "Mint this agent on devnet before training it." };
    const cur = levelOf(state, agent);
    if (cur.level >= MAX_LEVEL) return { ok: false, levelsGained: 0, level: cur.level, error: "This agent is already at the top level." };
    const spend = Math.min(Math.floor(amount), coinsOf(state));
    if (spend <= 0) return { ok: false, levelsGained: 0, level: cur.level, error: "Not enough coins." };
    try {
      await levelUpOnchain(connection(), ready.who, new PublicKey(assetId), spend);
      let { level, xp } = cur;
      xp += spend;
      let gained = 0;
      while (level < MAX_LEVEL && xp >= xpFor(level)) { xp -= xpFor(level); level++; gained++; }
      if (level >= MAX_LEVEL) xp = 0;
      const info = await connection().getAccountInfo(playerPda(ready.who.publicKey));
      const coins = info ? readPlayer(info.data).coins : Math.max(0, coinsOf(state) - spend);
      mirrorCoins(coins, undefined, { levels: { ...hubOf(state).levels, [agent]: { level, xp, at: Date.now() } } });
      return { ok: true, levelsGained: gained, level };
    } catch (error) {
      return { ok: false, levelsGained: 0, level: cur.level, error: (error as Error).message || "Level up failed." };
    }
  },
  async claimTier(i) {
    const ready = await live();
    if (!ready.who) return { ok: false, coins: 0, error: ready.error };
    const tier = TIERS[i];
    if (!tier) return { ok: false, coins: 0, error: "Unknown tier." };
    try {
      const who = await attestor();
      await sendCoSigned(connection(), ready.who, tierTransaction(ready.who.publicKey, who, i));
      const info = await connection().getAccountInfo(playerPda(ready.who.publicKey));
      const coins = info ? readPlayer(info.data).coins : coinsOf(get()) + TIER_REWARD[i];
      mirrorCoins(coins, undefined, { tiers: [...hubOf(get()).tiers, i] });
      return { ok: true, coins: tier.reward };
    } catch (error) {
      return { ok: false, coins: 0, error: (error as Error).message || "Referral claim failed." };
    }
  },
  async openBox(now = Date.now()) {
    const ready = await live();
    if (!ready.who) return { ok: false, coins: 0, error: ready.error };
    try {
      const rollRes = await fetch("/api/hub/box", { method: "POST" });
      const roll = await rollRes.json().catch(() => ({}));
      if (!rollRes.ok) throw new Error(typeof roll.error === "string" ? roll.error : "Could not roll the box.");
      const who = await attestor();
      await sendCoSigned(connection(), ready.who, boxTransaction(ready.who.publicKey, who, roll.day, roll.coins));
      const key = todayKey(now);
      const info = await connection().getAccountInfo(playerPda(ready.who.publicKey));
      const coins = info ? readPlayer(info.data).coins : coinsOf(get()) + roll.coins;
      const hub = hubOf(get());
      mirrorCoins(coins, undefined, {
        boxes: [...hub.boxes, key],
        ledger: [{ at: Date.now(), delta: roll.coins, reason: "Mystery box" }, ...hub.ledger].slice(0, 80),
      });
      return { ok: true, coins: roll.coins };
    } catch (error) {
      return { ok: false, coins: 0, error: (error as Error).message || "The box could not be opened." };
    }
  },
  async invite() {
    throw new Error("Friends join when they sign up with your code.");
  },
};

