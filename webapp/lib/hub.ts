/**
 * Hub: earn coins with a daily check-in, quests, a mystery box and referrals, then spend them to level up agents.
 *
 * Coins, streaks, levels and claims live onchain (contracts/solana: Player, AgentLevel, claim PDAs).
 * Quest progress comes from the server, which counts only what it can verify (confirmed transactions,
 * saved messages and memories, finished jobs, verified hires, referred friends who are active onchain).
 * The UI reads `s.live` (GET /api/hub/state); every action goes through lib/chain.ts.
 */
import { useSyncExternalStore } from "react";
import { todayKey, type State } from "./store";

/* ---------- types ---------- */
export type Period = "daily" | "weekly" | "hard";
export type QuestId = string;
export type Quest = { id: QuestId; chainId: number; period: Period; title: string; hint: string; goal: number; reward: number; icon: string; go?: string; progress: (s: State) => number };
export type LedgerEntry = { at: number; delta: number; reason: string; tx?: string };
export type AgentLevel = { level: number; xp: number; at?: number };
export type Invitee = { id: string; name: string; seed: number; color: string; at: number; demo?: boolean };
export type HubData = {
  v: 1;
  /** `${questId}@${periodKey}` of every quest reward already collected */
  claimed: string[];
  levels: Record<string, AgentLevel>; // agent id → level ("home", "c-…", or a specialist slug)
  invited: Invitee[];
  tiers: number[]; // referral tiers collected (index into TIERS)
  boxes: string[]; // day keys a mystery box was opened
  ledger: LedgerEntry[]; // newest first, capped
  lifetime: number; // coins ever earned
};
export type HubResult = { ok: boolean; coins: number; error?: string };
export interface HubAdapter {
  checkIn(now?: number): Promise<HubResult & { day: number }>;
  claimQuest(id: QuestId, now?: number): Promise<HubResult>;
  train(agent: string, coins: number): Promise<{ ok: boolean; levelsGained: number; level: number; error?: string }>;
  claimTier(i: number): Promise<HubResult>;
  openBox(now?: number): Promise<HubResult>;
  invite(friend?: Partial<Invitee>): Promise<Invitee>;
}

/* ---------- constants ---------- */
/** Check-in pay by streak day (day 7 and beyond pay the last value). */
export const STREAK_PAY = [10, 15, 20, 25, 30, 40, 75];
export const MAX_LEVEL = 10;
/** XP (= coins spent) needed to go from `level` to `level + 1`. */
export const xpFor = (level: number) => 60 + (level - 1) * 40;
export const PERKS: { level: number; title: string; body: string; icon: string }[] = [
  { level: 2, title: "Quick replies", body: "Starts answering sooner.", icon: "spark" },
  { level: 3, title: "Bigger memory", body: "Keeps 50 more notes.", icon: "memory" },
  { level: 4, title: "Card glow", body: "A glowing frame on its ID card.", icon: "idcard" },
  { level: 5, title: "Second shift", body: "Runs two jobs at once.", icon: "jobs" },
  { level: 6, title: "Extra skill slot", body: "Learns one more skill.", icon: "plus" },
  { level: 7, title: "Holo card", body: "Holographic ID card background.", icon: "star" },
  { level: 8, title: "Priority desk", body: "First in line for compute.", icon: "desk" },
  { level: 9, title: "Mentor", body: "Teaches your other agents.", icon: "team" },
  { level: 10, title: "Legend", body: "Gold badge, forever.", icon: "check" },
];
export const TIERS: { friends: number; reward: number; title: string }[] = [
  { friends: 1, reward: 100, title: "First friend" },
  { friends: 3, reward: 300, title: "Small crew" },
  { friends: 5, reward: 600, title: "Full desk" },
  { friends: 10, reward: 1500, title: "Founding circle" },
];
export const BOX_ODDS: [number, number][] = [[15, 40], [30, 30], [60, 18], [120, 9], [250, 3]]; // coins, weight

