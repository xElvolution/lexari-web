/** Settings > Models tables (migration 0014_byo_models.sql). */
import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const userModels = pgTable("user_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** openai | anthropic | gemini | xai | openrouter | custom */
  provider: text("provider").notNull(),
  label: text("label").notNull().default(""),
  model: text("model").notNull(),
  baseUrl: text("base_url"),
  /** sealed with server/secretBox.ts, bound to the user id */
  keyEnc: text("key_enc").notNull(),
  keyLast4: text("key_last4").notNull().default(""),
  /** ok | failed | untested */
  status: text("status").notNull().default("untested"),
  statusNote: text("status_note"),
  testedAt: timestamp("tested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One API key per person and provider (migration 0018_model_keys.sql). */
export const userModelKeys = pgTable("user_model_keys", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** openai | anthropic | gemini | xai | openrouter */
  provider: text("provider").notNull(),
  /** sealed with server/secretBox.ts, bound to the user id */
  keyEnc: text("key_enc").notNull(),
  keyLast4: text("key_last4").notNull().default(""),
  /** OpenAI only: override base URL for an OpenAI-compatible endpoint */
  baseUrl: text("base_url"),
  status: text("status").notNull().default("untested"),
  statusNote: text("status_note"),
  testedAt: timestamp("tested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.provider] })]);
