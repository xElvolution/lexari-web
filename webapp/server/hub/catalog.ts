/** Quest rules the attestor trusts. Rewards match webapp/lib/hub.ts. */
export type QuestRule = {
  id: string;
  chainId: number;
  period: "daily" | "weekly" | "hard";
  goal: number;
  reward: number;
  /** quest_events.kind, or a table count described in attest.ts */
  count: "message" | "memory" | "checkin" | "hire" | "level" | "agent" | "box" | "referral" | "team" | "job";
};

export const QUEST_RULES: QuestRule[] = [
  { id: "d-checkin", chainId: 1, period: "daily", goal: 1, reward: 10, count: "checkin" },
  { id: "d-chat", chainId: 2, period: "daily", goal: 3, reward: 20, count: "message" },
  { id: "d-memory", chainId: 3, period: "daily", goal: 2, reward: 25, count: "memory" },
  { id: "d-box", chainId: 4, period: "daily", goal: 1, reward: 10, count: "box" },
  { id: "w-days", chainId: 101, period: "weekly", goal: 5, reward: 120, count: "checkin" },
  { id: "w-chat", chainId: 102, period: "weekly", goal: 25, reward: 150, count: "message" },
  { id: "w-jobs", chainId: 103, period: "weekly", goal: 3, reward: 180, count: "job" },
  { id: "w-level", chainId: 104, period: "weekly", goal: 2, reward: 100, count: "level" },
  { id: "h-streak", chainId: 201, period: "hard", goal: 14, reward: 750, count: "checkin" },
  { id: "h-level", chainId: 202, period: "hard", goal: 5, reward: 600, count: "level" },
  { id: "h-memory", chainId: 203, period: "hard", goal: 30, reward: 500, count: "memory" },
  { id: "h-team", chainId: 204, period: "hard", goal: 5, reward: 900, count: "team" },
  { id: "h-invite", chainId: 205, period: "hard", goal: 5, reward: 800, count: "referral" },
  { id: "h-hire", chainId: 206, period: "hard", goal: 1, reward: 300, count: "hire" },
];

export const TIER_FRIENDS = [1, 3, 5, 10];
export const TIER_REWARD = [100, 300, 600, 1500];
export const BOX_ODDS: [number, number][] = [[15, 40], [30, 30], [60, 18], [120, 9], [250, 3]];

export function rollBox(): number {
  const total = BOX_ODDS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [coins, weight] of BOX_ODDS) {
    roll -= weight;
    if (roll <= 0) return coins;
  }
  return BOX_ODDS[0][0];
}

export function questByChain(chainId: number) {
  return QUEST_RULES.find((q) => q.chainId === chainId);
}

/** Compact period id stored on the QuestClaim account. Daily is UTC yyyymmdd, weekly is UTC yyyyww, hard is 0. */
export function periodNumber(period: "daily" | "weekly" | "hard", now = new Date()) {
  if (period === "hard") return 0;
  if (period === "daily") return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return date.getUTCFullYear() * 100 + week;
}
