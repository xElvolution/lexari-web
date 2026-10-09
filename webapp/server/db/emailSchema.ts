/** Agent email tables (migration 0015_agent_email.sql). */
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const agentMailboxes = pgTable("agent_mailboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentSlug: text("agent_slug").notNull(),
  /** <agent_part>.<your email handle>; null until it's filled in on next open */
  local: text("local").unique(),
  /** the agent's name part, unique per person */
  agentPart: text("agent_part"),
  /** agent: from the agent's name; user: "<You> via Lexari" with Reply-To your address */
  senderMode: text("sender_mode").notNull().default("agent"),
  replyTo: text("reply_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("agent_mailboxes_user_agent").on(t.userId, t.agentSlug)]);

export const agentEmails = pgTable("agent_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mailboxId: uuid("mailbox_id").notNull().references(() => agentMailboxes.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  /** received | draft | sending | sent | cancelled | failed */
  status: text("status").notNull(),
  /** mail | forward_verify (a mailbox asking you to confirm forwarding to this address) */
  kind: text("kind").notNull().default("mail"),
  fromAddr: text("from_addr").notNull().default(""),
  fromName: text("from_name").notNull().default(""),
  toAddrs: text("to_addrs").array().notNull().default([]),
  ccAddrs: text("cc_addrs").array().notNull().default([]),
  replyTo: text("reply_to"),
  subject: text("subject").notNull().default(""),
  textBody: text("text_body").notNull().default(""),
  messageId: text("message_id"),
  inReplyTo: text("in_reply_to"),
  provider: text("provider").notNull().default("mock"),
  providerId: text("provider_id").unique(),
  verify: jsonb("verify").$type<{ service: string; code?: string; link?: string; for?: string } | null>(),
  convo: text("convo").notNull().default(""),
  chatMessageId: text("chat_message_id").notNull().default(""),
  error: text("error"),
  readAt: timestamp("read_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
