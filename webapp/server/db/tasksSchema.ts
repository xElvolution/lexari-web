/** Agent tasks: meetings, long jobs, schedules, videos and deploys (migration 0025_agent_tasks.sql). */
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const agentTasks = pgTable("agent_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agent: text("agent").notNull().default("home"),
  convo: text("convo").notNull().default("home"),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  title: text("title").notNull().default(""),
  spec: jsonb("spec").$type<Record<string, unknown>>().notNull().default({}),
  state: jsonb("state").$type<Record<string, unknown>>().notNull().default({}),
  result: text("result"),
  jobId: text("job_id"),
  nextRun: timestamp("next_run", { withTimezone: true }),
  lastRun: timestamp("last_run", { withTimezone: true }),
  runs: integer("runs").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [index("agent_tasks_user").on(t.userId, t.createdAt)]);
