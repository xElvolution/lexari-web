/** Account protection (migration 0030_account_security.sql). */
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const userSecurity = pgTable("user_security", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  /** anti-phishing phrase, shown on every sensitive sheet so a fake Lexari page can't copy it */
  phrase: text("phrase").notNull().default(""),
  /** most your agents and wallet sends may move in a rolling day, in US dollars */
  dailySendCapUsd: integer("daily_send_cap_usd").notNull().default(100),
  /** only send to saved addresses */
  allowlistOnly: boolean("allowlist_only").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const addressBook = pgTable("address_book", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chain: text("chain").notNull(),
  address: text("address").notNull(),
  label: text("label").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("address_book_user_id_chain_address_key").on(t.userId, t.chain, t.address)]);

export const securityEvents = pgTable("security_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  detail: text("detail").notNull().default(""),
  device: text("device").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
