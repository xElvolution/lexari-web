/** Agent budgets and x402 receipts (migration 0016_agent_budgets.sql). */
import { bigint, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const agentBudgets = pgTable("agent_budgets", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentSlug: text("agent_slug").notNull(),
  perTaskMicros: bigint("per_task_micros", { mode: "number" }).notNull().default(500_000),
  dailyMicros: bigint("daily_micros", { mode: "number" }).notNull().default(2_000_000),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.agentSlug] })]);

export const x402Receipts = pgTable("x402_receipts", {
  sig: text("sig").primaryKey(),
  service: text("service").notNull(),
  payer: text("payer").notNull(),
  amountAtoms: bigint("amount_atoms", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
