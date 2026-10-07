/**
 * The metering rules as pure functions (no database), so the money math is unit tested.
 *
 * Pools, in the order a turn draws from them:
 *   Lamina on a paid plan:   Lamina pool (engine cost)  ->  premium pool (Lexari rate)  ->  extra credits (Lexari rate)
 *   Premium on a paid plan:  premium pool               ->  extra credits
 *   Lamina on Free:          the daily Lamina allowance (engine cost, resets 00:00 UTC)  ->  extra credits
 *   Premium on Free:         extra credits (when CREDITS_ON_FREE)
 * Extra credits are capped by the spend limit for the cycle. Lamina keeps running on a paid plan while any pool or
 * credit remains. A premium model is never silently swapped for a cheaper one.
 */
import { CREDITS_ON_FREE, LEXARI_MARKUP, MICROS, type SpendMode } from "@/content/billing";
import type { ModelPool, Price } from "@/content/models";

export type Pool = "free" | "lamina" | "premium" | "credits";
export type BlockReason = "free_daily" | "premium_locked" | "out_of_usage" | "spend_limit";

/** Real engine cost of a call, in micro dollars (rounded up so a call is never free by rounding). */
export function costMicros(price: Price, promptTokens: number, completionTokens: number) {
  return Math.ceil((Math.max(0, promptTokens) * price.in + Math.max(0, completionTokens) * price.out));
}
export const usdToMicros = (usd: number) => Math.round(usd * MICROS);
/** What a pool is charged for a given engine cost. The Lamina pool counts engine cost; every other pool is billed at the Lexari rate. */
export function billedFor(pool: Pool, cost: number, markup = LEXARI_MARKUP) {
  if (pool === "lamina" || pool === "free") return Math.max(0, Math.ceil(cost));
  return Math.max(0, Math.ceil(cost * (1 + markup)));
}
/** Rough token count of a prompt (4 characters a token, plus per-message overhead). Only used for holds and fallbacks. */
export function estimateTokens(parts: { content: string }[] | string) {
  if (typeof parts === "string") return Math.ceil(parts.length / 4);
  return parts.reduce((n, m) => n + Math.ceil((m.content || "").length / 4) + 4, 0);
}

export type MeterSnapshot = {
  paid: boolean;
  /** remaining in each included pool after other turns' holds (micro dollars) */
  laminaLeft: number;
  premiumLeft: number;
  /** extra credits balance after holds */
  credits: number;
  /** credits spent this cycle, including holds */
  creditsSpent: number;
  spendMode: SpendMode;
  spendLimit: number;
  /** Free accounts may use credits (CREDITS_ON_FREE) */
  creditsOnFree?: boolean;
};

/** Credits a turn may still spend this cycle: the balance, capped by the spend limit. */
export function creditsAvailable(s: Pick<MeterSnapshot, "credits" | "creditsSpent" | "spendMode" | "spendLimit">) {
  if (s.spendMode === "disabled") return 0;
  const room = s.spendMode === "unlimited" ? Infinity : Math.max(0, s.spendLimit - s.creditsSpent);
  return Math.max(0, Math.min(s.credits, room));
}

/** The pools a turn may draw from, in order. */
export function chainFor(paid: boolean, pool: ModelPool, creditsOnFree = CREDITS_ON_FREE): Pool[] {
  if (paid) return pool === "lamina" ? ["lamina", "premium", "credits"] : ["premium", "credits"];
  if (pool === "lamina") return creditsOnFree ? ["lamina", "credits"] : ["lamina"];
  return creditsOnFree ? ["credits"] : [];
}

function room(s: MeterSnapshot, p: Pool) {
  if (p === "free") return 0; // "free" only marks turns Lexari absorbs (receipts), never a pool a turn picks
  if (p === "lamina") return Math.max(0, s.laminaLeft);
  if (p === "premium") return Math.max(0, s.premiumLeft);
  return creditsAvailable(s);
}

export type Decision =
  | { ok: true; pool: Pool; chain: Pool[]; hold: number }
  | { ok: false; reason: BlockReason; chain: Pool[] };

/**
 * Picks the pool for a new turn and the hold to place. `estimate` is the estimated engine cost of the turn.
 * The first pool with room wins; the hold is the estimate billed for that pool, capped by its room.
 */
export function decide(s: MeterSnapshot, pool: ModelPool, estimate: number): Decision {
  const chain = chainFor(s.paid, pool, s.creditsOnFree ?? CREDITS_ON_FREE);
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i];
    const r = room(s, p);
    if (r <= 0) continue;
    const hold = Math.min(r, billedFor(p, estimate));
    return { ok: true, pool: p, chain: chain.slice(i), hold };
  }
  let reason: BlockReason;
  if (!s.paid && pool === "premium" && !(s.creditsOnFree ?? CREDITS_ON_FREE)) reason = "premium_locked";
  else if (!s.paid && pool === "premium" && s.credits <= 0) reason = "premium_locked";
  else if (s.credits > 0 && creditsAvailable(s) <= 0) reason = "spend_limit";
  else if (!s.paid) reason = "free_daily";
  else reason = "out_of_usage";
  return { ok: false, reason, chain };
}

export type Split = { lamina: number; premium: number; credits: number; billed: number; absorbed: number; free: boolean };

/**
 * Splits the real engine cost of a settled turn across its chain. Each pool takes what it can (billed at its own
 * rate); what is left spills to the next. Anything no pool can cover is absorbed by Lexari (it was within the hold
 * or a forced turn), so nobody is ever charged past their pools, credits or spend limit.
 */
export function split(s: MeterSnapshot, chain: Pool[], cost: number, markup = LEXARI_MARKUP): Split {
  const out: Split = { lamina: 0, premium: 0, credits: 0, billed: 0, absorbed: 0, free: false };
  if (chain[0] === "free") { out.free = true; return out; }
  let raw = Math.max(0, Math.ceil(cost)); // engine cost still to cover
  for (const p of chain) {
    if (raw <= 0) break;
    if (p === "free") continue;
    const r = room(s, p);
    if (r <= 0) continue;
    const factor = p === "lamina" ? 1 : 1 + markup;
    const want = Math.ceil(raw * factor);
    const take = Math.min(r, want);
    out[p] += take;
    out.billed += take;
    raw = take >= want ? 0 : Math.max(0, raw - Math.floor(take / factor));
  }
  out.absorbed = raw;
  return out;
}

/** Share of a pool used, 0 to 1 (for the meters and the 80 and 100 percent alerts). */
export const share = (used: number, limit: number) => (limit <= 0 ? (used > 0 ? 1 : 0) : Math.min(1, Math.max(0, used / limit)));
