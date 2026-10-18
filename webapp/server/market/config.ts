/**
 * Marketplace money and safety settings for the SDK alpha. Owner decisions (Oct 2026):
 *  - revenue: 80% to the developer, 20% to Lexari, recorded on every paid hire (hire_events); payouts come later;
 *  - Lexari models only, testnet only, invite-only developers;
 *  - third-party agents may propose only transfers and swaps, under caps lower than a person's own limits.
 */
export const REVENUE_SPLIT = { developerBps: 8000, lexariBps: 2000 } as const;

/** Split a hire price in micro-dollars. The developer share rounds down; Lexari takes the remainder, so the parts always add up. */
export function splitRevenue(grossMicros: number) {
  const gross = Math.max(0, Math.round(grossMicros));
  const developer = Math.floor((gross * REVENUE_SPLIT.developerBps) / 10_000);
  return { gross, developer, lexari: gross - developer, bps: REVENUE_SPLIT.developerBps };
}

/** Intents a third-party agent may propose, and the built-in sign tool each one becomes. */
export const DEV_INTENT_TOOLS = { transfer: "solana.transfer", swap: "orca.swap" } as const;

/** Lower default caps for anything a third-party agent proposes (on top of the person's own integration limits). */
export const DEV_CAPS = {
  perTxUsd: Number(process.env.DEV_AGENT_PER_TX_USD || 5),
  dailyUsd: Number(process.env.DEV_AGENT_DAILY_USD || 20),
};

/** Webhook tools: time and size limits and rate limits per person and per listing. */
export const WEBHOOK = {
  timeoutMs: 10_000,
  maxResponseBytes: 64 * 1024,
  perUserPerMinute: 20,
  perListingPerMinute: 600,
  /** consecutive failures before a listing's tools pause themselves for a while */
  breakerFailures: 20,
};

/** Developer keys: scopes a key can carry. */
export const KEY_SCOPES = ["publish", "read"] as const;
export type KeyScope = (typeof KEY_SCOPES)[number];
export const KEY_PREFIX = "lxk_test_";
export const MAX_KEYS = 10;

/** People who can review listings and make developer invites (comma separated wallets in ADMIN_WALLETS). */
export const adminWallets = () => (process.env.ADMIN_WALLETS || "").split(",").map((s) => s.trim()).filter(Boolean);
export const isAdmin = (wallet: string | null | undefined) => !!wallet && adminWallets().includes(wallet);
