/** Top up with any coin (migration 0014_topup_rails.sql). Base-unit amounts are numeric strings. */
import { sql } from "drizzle-orm";
import { bigint, doublePrecision, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const topupWatches = pgTable("topup_watches", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rail: text("rail").notNull(),
  address: text("address").notNull(),
  creditedAtoms: numeric("credited_atoms", { precision: 78, scale: 0 }).notNull().default("0"),
  seenAtoms: numeric("seen_atoms", { precision: 78, scale: 0 }).notNull().default("0"),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.rail] })]);

export const topupXrpTags = pgTable("topup_xrp_tags", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  tag: bigint("tag", { mode: "number" }).notNull().default(sql`nextval('topup_xrp_tag_seq')`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const topupCredits = pgTable("topup_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rail: text("rail").notNull(),
  atoms: numeric("atoms", { precision: 78, scale: 0 }).notNull(),
  usdMicros: bigint("usd_micros", { mode: "number" }).notNull(),
  price: doublePrecision("price").notNull(),
  ref: text("ref").notNull(),
  tx: text("tx"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
