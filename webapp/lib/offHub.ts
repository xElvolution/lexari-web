"use client";

import { api, friendly } from "./api";
import { MAX_LEVEL, QUESTS, STREAK_PAY, TIERS, coinsOf, levelOf, xpFor, type HubAdapter } from "./hub";
import { get, patchHub, refreshHub } from "./store";
import type { HubState } from "@/server/hub/state";

/**
 * The Hub, offchain: every action changes the screen at once (coins, streak, XP bar), then the server records it.
 * If the server says no, the screen goes back to the server's numbers and the caller shows why.
 */
const post = <T,>(body: Record<string, unknown>) => api<T>("/api/hub/act", { body });
const ledgerLine = (kind: string, amount: number, data: Record<string, unknown> = {}) => ({ kind, amount, at: Date.now(), tx: `local:${Date.now()}:${Math.random()}`, data });
function undo() { void refreshHub(); }
const withCoins = (l: HubState, d: number, earned = d > 0): HubState => (l.player ? { ...l, player: { ...l.player, coins: Math.max(0, l.player.coins + d), lifetime: l.player.lifetime + (earned ? d : 0) } } : l);

export const offHub: HubAdapter = {
  async checkIn() {
    const s = get();
    const p = s.live?.player;
    if (p?.checkedInToday) return { ok: false, coins: 0, day: p.streak, error: "You already checked in today." };
    const today = Math.floor(Date.now() / 86_400_000);
    const streak = p && p.lastCheckIn > 0 && Math.floor(p.lastCheckIn / 86_400) === today - 1 ? p.streak + 1 : 1;
    const pay = STREAK_PAY[Math.min(STREAK_PAY.length, streak) - 1];
    patchHub((l) => { const w = withCoins(l, pay); return { ...w, player: w.player ? { ...w.player, streak, checkedInToday: true, lastCheckIn: Math.floor(Date.now() / 1000) } : { coins: pay, lifetime: pay, streak, checkedInToday: true, lastCheckIn: Math.floor(Date.now() / 1000), referrer: null }, ledger: [ledgerLine("check_in", pay), ...w.ledger] }; });
    try {
      const r = await post<{ pay: number; day: number }>({ action: "checkin" });
      void refreshHub();
      return { ok: true, coins: r.pay, day: r.day };
    } catch (e) { undo(); return { ok: false, coins: 0, day: 0, error: friendly(e, "Check-in failed.") }; }
  },
  async claimQuest(id) {
    const q = QUESTS.find((x) => x.id === id);
    if (!q) return { ok: false, coins: 0, error: "Unknown quest." };
    const lq = get().live?.quests.find((x) => x.id === id);
    if (lq?.claimed) return { ok: false, coins: 0, error: "You already claimed this one." };
    patchHub((l) => { const w = withCoins(l, q.reward); return { ...w, claimedTotal: w.claimedTotal + 1, quests: w.quests.map((x) => (x.id === id ? { ...x, claimed: true } : x)), ledger: [ledgerLine("claim_quest", q.reward), ...w.ledger] }; });
    try {
      const r = await post<{ reward: number }>({ action: "quest", questId: id });
      void refreshHub();
      return { ok: true, coins: r.reward };
    } catch (e) { undo(); return { ok: false, coins: 0, error: friendly(e, "Quest claim failed.") }; }
  },
  async train(agent, amount) {
    const s = get();
    const cur = levelOf(s, agent);
    if (cur.level >= MAX_LEVEL) return { ok: false, levelsGained: 0, level: cur.level, error: "This agent is already at the top level." };
    // same rule as the server: never spend past the top level, carry XP over levels
    let need = 0; for (let l = cur.level; l < MAX_LEVEL; l++) need += xpFor(l);
    const spend = Math.min(Math.floor(amount), coinsOf(s), need - cur.xp);
    if (spend <= 0) return { ok: false, levelsGained: 0, level: cur.level, error: "Not enough coins. Do a quest first." };
    let lv = cur.level, xp = cur.xp + spend;
    while (lv < MAX_LEVEL && xp >= xpFor(lv)) { xp -= xpFor(lv); lv++; }
    if (lv >= MAX_LEVEL) xp = 0;
    patchHub((l) => { const w = withCoins(l, -spend, false); return { ...w, levels: w.levels.some((x) => x.slug === agent) ? w.levels.map((x) => (x.slug === agent ? { ...x, level: lv, xp } : x)) : [...w.levels, { slug: agent, name: agent, asset: "", level: lv, xp, owned: true }], ledger: [ledgerLine("level_up", spend, { slug: agent }), ...w.ledger] }; });
    const sent = post<{ level: number; gained: number }>({ action: "train", agent, coins: spend });
    sent.then(() => void refreshHub(), () => undo());
    // The screen already shows it; report now so the bar and any celebration play at once. A failure rolls back and toasts.
    sent.catch((e) => import("./store").then((m) => m.toast({ text: friendly(e, "Training failed. Your coins are back."), face: "home" })));
    return { ok: true, levelsGained: Math.max(0, lv - cur.level), level: lv };
  },
  async claimTier(i) {
    const t = TIERS[i];
    if (!t) return { ok: false, coins: 0, error: "Unknown tier." };
    patchHub((l) => { const w = withCoins(l, t.reward); return { ...w, referral: { ...w.referral, tiers: w.referral.tiers.map((x) => (x.tier === i ? { ...x, claimed: true } : x)) }, ledger: [ledgerLine("claim_referral_tier", t.reward), ...w.ledger] }; });
    try {
      const r = await post<{ reward: number }>({ action: "tier", tier: i });
      void refreshHub();
      return { ok: true, coins: r.reward };
    } catch (e) { undo(); return { ok: false, coins: 0, error: friendly(e, "Referral claim failed.") }; }
  },
  async openBox() {
    if (get().live?.box.opened) return { ok: false, coins: 0, error: "You already opened today's box." };
    try {
      const r = await post<{ won: number }>({ action: "box" });
      patchHub((l) => { const w = withCoins(l, r.won); return { ...w, box: { ...w.box, opened: true, coins: r.won }, ledger: [ledgerLine("open_box", r.won), ...w.ledger] }; });
      void refreshHub();
      return { ok: true, coins: r.won };
    } catch (e) { undo(); return { ok: false, coins: 0, error: friendly(e, "The box could not be opened.") }; }
  },
  async invite() {
    throw new Error("Friends join when they sign up with your invite link.");
  },
};

