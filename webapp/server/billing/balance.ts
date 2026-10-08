/**
 * The Lexari balance: one balance in US dollars, funded by Top up (card or USDC) and spent on AI usage past the plan,
 * hires, agent cards and funding agents. It is the extra credits balance (billing_settings.credit_micros, the cached
 * sum of credit_ledger). Every change is one credit_ledger row with a unique ref, so a retried request can't charge
 * twice: the ref is the idempotency key.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { DEFAULT_SPEND_LIMIT_USD, MICROS } from "@/content/billing";
import { db } from "../db";
import { agentFundings, billingSettings, creditLedger, payments } from "../db/billingSchema";
import { agents } from "../db/schema";
import { planById, specialistBySlug } from "@/content/appData";
import { HttpError } from "../http";
import { usdToMicros } from "./math";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

export const usd = (micros: number) => `$${(micros / MICROS).toFixed(2)}`;

/** 402 with what's missing, so the app can open Top up with the shortfall filled in and then finish the purchase. */
export class ShortBalance extends HttpError {
  constructor(public need: number, public have: number, what: string) {
    super(402, `${what} costs ${usd(need)} and your balance is ${usd(have)}. Top up ${usd(need - have)} to continue.`, { billing: { reason: "short_balance", needMicros: need, haveMicros: have, shortMicros: need - have } });
  }
}

async function lockBalance(tx: Tx, userId: string) {
  await tx.insert(billingSettings).values({ userId, spendLimit: usdToMicros(DEFAULT_SPEND_LIMIT_USD) }).onConflictDoNothing();
  const [row] = await tx.select({ credit: billingSettings.creditMicros }).from(billingSettings).where(eq(billingSettings.userId, userId)).for("update");
  return row?.credit ?? 0;
}

/**
 * Debits the balance inside the caller's transaction. Returns already=true (and charges nothing) when this ref was
 * charged before. Throws ShortBalance when the balance can't cover it.
 */
export async function charge(tx: Tx, userId: string, micros: number, reason: string, ref: string, what: string) {
  if (!(micros > 0)) throw new HttpError(400, "Nothing to pay.");
  const have = await lockBalance(tx, userId); // row lock: two purchases at once can't both spend the same dollars
  const [prev] = await tx.select({ id: creditLedger.id }).from(creditLedger).where(eq(creditLedger.ref, ref)).limit(1);
  if (prev) return { already: true, ledgerId: prev.id, balance: have };
  if (have < micros) throw new ShortBalance(micros, have, what);
  const [row] = await tx.insert(creditLedger).values({ userId, delta: -micros, reason, ref }).returning({ id: creditLedger.id });
  await tx.update(billingSettings).set({ creditMicros: sql`${billingSettings.creditMicros} - ${micros}`, updatedAt: new Date() }).where(eq(billingSettings.userId, userId));
  return { already: false, ledgerId: row.id, balance: have - micros };
}

/** Credits the balance once per ref (refunds, money coming back from an agent's wallet). */
export async function credit(tx: Tx, userId: string, micros: number, reason: string, ref: string) {
  if (!(micros > 0)) return { already: true };
  await lockBalance(tx, userId);
  const ins = await tx.insert(creditLedger).values({ userId, delta: micros, reason, ref }).onConflictDoNothing().returning({ id: creditLedger.id });
  if (!ins.length) return { already: true };
  await tx.update(billingSettings).set({ creditMicros: sql`${billingSettings.creditMicros} + ${micros}`, updatedAt: new Date() }).where(eq(billingSettings.userId, userId));
  return { already: false };
}

const LABEL: Record<string, string> = {
  topup_card: "Top up by card", topup_crypto: "Top up with USDC", dev_grant: "Test top up", refund: "Refund",
  plan: "Plan", hire: "Hired a specialist", card: "Agent card", fund: "Funded an agent", fund_refund: "Funding refunded", fund_return: "Back from an agent's wallet",
};
/** The balance and its history (top ups, hires, cards, agent funding, refunds; AI usage folded into one row per day). */
export async function balanceView(userId: string) {
  const database = db();
  const [settings] = await database.select({ credit: billingSettings.creditMicros }).from(billingSettings).where(eq(billingSettings.userId, userId)).limit(1);
  const rows = await database.select().from(creditLedger).where(and(eq(creditLedger.userId, userId), inArray(creditLedger.reason, Object.keys(LABEL)))).orderBy(desc(creditLedger.createdAt)).limit(40);
  const plans = await database.select().from(payments).where(and(eq(payments.userId, userId), eq(payments.product, "plan"), eq(payments.status, "paid"))).orderBy(desc(payments.createdAt)).limit(10);
  const usage = await database.execute<{ day: string; total: string }>(sql`select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, sum(delta_micros)::bigint as total from credit_ledger where user_id = ${userId} and reason = 'usage' group by 1 order by 1 desc limit 14`);
  // Name the agent where we can: "Hired Ava", "Funded Rika", "Card for Scout".
  const fundIds = rows.filter((r) => r.ref?.startsWith("fund:") || r.ref?.startsWith("fund-refund:")).map((r) => r.ref!.slice(r.ref!.indexOf(":") + 1));
  const funded = fundIds.length ? await database.select({ id: agentFundings.id, slug: agentFundings.agentSlug }).from(agentFundings).where(inArray(agentFundings.id, fundIds)) : [];
  const team = await database.select({ slug: agents.slug, name: agents.name }).from(agents).where(eq(agents.userId, userId));
  const nameOf = (slug?: string) => (slug && team.find((t) => t.slug === slug)?.name) || specialistBySlug(slug || "")?.name || "";
  const agentFor = (r: { reason: string; ref: string | null }) => {
    const ref = r.ref || "";
    if (r.reason === "hire" || r.reason === "card") return nameOf(ref.split(":")[2]);
    if (r.reason === "fund" || r.reason === "fund_refund") return nameOf(funded.find((f) => f.id === ref.slice(ref.indexOf(":") + 1))?.slug);
    return "";
  };
  const named = (r: { reason: string; ref: string | null }) => {
    if (r.reason === "plan") { const [, , , id, period] = (r.ref || "").split(":"); return `${planById(id || "").name} plan, ${period === "yearly" ? "yearly" : "monthly"}`; }
    const n = agentFor(r);
    if (!n) return LABEL[r.reason] ?? r.reason;
    return r.reason === "hire" ? `Hired ${n}` : r.reason === "card" ? `Card for ${n}` : r.reason === "fund" ? `Funded ${n}'s wallet` : `Funding ${n} refunded`;
  };
  const history = [
    ...rows.map((r) => ({ id: r.id, kind: r.reason, label: named(r), ref: r.ref, delta: r.delta, at: r.createdAt.getTime() })),
    // Plans paid straight by card or USDC (older flow): listed for the record, the balance doesn't move.
    ...plans.map((p) => ({ id: p.id, kind: "plan", label: `${planById(p.sku.split("-")[1] || "").name} plan, ${p.sku.endsWith("-yearly") ? "yearly" : "monthly"}`, ref: null, delta: 0, paid: p.currency === "USD" ? p.amountMinor * 10_000 : p.amountMinor, at: (p.paidAt ?? p.createdAt).getTime() })),
    ...[...usage].map((u) => ({ id: `usage-${u.day}`, kind: "usage", label: "AI usage past your plan", ref: null, delta: Number(u.total), at: new Date(`${u.day}T12:00:00Z`).getTime() })),
  ].sort((a, b) => b.at - a.at).slice(0, 40);
  return { balance: Math.max(0, settings?.credit ?? 0), history };
}
