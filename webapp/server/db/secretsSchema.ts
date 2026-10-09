/** Secrets vault tables (migration 0020_user_secrets.sql). */
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const userSecrets = pgTable("user_secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** UPPER_SNAKE_CASE; the env var name the agent's commands see */
  name: text("name").notNull(),
  label: text("label").notNull().default(""),
  service: text("service").notNull().default(""),
  /** sealed with server/secretBox.ts; AAD "secret:<user id>:<row id>" */
  valueEnc: text("value_enc").notNull(),
  last4: text("last4").notNull().default(""),
  /** agent slugs that may use it; empty = every agent */
  agents: text("agents").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const secretRequests = pgTable("secret_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agent: text("agent").notNull(),
  convo: text("convo").notNull(),
  messageId: text("message_id").notNull(),
  name: text("name").notNull(),
  label: text("label").notNull().default(""),
  service: text("service").notNull().default(""),
  why: text("why").notNull().default(""),
  /** pending | saved | cancelled */
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  doneAt: timestamp("done_at", { withTimezone: true }),
});
