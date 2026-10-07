/** Tables for models and billing (migration 0009_models_billing.sql). Money is in micro dollars (USD x 1e6). */
import { bigint, boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

/** One billing cycle: the Lamina and premium pools included in the plan, and extra credits spent in it. */
export const usagePeriods = pgTable(
  "usage_periods",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    plan: text("plan").notNull(),
    laminaLimit: bigint("lamina_limit_micros", { mode: "number" }).notNull().default(0),
    laminaUsed: bigint("lamina_used_micros", { mode: "number" }).notNull().default(0),
    premiumLimit: bigint("premium_limit_micros", { mode: "number" }).notNull().default(0),
    premiumUsed: bigint("premium_used_micros", { mode: "number" }).notNull().default(0),
    creditsUsed: bigint("credits_used_micros", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.periodStart] })],
);

/** A reservation for one turn, placed before the model is called. Expired holds no longer count. */
export const usageHolds = pgTable("usage_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pool: text("pool").notNull(),
  micros: bigint("micros", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const usageLedger = pgTable("usage_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  convo: text("convo").notNull().default(""),
  agentSlug: text("agent_slug").notNull().default(""),
  /** chat | call | event */
  kind: text("kind").notNull().default("chat"),
  /** free | lamina | premium | credits (the pool the turn started on) */
  pool: text("pool").notNull(),
  requestedModel: text("requested_model").notNull(),
  servedModel: text("served_model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
  billedMicros: bigint("billed_micros", { mode: "number" }).notNull().default(0),
  laminaMicros: bigint("lamina_micros", { mode: "number" }).notNull().default(0),
  premiumMicros: bigint("premium_micros", { mode: "number" }).notNull().default(0),
  creditsMicros: bigint("credits_micros", { mode: "number" }).notNull().default(0),
  estimated: boolean("estimated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billingSettings = pgTable("billing_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  creditMicros: bigint("credit_micros", { mode: "number" }).notNull().default(0),
  /** disabled | fixed | unlimited */
  spendMode: text("spend_mode").notNull().default("fixed"),
  spendLimit: bigint("spend_limit_micros", { mode: "number" }).notNull().default(25_000_000),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  delta: bigint("delta_micros", { mode: "number" }).notNull(),
  /** topup_card | topup_crypto | dev_grant | refund */
  reason: text("reason").notNull(),
  ref: text("ref").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** card | crypto */
  rail: text("rail").notNull(),
  /** the card provider id, or "solana-usdc" */
  provider: text("provider").notNull(),
  /** plan | credits */
  product: text("product").notNull(),
  /** plan id ("pro") or a credits pack ("credits-10") */
  sku: text("sku").notNull(),
  /** cents for card, USDC base units for crypto */
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: text("currency").notNull(),
  /** pending | paid | failed | expired */
  status: text("status").notNull().default("pending"),
  providerRef: text("provider_ref").unique(),
  txSig: text("tx_sig").unique(),
  /** Solana Pay reference key (crypto) */
  reference: text("reference").unique(),
  payer: text("payer"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});