/* ---------- time (UTC, like the program and the server) ---------- */
export function dayStart(now: number) { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
/** Weeks start on Monday, UTC. */
export function weekStart(now: number) { const d = new Date(dayStart(now)); const dow = (d.getUTCDay() + 6) % 7; return dayStart(now) - dow * 864e5; }
export function nextReset(period: Period, now: number) {
  if (period === "daily") return dayStart(now) + 864e5;
  if (period === "weekly") return weekStart(now) + 7 * 864e5;
  return Infinity;
}
export function periodKey(period: Period, now: number) { return period === "daily" ? todayKey(now) : period === "weekly" ? `w${todayKey(weekStart(now))}` : "once"; }
export function countdown(ms: number) {
  if (!isFinite(ms)) return "";
  const t = Math.max(0, Math.floor(ms / 1000)); const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return d ? `${d}d ${h}h ${String(m).padStart(2, "0")}m` : `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/* ---------- selectors ---------- */
const REASON: Record<string, string> = { check_in: "Check-in", claim_quest: "Quest", open_box: "Mystery box", level_up: "Training", claim_referral_tier: "Referral reward", init_player: "Joined the Hub" };
const EMPTY_HUB: HubData = { v: 1, claimed: [], levels: {}, invited: [], tiers: [], boxes: [], ledger: [], lifetime: 0 };
export function hubOf(s: State): HubData {
  const l = s.live;
  if (!l) return EMPTY_HUB;
  const levels: Record<string, AgentLevel> = {};
  for (const x of l.levels) levels[x.slug] = { level: x.level, xp: x.xp };
  return {
    v: 1,
    claimed: Array.from({ length: l.claimedTotal }, (_, i) => `claim-${i}`),
    levels,
    invited: Array.from({ length: l.referral.friends }, (_, i) => ({ id: `f-${i}`, name: `Friend ${i + 1}`, seed: 11 + i * 17, color: ["orange", "teal", "blue", "green", "pink"][i % 5], at: 0 })),
    tiers: l.referral.tiers.filter((t) => t.claimed).map((t) => t.tier),
    boxes: l.box.opened ? [todayKey()] : [],
    ledger: l.ledger.filter((e) => e.kind !== "init_player").map((e) => ({ at: e.at, delta: e.kind === "level_up" ? -e.amount : e.amount, reason: REASON[e.kind] || e.kind, tx: e.tx })),
    lifetime: l.player?.lifetime ?? 0,
  };
}
export const coinsOf = (s: State) => s.live?.player?.coins ?? 0;
export const streakOf = (s: State, _now?: number) => s.live?.player?.streak ?? 0;
export const checkedInToday = (s: State, _now?: number) => !!s.live?.player?.checkedInToday;
/** What today's check-in pays (or paid). */
export function checkInPay(s: State, now: number) {
  const streak = checkedInToday(s, now) ? streakOf(s, now) : streakOf(s, now) + 1;
  return STREAK_PAY[Math.min(STREAK_PAY.length, Math.max(1, streak)) - 1];
}
export function levelOf(s: State, agent: string): AgentLevel { return hubOf(s).levels[agent] || { level: 1, xp: 0 }; }
export function earnedSince(s: State, t: number) { return hubOf(s).ledger.filter((e) => e.at >= t && e.delta > 0).reduce((a, e) => a + e.delta, 0); }
const live = (s: State, id: string) => s.live?.quests.find((q) => q.id === id);

export const QUESTS: Quest[] = [
  { id: "d-checkin", chainId: 1, period: "daily", title: "Show up", hint: "Check in today", goal: 1, reward: 10, icon: "check", go: "#checkin", progress: (s) => live(s, "d-checkin")?.progress ?? 0 },
  { id: "d-chat", chainId: 2, period: "daily", title: "Say hi", hint: "Send 3 messages to any agent", goal: 3, reward: 20, icon: "chat", go: "/app", progress: (s) => live(s, "d-chat")?.progress ?? 0 },
  { id: "d-memory", chainId: 3, period: "daily", title: "Teach it something", hint: "Save 2 memories", goal: 2, reward: 25, icon: "memory", go: "/app/memory", progress: (s) => live(s, "d-memory")?.progress ?? 0 },
  { id: "d-box", chainId: 4, period: "daily", title: "Lucky dip", hint: "Open today's mystery box", goal: 1, reward: 10, icon: "box", go: "#box", progress: (s) => live(s, "d-box")?.progress ?? 0 },
  { id: "w-days", chainId: 101, period: "weekly", title: "Regular", hint: "Check in on 5 days this week", goal: 5, reward: 120, icon: "check", go: "#checkin", progress: (s) => live(s, "w-days")?.progress ?? 0 },
  { id: "w-chat", chainId: 102, period: "weekly", title: "Chatterbox", hint: "Send 25 messages this week", goal: 25, reward: 150, icon: "chat", go: "/app", progress: (s) => live(s, "w-chat")?.progress ?? 0 },
  { id: "w-jobs", chainId: 103, period: "weekly", title: "Delegator", hint: "Finish 3 jobs this week", goal: 3, reward: 180, icon: "jobs", go: "/app", progress: (s) => live(s, "w-jobs")?.progress ?? 0 },
  { id: "w-level", chainId: 104, period: "weekly", title: "Coach", hint: "Level up any agent twice", goal: 2, reward: 100, icon: "spark", go: "#level", progress: (s) => live(s, "w-level")?.progress ?? 0 },
  { id: "h-streak", chainId: 201, period: "hard", title: "Iron streak", hint: "Check in 14 days in a row", goal: 14, reward: 750, icon: "star", go: "#checkin", progress: (s) => live(s, "h-streak")?.progress ?? 0 },
  { id: "h-level", chainId: 202, period: "hard", title: "Prodigy", hint: "Raise an agent to level 5", goal: 5, reward: 600, icon: "spark", go: "#level", progress: (s) => live(s, "h-level")?.progress ?? 0 },
  { id: "h-memory", chainId: 203, period: "hard", title: "Elephant", hint: "Keep 30 memories in the brain", goal: 30, reward: 500, icon: "memory", go: "/app/memory", progress: (s) => live(s, "h-memory")?.progress ?? 0 },
  { id: "h-team", chainId: 204, period: "hard", title: "Full house", hint: "Have 5 agents on your team", goal: 5, reward: 900, icon: "team", go: "/app/marketplace", progress: (s) => live(s, "h-team")?.progress ?? 0 },
  { id: "h-invite", chainId: 205, period: "hard", title: "Recruiter", hint: "Invite 5 friends", goal: 5, reward: 800, icon: "users", go: "#invite", progress: (s) => live(s, "h-invite")?.progress ?? 0 },
  { id: "h-hire", chainId: 206, period: "hard", title: "Talent scout", hint: "Hire a specialist from the market", goal: 1, reward: 300, icon: "market", go: "/app/marketplace", progress: (s) => live(s, "h-hire")?.progress ?? 0 },
];
export type QuestView = Quest & { have: number; done: boolean; claimed: boolean; resetsAt: number };
export function questsView(s: State, now: number): QuestView[] {
  return QUESTS.map((q) => { const have = Math.min(q.goal, q.progress(s)); return { ...q, have, done: have >= q.goal, claimed: !!live(s, q.id)?.claimed, resetsAt: nextReset(q.period, now) }; });
}

export const ACHIEVEMENTS: { id: string; title: string; body: string; icon: string; test: (s: State, h: HubData, now: number) => boolean }[] = [
  { id: "first-in", title: "Clocked in", body: "First check-in", icon: "check", test: (s) => !!s.live?.player },
  { id: "streak-3", title: "Warming up", body: "3-day streak", icon: "spark", test: (s, _h, n) => streakOf(s, n) >= 3 },
  { id: "streak-7", title: "On fire", body: "7-day streak", icon: "star", test: (s, _h, n) => streakOf(s, n) >= 7 },
  { id: "lvl-2", title: "Coach", body: "First level up", icon: "spark", test: (_s, h) => Object.values(h.levels).some((l) => l.level >= 2) },
  { id: "lvl-5", title: "Prodigy", body: "An agent at level 5", icon: "idcard", test: (_s, h) => Object.values(h.levels).some((l) => l.level >= 5) },
  { id: "friend", title: "Plus one", body: "Invite a friend", icon: "users", test: (_s, h) => h.invited.length > 0 },
  { id: "rich", title: "Coin purse", body: "Earn 1,000 coins", icon: "wallet", test: (_s, h) => h.lifetime >= 1000 },
  { id: "quests", title: "Quest master", body: "Claim 10 quests", icon: "list", test: (_s, h) => h.claimed.length >= 10 },
];

/** Your invite code. Friends who sign up with it, and then do something onchain, count toward referral tiers. */
export function inviteCode(s: State) { return s.referralCode || ""; }

/* ---------- one action at a time ---------- */
let busy: string | null = null;
const bsubs = new Set<() => void>();
const setBusy = (v: string | null) => { busy = v; bsubs.forEach((f) => f()); };
/** What the Hub is waiting on ("checkin", "quest:d-chat", "box", "train", "tier:0"), or null. Buttons disable while set. */
export function useHubBusy() {
  return useSyncExternalStore((f) => { bsubs.add(f); return () => { bsubs.delete(f); }; }, () => busy, () => null);
}
function guard<A extends unknown[], R>(key: (...a: A) => string, run: (...a: A) => Promise<R>, idle: R) {
  return async (...a: A) => {
    if (busy) return idle;
    setBusy(key(...a));
    try { return await run(...a); } finally { setBusy(null); }
  };
}
const adapter = () => import("./chainHub").then((m) => m.chainHub);
const wait = { ok: false, coins: 0, error: "Finish the action in progress first." };

/** Hub actions. They sign with your wallet and fail with a clear message if the program or attestor is not ready. */
export const hub: HubAdapter = {
  checkIn: guard((_n?: number) => "checkin", async (now?: number) => (await adapter()).checkIn(now), { ...wait, day: 0 }),
  claimQuest: guard((id: QuestId) => `quest:${id}`, async (id: QuestId, now?: number) => (await adapter()).claimQuest(id, now), wait),
  train: guard((_a: string, _c: number) => "train", async (agent: string, coins: number) => (await adapter()).train(agent, coins), { ok: false, levelsGained: 0, level: 1, error: wait.error }),
  claimTier: guard((i: number) => `tier:${i}`, async (i: number) => (await adapter()).claimTier(i), wait),
  openBox: guard((_n?: number) => "box", async (now?: number) => (await adapter()).openBox(now), wait),
  invite: async (friend) => (await adapter()).invite(friend),
};
