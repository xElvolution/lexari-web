/** Desktop sign-in handoff codes (migration 0036_desktop_auth_codes.sql). */
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const desktopAuthCodes = pgTable("desktop_auth_codes", {
  codeHash: text("code_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
