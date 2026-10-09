/** ORE Miner hosts and their commands (migration 0017_miner_hosts.sql). */
import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const minerHosts = pgTable("miner_hosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("My server"),
  installHash: text("install_hash").unique(),
  installExpires: timestamp("install_expires", { withTimezone: true }),
  tokenHash: text("token_hash").unique(),
  report: jsonb("report"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("miner_hosts_user").on(t.userId)]);

export const minerCommands = pgTable("miner_commands", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  hostId: uuid("host_id").notNull().references(() => minerHosts.id, { onDelete: "cascade" }),
  cmd: text("cmd").notNull(),
  args: jsonb("args").notNull().default({}),
  state: text("state").notNull().default("queued"),
  output: text("output"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  doneAt: timestamp("done_at", { withTimezone: true }),
}, (t) => [index("miner_commands_host").on(t.hostId, t.state)]);
