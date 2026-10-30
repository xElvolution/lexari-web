/**
 * The marketplace in the database (migration 0038): developers, their keys and invites, listings with reviewed
 * versions, reviews and hire events. The house specialists (Scout, Patch, Pulse, Sonar and the rest) are listings
 * under the "Lexari" developer; third-party agents from the SDK sit next to them once a version is approved.
 */
import { bigint, boolean, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const developers = pgTable("developers", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** null only for the house developer (Lexari) */
  userId: uuid("user_id").unique().references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  url: text("url").notNull().default(""),
  verified: boolean("verified").notNull().default(false),
  /** active | suspended */
  status: text("status").notNull().default("active"),
  house: boolean("house").notNull().default(false),
  termsAt: timestamp("terms_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const developerInvites = pgTable("developer_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique(),
  note: text("note").notNull().default(""),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  usedBy: uuid("used_by").references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const developerKeys = pgTable("developer_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  developerId: uuid("developer_id").notNull().references(() => developers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** the first characters, shown in lists ("lxk_test_AbC1") */
  prefix: text("prefix").notNull(),
  /** sha256 of the whole key; the key itself is shown once and never stored */
  keyHash: text("key_hash").notNull().unique(),
  scopes: text("scopes").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const developerDeviceCodes = pgTable("developer_device_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceHash: text("device_hash").notNull().unique(),
  userCode: text("user_code").notNull().unique(),
  /** pending | approved | denied | used */
  status: text("status").notNull().default("pending"),
  developerId: uuid("developer_id").references(() => developers.id, { onDelete: "cascade" }),
  keyId: uuid("key_id").references(() => developerKeys.id, { onDelete: "set null" }),
  label: text("label").notNull().default(""),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentListings = pgTable("agent_listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  developerId: uuid("developer_id").notNull().references(() => developers.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  /** draft | in_review | listed | delisted */
  status: text("status").notNull().default("draft"),
  house: boolean("house").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(1000),
  currentVersionId: uuid("current_version_id"),
  /** HMAC secret for this listing's webhook tools, sealed with server/secretBox */
  webhookSecret: text("webhook_secret"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const listingVersions = pgTable("listing_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").notNull().references(() => agentListings.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  /** the developer's manifest (sdk/packages/manifest); null for house listings */
  manifest: jsonb("manifest").$type<Record<string, unknown> | null>(),
  /** the store card (content/appData Specialist shape) */
  card: jsonb("card").$type<Record<string, unknown>>().notNull(),
  contentHash: text("content_hash").notNull(),
  /** pending | approved | rejected | superseded */
  status: text("status").notNull().default("pending"),
  checks: jsonb("checks").$type<{ name: string; ok: boolean; detail?: string }[]>().notNull().default([]),
  reviewNotes: text("review_notes").notNull().default(""),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("listing_versions_listing_version").on(t.listingId, t.version)]);

export const listingReviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").notNull().references(() => agentListings.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stars: smallint("stars").notNull(),
  body: text("body").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("reviews_listing_user").on(t.listingId, t.userId)]);

export const hireEvents = pgTable("hire_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").notNull().references(() => agentListings.id, { onDelete: "cascade" }),
  versionId: uuid("version_id").references(() => listingVersions.id, { onDelete: "set null" }),
  buyerId: uuid("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ref: text("ref").notNull().unique(),
  grossMicros: bigint("gross_micros", { mode: "number" }).notNull().default(0),
  developerMicros: bigint("developer_micros", { mode: "number" }).notNull().default(0),
  lexariMicros: bigint("lexari_micros", { mode: "number" }).notNull().default(0),
  splitBps: integer("split_bps").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