/** Store: buy a cosmetic (coins drop at once) or wear one you own. */
export async function buyItem(item: string, price: number, kind?: "bg" | "bubble") {
  if (coinsOf(get()) < price) return { ok: false, error: "Not enough coins yet. Do a quest or open the box." };
  // The server wears a bought item right away, so show it worn at once too.
  patchHub((l) => { const w = withCoins(l, -price, false); const c = (w as HubState & { cosmetics?: Cos }).cosmetics || {}; return { ...w, cosmetics: { ...c, ...(kind ? { [kind]: item } : {}), owned: [...(c.owned || []), item] }, ledger: [ledgerLine("store_buy", price), ...w.ledger] } as HubState; });
  try { const r = await post<{ cosmetics: Cos }>({ action: "buy", item }); patchHub((l) => ({ ...l, cosmetics: r.cosmetics }) as HubState); void refreshHub(); return { ok: true }; }
  catch (e) { undo(); return { ok: false, error: friendly(e, "That didn't go through. Your coins are back.") }; }
}
export async function wearItem(kind: "bg" | "bubble", item: string | null) {
  patchHub((l) => { const c = { ...((l as HubState & { cosmetics?: Cos }).cosmetics || {}) }; if (item) c[kind] = item; else delete c[kind]; return { ...l, cosmetics: c } as HubState; });
  try { await post({ action: "wear", kind, item }); void refreshHub(); return { ok: true }; } catch (e) { undo(); return { ok: false, error: friendly(e, "Couldn't change that.") }; }
}
type Cos = { owned?: string[]; bg?: string; bubble?: string };
