/** Agent tasks: meetings, long jobs, schedules, videos and deploys (migration 0025_agent_tasks.sql). */
import { customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

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

/** Published previews of sites an agent built (migration 0027_agent_sites.sql). */
export const agentSites = pgTable("agent_sites", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agent: text("agent").notNull().default("home"),
  slug: text("slug").notNull(),
  name: text("name").notNull().default(""),
  files: integer("files").notNull().default(0),
  bytes: integer("bytes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const agentSiteFiles = pgTable("agent_site_files", {
  siteId: text("site_id").notNull(),
  path: text("path").notNull(),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
}, (t) => [primaryKey({ columns: [t.siteId, t.path] })]);
