/**
 * Billing constants shared by the server meter and the app. Owner decisions live here so they are easy to change.
 * Money is counted in micro dollars (USD x 1e6) everywhere on the server.
 */
export const MICROS = 1_000_000;

/** Premium models (and Lamina once its own pool is empty) are billed at the API price plus this markup. 0.2 = +20%. */
export const LEXARI_MARKUP = 0.2;
/**
 * Free plan: a small Lamina allowance each day, metered in dollars like the paid pools and shown only as a percentage.
 * $0.08 is about 30 typical Lamina turns. Resets at 00:00 UTC.
 */
export const FREE_LAMINA_USD_PER_DAY = 0.08;
/** Free accounts may buy extra credits and spend them on premium models and on Lamina past the daily limit. */
export const CREDITS_ON_FREE = true;
/** Days in a paid billing cycle. Lexari runs the cycle itself (no card subscription engine is assumed). */
export const CYCLE_DAYS = 30;
/** Renewal reminder this many days before a paid cycle ends. */
export const RENEW_REMIND_DAYS = 3;
/** Usage alerts at these shares of a pool. */
export const ALERT_AT = [0.8, 1] as const;

/** Extra credit packs, in USD. Credits are spend-only on Lexari (plans and AI usage) and are not withdrawable. */
export const TOPUP_PACKS = [5, 10, 25] as const;
export type TopUpPack = (typeof TOPUP_PACKS)[number];
/** The most one top up can add (a whole dollar amount, used to cover a shortfall bigger than the largest pack). */
export const TOPUP_MAX_USD = 1000;
/**
 * What to top up for a shortfall (micro dollars): the smallest pack that covers it, else the shortfall rounded up to
 * whole dollars (a yearly plan can be short by more than the largest pack).
 */
export const packFor = (shortMicros: number): number => TOPUP_PACKS.find((p) => p * 1_000_000 >= shortMicros) ?? Math.min(TOPUP_MAX_USD, Math.ceil(shortMicros / 1_000_000));

/** Monthly spend limit on extra credits: Disabled, Fixed (an amount) or Unlimited, like Cursor. */
export type SpendMode = "disabled" | "fixed" | "unlimited";
export const SPEND_PRESETS = [10, 25, 50] as const;
export const DEFAULT_SPEND_LIMIT_USD = 25;

/** Output tokens reserved per call when placing a hold (a chat reply, a voice call reply). */
export const HOLD_OUT_TOKENS = { chat: 1200, call: 250 } as const;
/** A hold that was never settled stops counting after this long. */
export const HOLD_TTL_MS = 6 * 60_000;

export const usd = (micros: number, digits?: number) => {
  const v = micros / MICROS;
  const d = digits ?? (v !== 0 && Math.abs(v) < 1 ? 2 : v % 1 === 0 ? 0 : 2);
  return `$${v.toFixed(d)}`;
};
