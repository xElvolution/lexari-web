/**
 * Hub: earn coins with a daily check-in, quests and referrals, then spend them to level up agents.
 *
 * Today everything is kept on this device (inside the app state, key "lexari-app-v1").
 * The shapes below are written to map onto a Solana program later. contracts/solana has
 * no coin or level instructions yet; the proposed accounts are:
 *
 *   Player     PDA [b"player", owner]        { owner, coins: u64, streak: u16, last_check_in: i64, referrer: Option<Pubkey>, lifetime: u64 }
 *   AgentLevel PDA [b"level", agent_pda]     { agent: Pubkey, level: u8, xp: u32 }   (agent_pda = lib/chain.ts agentPda(owner, asset))
 *   instructions: check_in(), claim_quest(quest_id: u16, period: u32), level_up(agent, coins: u64), claim_referral_tier(tier: u8)
 *
 * Quests are verified from activity, so claim_quest would need a co-signer (our server) on chain.
 * Swap `localHub` for a chain-backed adapter that implements the same `HubAdapter` interface.
 */
import { get, set, todayKey, type State } from "./store";

/* ---------- types ---------- */
export type Period = "daily" | "weekly" | "hard";
export type QuestId = string;
export type Quest = { id: QuestId; chainId: number; period: Period; title: string; hint: string; goal: number; reward: number; icon: string; go?: string; progress: (s: State, now: number) => number };
export type LedgerEntry = { at: number; delta: number; reason: string };
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
export interface HubAdapter {
  checkIn(now?: number): { ok: boolean; coins: number; day: number };
  claimQuest(id: QuestId, now?: number): { ok: boolean; coins: number };
  train(agent: string, coins: number): { ok: boolean; levelsGained: number; level: number };
  claimTier(i: number): { ok: boolean; coins: number };
  openBox(now?: number): { ok: boolean; coins: number };
  invite(friend?: Partial<Invitee>): Invitee;
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

/* ---------- time ---------- */
export function dayStart(now: number) { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }
/** Weeks start on Monday, local time. */
export function weekStart(now: number) { const d = new Date(dayStart(now)); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.getTime(); }
export function nextReset(period: Period, now: number) {
  if (period === "daily") { const d = new Date(dayStart(now)); d.setDate(d.getDate() + 1); return d.getTime(); }
  if (period === "weekly") { const d = new Date(weekStart(now)); d.setDate(d.getDate() + 7); return d.getTime(); }
  return Infinity;
}
export function periodKey(period: Period, now: number) { return period === "daily" ? todayKey(now) : period === "weekly" ? `w${todayKey(weekStart(now))}` : "once"; }
export function countdown(ms: number) {
  if (!isFinite(ms)) return "";
  const t = Math.max(0, Math.floor(ms / 1000)); const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return d ? `${d}d ${h}h ${String(m).padStart(2, "0")}m` : `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}
const shift = (now: number, days: number) => { const d = new Date(now); d.setDate(d.getDate() + days); return d.getTime(); };

/* ---------- selectors ---------- */
const EMPTY_HUB: HubData = { v: 1, claimed: [], levels: {}, invited: [], tiers: [], boxes: [], ledger: [], lifetime: 0 };
export function hubOf(s: State): HubData {
  const h = s.hub;
  if (!h || h.v !== 1) return { ...EMPTY_HUB, invited: seedInvites(s), lifetime: s.bond?.coins || 0 };
  return { ...EMPTY_HUB, ...h };
}
export const coinsOf = (s: State) => s.bond?.coins || 0;
export function streakOf(s: State, now: number) {
  const have = new Set(s.bond?.days || []);
  let i = have.has(todayKey(now)) ? 0 : -1;
  if (i === -1 && !have.has(todayKey(shift(now, -1)))) return 0;
  let n = 0; while (have.has(todayKey(shift(now, i)))) { n++; i--; }
  return n;
}
export const checkedInToday = (s: State, now: number) => (s.bond?.days || []).includes(todayKey(now));
/** What today's check-in pays (or paid). */
export function checkInPay(s: State, now: number) {
  const streak = checkedInToday(s, now) ? streakOf(s, now) : streakOf(s, now) + 1;
  return STREAK_PAY[Math.min(STREAK_PAY.length, Math.max(1, streak)) - 1];
}
export function levelOf(s: State, agent: string): AgentLevel { return hubOf(s).levels[agent] || { level: 1, xp: 0 }; }
export function earnedSince(s: State, t: number) { return hubOf(s).ledger.filter((e) => e.at >= t && e.delta > 0).reduce((a, e) => a + e.delta, 0); }

const youMsgsSince = (s: State, t: number) => Object.values(s.threads || {}).reduce((n, th) => n + th.filter((m) => m.from === "you" && m.at >= t).length, 0);
const notesSince = (s: State, t: number) => s.memory.filter((m) => m.at >= t).length;
const jobsSince = (s: State, t: number) => s.jobs.filter((j) => j.status === "done" && (j.startedAt ?? 0) >= t).length;
const daysSince = (s: State, t: number) => (s.bond?.days || []).filter((d) => new Date(`${d}T12:00:00`).getTime() >= t).length;
const levelUpsSince = (s: State, t: number) => hubOf(s).ledger.filter((e) => e.at >= t && e.reason.startsWith("Level up")).length;
const hiresSince = (s: State, t: number) => s.hired.filter((h) => (s.born[h] ?? 0) >= t).length;
const maxLevel = (s: State) => Math.max(1, ...Object.values(hubOf(s).levels).map((l) => l.level));

export const QUESTS: Quest[] = [
  { id: "d-checkin", chainId: 1, period: "daily", title: "Show up", hint: "Check in today", goal: 1, reward: 10, icon: "check", go: "#checkin", progress: (s, n) => (checkedInToday(s, n) ? 1 : 0) },
  { id: "d-chat", chainId: 2, period: "daily", title: "Say hi", hint: "Send 3 messages to any agent", goal: 3, reward: 20, icon: "chat", go: "/app", progress: (s, n) => youMsgsSince(s, dayStart(n)) },
  { id: "d-memory", chainId: 3, period: "daily", title: "Teach it something", hint: "Save 2 memories", goal: 2, reward: 25, icon: "memory", go: "/app/memory", progress: (s, n) => notesSince(s, dayStart(n)) },
  { id: "d-box", chainId: 4, period: "daily", title: "Lucky dip", hint: "Open today's mystery box", goal: 1, reward: 10, icon: "box", go: "#box", progress: (s, n) => (hubOf(s).boxes.includes(todayKey(n)) ? 1 : 0) },
  { id: "w-days", chainId: 101, period: "weekly", title: "Regular", hint: "Check in on 5 days this week", goal: 5, reward: 120, icon: "check", go: "#checkin", progress: (s, n) => daysSince(s, weekStart(n)) },
  { id: "w-chat", chainId: 102, period: "weekly", title: "Chatterbox", hint: "Send 25 messages this week", goal: 25, reward: 150, icon: "chat", go: "/app", progress: (s, n) => youMsgsSince(s, weekStart(n)) },
  { id: "w-jobs", chainId: 103, period: "weekly", title: "Delegator", hint: "Finish 3 jobs this week", goal: 3, reward: 180, icon: "jobs", go: "/app", progress: (s, n) => jobsSince(s, weekStart(n)) },
  { id: "w-level", chainId: 104, period: "weekly", title: "Coach", hint: "Level up any agent twice", goal: 2, reward: 100, icon: "spark", go: "#level", progress: (s, n) => levelUpsSince(s, weekStart(n)) },
  { id: "h-streak", chainId: 201, period: "hard", title: "Iron streak", hint: "Check in 14 days in a row", goal: 14, reward: 750, icon: "star", go: "#checkin", progress: (s, n) => streakOf(s, n) },
  { id: "h-level", chainId: 202, period: "hard", title: "Prodigy", hint: "Raise an agent to level 5", goal: 5, reward: 600, icon: "spark", go: "#level", progress: (s) => maxLevel(s) },
  { id: "h-memory", chainId: 203, period: "hard", title: "Elephant", hint: "Keep 30 memories in the brain", goal: 30, reward: 500, icon: "memory", go: "/app/memory", progress: (s) => s.memory.length },
  { id: "h-team", chainId: 204, period: "hard", title: "Full house", hint: "Have 5 agents on your team", goal: 5, reward: 900, icon: "team", go: "/app/marketplace", progress: (s) => 1 + s.custom.length + s.hired.length },
  { id: "h-invite", chainId: 205, period: "hard", title: "Recruiter", hint: "Invite 5 friends", goal: 5, reward: 800, icon: "users", go: "#invite", progress: (s) => hubOf(s).invited.length },
  { id: "h-hire", chainId: 206, period: "hard", title: "Talent scout", hint: "Hire a specialist this week", goal: 1, reward: 300, icon: "market", go: "/app/marketplace", progress: (s, n) => hiresSince(s, weekStart(n)) },
];
export type QuestView = Quest & { have: number; done: boolean; claimed: boolean; resetsAt: number };
export function questsView(s: State, now: number): QuestView[] {
  const h = hubOf(s);
  return QUESTS.map((q) => { const have = Math.min(q.goal, q.progress(s, now)); return { ...q, have, done: have >= q.goal, claimed: h.claimed.includes(`${q.id}@${periodKey(q.period, now)}`), resetsAt: nextReset(q.period, now) }; });
}

export const ACHIEVEMENTS: { id: string; title: string; body: string; icon: string; test: (s: State, h: HubData, now: number) => boolean }[] = [
  { id: "first-in", title: "Clocked in", body: "First check-in", icon: "check", test: (s) => (s.bond?.days || []).length > 0 },
  { id: "streak-3", title: "Warming up", body: "3-day streak", icon: "spark", test: (s, _h, n) => streakOf(s, n) >= 3 },
  { id: "streak-7", title: "On fire", body: "7-day streak", icon: "star", test: (s, _h, n) => streakOf(s, n) >= 7 },
  { id: "lvl-2", title: "Coach", body: "First level up", icon: "spark", test: (_s, h) => Object.values(h.levels).some((l) => l.level >= 2) },
  { id: "lvl-5", title: "Prodigy", body: "An agent at level 5", icon: "idcard", test: (_s, h) => Object.values(h.levels).some((l) => l.level >= 5) },
  { id: "friend", title: "Plus one", body: "Invite a friend", icon: "users", test: (_s, h) => h.invited.length > 0 },
  { id: "rich", title: "Coin purse", body: "Earn 1,000 coins", icon: "wallet", test: (_s, h) => h.lifetime >= 1000 },
  { id: "quests", title: "Quest master", body: "Claim 10 quests", icon: "list", test: (_s, h) => h.claimed.length >= 10 },
];

/* ---------- demo seed: a couple of friends already joined ---------- */
const FRIEND_NAMES = ["Tobi", "Mara", "Kenji", "Zuri", "Lena", "Ravi", "Nia", "Omar", "Ivy", "Theo", "Sade", "Luca"];
const FRIEND_COLORS = ["orange", "blue", "green", "yellow", "red", "teal", "pink", "lilac", "purple", "sky"];
function seedInvites(s: State): Invitee[] {
  const t0 = s.profile?.since ?? s.born?.home ?? Date.now();
  return [
    { id: "f-1", name: "Tobi", seed: 23, color: "orange", at: t0 + 2 * 36e5, demo: true },
    { id: "f-2", name: "Mara", seed: 57, color: "teal", at: t0 + 30 * 36e5, demo: true },
  ];
}
export function inviteCode(s: State) {
  const base = (s.profile?.username || s.agent?.you || s.auth?.label || "friend").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "FRIEND";
  let n = 0; for (const c of s.auth?.sub || base) n = (n * 31 + c.charCodeAt(0)) % 9000;
  return `${base}-${1000 + n}`;
}

/* ---------- local adapter ---------- */
function write(fn: (h: HubData, s: State) => { hub: HubData; coins?: number; days?: string[] }) {
  set((s) => {
    const r = fn(hubOf(s), s);
    return { ...s, hub: r.hub, bond: { ...(s.bond || { days: [], coins: 0, claimed: [] }), coins: r.coins ?? (s.bond?.coins || 0), days: r.days ?? (s.bond?.days || []) } };
  });
}
const credit = (h: HubData, delta: number, reason: string): HubData => ({ ...h, ledger: [{ at: Date.now(), delta, reason }, ...h.ledger].slice(0, 80), lifetime: h.lifetime + Math.max(0, delta) });

export const localHub: HubAdapter = {
  checkIn(now = Date.now()) {
    const s = get();
    if (checkedInToday(s, now)) return { ok: false, coins: 0, day: streakOf(s, now) };
    const day = streakOf(s, now) + 1; const pay = STREAK_PAY[Math.min(STREAK_PAY.length, day) - 1];
    write((h, st) => ({ hub: credit(h, pay, `Check-in, day ${day}`), coins: coinsOf(st) + pay, days: [...(st.bond?.days || []), todayKey(now)].slice(-420) }));
    return { ok: true, coins: pay, day };
  },
  claimQuest(id, now = Date.now()) {
    const s = get(); const q = questsView(s, now).find((x) => x.id === id);
    if (!q || !q.done || q.claimed) return { ok: false, coins: 0 };
    write((h, st) => ({ hub: credit({ ...h, claimed: [...h.claimed, `${q.id}@${periodKey(q.period, now)}`].slice(-400) }, q.reward, `Quest: ${q.title}`), coins: coinsOf(st) + q.reward }));
    return { ok: true, coins: q.reward };
  },
  train(agent, coins) {
    const s = get(); const have = coinsOf(s); const cur = levelOf(s, agent);
    const spend = Math.min(Math.floor(coins), have);
    if (spend <= 0 || cur.level >= MAX_LEVEL) return { ok: false, levelsGained: 0, level: cur.level };
    let { level, xp } = cur; xp += spend; let gained = 0;
    while (level < MAX_LEVEL && xp >= xpFor(level)) { xp -= xpFor(level); level++; gained++; }
    if (level >= MAX_LEVEL) xp = 0;
    write((h, st) => {
      let hub: HubData = { ...h, levels: { ...h.levels, [agent]: { level, xp, at: Date.now() } }, ledger: [{ at: Date.now(), delta: -spend, reason: `Training ${agent}` }, ...h.ledger] };
      for (let i = 0; i < gained; i++) hub = { ...hub, ledger: [{ at: Date.now(), delta: 0, reason: `Level up ${agent} to ${level - gained + i + 1}` }, ...hub.ledger] };
      hub.ledger = hub.ledger.slice(0, 80);
      return { hub, coins: coinsOf(st) - spend };
    });
    return { ok: true, levelsGained: gained, level };
  },
  claimTier(i) {
    const s = get(); const h = hubOf(s); const t = TIERS[i];
    if (!t || h.tiers.includes(i) || h.invited.length < t.friends) return { ok: false, coins: 0 };
    write((hh, st) => ({ hub: credit({ ...hh, tiers: [...hh.tiers, i] }, t.reward, `Referral: ${t.title}`), coins: coinsOf(st) + t.reward }));
    return { ok: true, coins: t.reward };
  },
  openBox(now = Date.now()) {
    const s = get(); const key = todayKey(now);
    if (hubOf(s).boxes.includes(key)) return { ok: false, coins: 0 };
    const total = BOX_ODDS.reduce((a, [, w]) => a + w, 0); let r = Math.random() * total; let pay = BOX_ODDS[0][0];
    for (const [c, w] of BOX_ODDS) { if ((r -= w) <= 0) { pay = c; break; } }
    write((h, st) => ({ hub: credit({ ...h, boxes: [...h.boxes, key].slice(-60) }, pay, "Mystery box"), coins: coinsOf(st) + pay }));
    return { ok: true, coins: pay };
  },
  invite(friend) {
    const h = hubOf(get()); const i = h.invited.length;
    const f: Invitee = { id: `f-${Date.now().toString(36)}`, name: FRIEND_NAMES[(i + 2) % FRIEND_NAMES.length], seed: 11 + i * 17, color: FRIEND_COLORS[(i * 3 + 1) % FRIEND_COLORS.length], at: Date.now(), demo: true, ...friend };
    write((hh) => ({ hub: { ...hh, invited: [...hh.invited, f] } }));
    return f;
  },
};
/** The adapter the UI uses. Replace with a chain-backed one when the program grows coin/level instructions. */
export const hub: HubAdapter = localHub;
