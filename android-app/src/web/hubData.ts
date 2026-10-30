/** Hub content copied from webapp/lib/hub.ts and lib/cosmetics.ts so the phone shows the same quests, badges, perks and store. */
export type Period = "daily" | "weekly" | "hard";
export const STREAK_PAY = [10, 15, 20, 25, 30, 40, 75];
export const MAX_LEVEL = 10;
export const xpFor = (level: number) => 60 + (level - 1) * 40;
export const QUESTS: { id: string; period: Period; title: string; hint: string; goal: number; reward: number; icon: string; go: string }[] = [
  { id: "d-checkin", period: "daily", title: "Show up", hint: "Check in today", goal: 1, reward: 10, icon: "check", go: "#checkin" },
  { id: "d-chat", period: "daily", title: "Say hi", hint: "Send 3 messages to any agent", goal: 3, reward: 20, icon: "chat", go: "/agents" },
  { id: "d-memory", period: "daily", title: "Teach it something", hint: "Save 2 memories", goal: 2, reward: 25, icon: "memory", go: "/brain" },
  { id: "d-box", period: "daily", title: "Lucky dip", hint: "Open today's mystery box", goal: 1, reward: 10, icon: "box", go: "#box" },
  { id: "w-days", period: "weekly", title: "Regular", hint: "Check in on 5 days this week", goal: 5, reward: 120, icon: "check", go: "#checkin" },
  { id: "w-chat", period: "weekly", title: "Chatterbox", hint: "Send 25 messages this week", goal: 25, reward: 150, icon: "chat", go: "/agents" },
  { id: "w-jobs", period: "weekly", title: "Delegator", hint: "Finish 3 jobs this week", goal: 3, reward: 180, icon: "jobs", go: "/agents" },
  { id: "w-level", period: "weekly", title: "Coach", hint: "Level up any agent twice", goal: 2, reward: 100, icon: "spark", go: "#level" },
  { id: "w-store", period: "weekly", title: "Window shopper", hint: "Buy something in the Store", goal: 1, reward: 60, icon: "box", go: "#store" },
  { id: "h-streak", period: "hard", title: "Iron streak", hint: "Check in 14 days in a row", goal: 14, reward: 750, icon: "star", go: "#checkin" },
  { id: "h-level", period: "hard", title: "Prodigy", hint: "Raise an agent to level 5", goal: 5, reward: 600, icon: "spark", go: "#level" },
  { id: "h-memory", period: "hard", title: "Elephant", hint: "Keep 30 memories in the brain", goal: 30, reward: 500, icon: "memory", go: "/brain" },
  { id: "h-team", period: "hard", title: "Full house", hint: "Have 5 agents on your team", goal: 5, reward: 900, icon: "team", go: "/marketplace" },
  { id: "h-invite", period: "hard", title: "Recruiter", hint: "Invite 5 friends", goal: 5, reward: 800, icon: "users", go: "#invite" },
  { id: "h-hire", period: "hard", title: "Talent scout", hint: "Hire a specialist from the market", goal: 1, reward: 300, icon: "market", go: "/marketplace" },
  { id: "h-store", period: "hard", title: "Collector", hint: "Buy 3 Store items", goal: 3, reward: 250, icon: "box", go: "#store" },
  { id: "h-style", period: "hard", title: "Stylist", hint: "Apply a chat background and a bubble style", goal: 2, reward: 200, icon: "spark", go: "#store" },
  { id: "h-social", period: "hard", title: "Verified", hint: "Link X, Discord or Telegram in Settings", goal: 1, reward: 150, icon: "verified", go: "/settings#social" },
];
export const ACHIEVEMENTS: { id: string; title: string; body: string; icon: string }[] = [
  { id: "first-in", title: "Clocked in", body: "First check-in", icon: "check" },
  { id: "streak-3", title: "Warming up", body: "3-day streak", icon: "spark" },
  { id: "streak-7", title: "On fire", body: "7-day streak", icon: "star" },
  { id: "lvl-2", title: "Coach", body: "First level up", icon: "spark" },
  { id: "lvl-5", title: "Prodigy", body: "An agent at level 5", icon: "idcard" },
  { id: "friend", title: "Plus one", body: "Invite a friend", icon: "users" },
  { id: "rich", title: "Coin purse", body: "Earn 1,000 coins", icon: "wallet" },
  { id: "quests", title: "Quest master", body: "Claim 10 quests", icon: "list" },
];
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
export const STORE_CATEGORIES: { kind: "bg" | "bubble"; title: string; sub: string }[] = [
  { kind: "bg", title: "Chat background", sub: "Shows behind every chat." },
  { kind: "bubble", title: "Bubble style", sub: "Your own messages wear it." },
];
export const STORE_ITEMS: { id: string; kind: "bg" | "bubble"; name: string; price: number }[] = [
  { id: "bg-aurora", kind: "bg", name: "Aurora", price: 120 },
  { id: "bg-grid", kind: "bg", name: "Blueprint", price: 80 },
  { id: "bg-sunset", kind: "bg", name: "Sunset", price: 150 },
  { id: "bg-stars", kind: "bg", name: "Starfield", price: 200 },
  { id: "bg-lavender", kind: "bg", name: "Lavender", price: 60 },
  { id: "bg-dots", kind: "bg", name: "Polka", price: 70 },
  { id: "bg-pinstripe", kind: "bg", name: "Pinstripe", price: 100 },
  { id: "bg-ripple", kind: "bg", name: "Ripple", price: 130 },
  { id: "bg-deepsea", kind: "bg", name: "Deep sea", price: 170 },
  { id: "bg-velvet", kind: "bg", name: "Velvet", price: 240 },
  { id: "bubble-glass", kind: "bubble", name: "Glass", price: 90 },
  { id: "bubble-neon", kind: "bubble", name: "Neon", price: 140 },
  { id: "bubble-candy", kind: "bubble", name: "Candy", price: 110 },
  { id: "bubble-outline", kind: "bubble", name: "Outline", price: 60 },
  { id: "bubble-midnight", kind: "bubble", name: "Midnight", price: 70 },
  { id: "bubble-lilac", kind: "bubble", name: "Lilac", price: 100 },
  { id: "bubble-mint", kind: "bubble", name: "Mint", price: 120 },
  { id: "bubble-sunset", kind: "bubble", name: "Sunset", price: 160 },
  { id: "bubble-gold", kind: "bubble", name: "Gold", price: 220 },
];
export function dayStart(now: number) { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
/** Weeks start on Monday, UTC. */
export function weekStart(now: number) { const d = new Date(dayStart(now)); const dow = (d.getUTCDay() + 6) % 7; return dayStart(now) - dow * 864e5; }
export function nextReset(period: Period, now: number) { return period === "daily" ? dayStart(now) + 864e5 : period === "weekly" ? weekStart(now) + 7 * 864e5 : Infinity; }
export function countdown(ms: number) {
  if (!isFinite(ms)) return "";
  const t = Math.max(0, Math.floor(ms / 1000)); const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return d ? `${d}d ${h}h ${String(m).padStart(2, "0")}m` : `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}
