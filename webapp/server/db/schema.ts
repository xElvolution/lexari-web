import { bigint, boolean, customType, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/** Wallet is the account. Nonce fields are cleared after a successful sign-in. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull().unique(),
  nonce: text("nonce"),
  nonceMessage: text("nonce_message"),
  nonceExpires: timestamp("nonce_expires", { withTimezone: true }),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: uuid("referred_by"),
  privyDid: text("privy_did"),
  email: text("email"),
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
  prefs: jsonb("prefs").$type<Record<string, unknown>>().notNull().default({}),
  /** app lock PIN: scrypt hash "salt:hash", null when off */
  lockHash: text("lock_hash"),
  /** WebAuthn credential ids allowed to unlock */
  lockCreds: jsonb("lock_creds").$type<{ id: string; at: number }[]>().notNull().default([]),
  /** account default model for agents without their own (content/models.ts id or key:<provider>:<model>); null = Lamina */
  defaultModel: text("default_model"),
  /** agent email name: agents are <agent>.<this>@agents.lexari.ai; unique; your first name until you choose once */
  emailHandle: text("email_handle"),
  emailHandleChosen: boolean("email_handle_chosen").notNull().default(false),
  /** Settings > Models switches: { on, off, extra } (content/models.ts ModelPrefs) */
  modelPrefs: jsonb("model_prefs").$type<{ on?: string[]; off?: string[]; extra?: string[] }>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    tone: text("tone").notNull().default(""),
    lookJson: jsonb("look_json").$type<Record<string, unknown>>().notNull().default({}),
    asset: text("asset"),
    agentPda: text("agent_pda"),
    mintedAt: timestamp("minted_at", { withTimezone: true }),
    /** home: your agent; custom: one you made; hired: a house specialist you hired */
    kind: text("kind").notNull().default("home"),
    about: text("about").notNull().default(""),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    memoryOn: boolean("memory_on").notNull().default(true),
    /** your nickname and notes, the minted card record */
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    /** the model this agent answers with (content/models.ts); null = Lamina */
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agents_user_slug").on(t.userId, t.slug)],
);

/** Ciphertext only. Plaintext never lands here. */
export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  tag: text("tag").notNull().default(""),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  contentHash: text("content_hash").notNull(),
  uri: text("uri").notNull().default(""),
  onchainPda: text("onchain_pda"),
  useCount: integer("use_count").notNull().default(0),
  source: text("source").notNull().default(""),
  chainTx: text("chain_tx"),
  revoked: boolean("revoked").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chats = pgTable(
  "chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull().default(""),
    memberSlugs: text("member_slugs").array().notNull().default([]),
    /** the model for this chat only; null = the agent's model */
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("chats_user_slug").on(t.userId, t.slug)],
);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  fromId: text("from_id").notNull(),
  text: text("text").notNull(),
  metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
  clientId: text("client_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  prompt: text("prompt").notNull(),
  /** running | done | failed */
  status: text("status").notNull(),
  assignee: text("assignee").notNull().default("home"),
  title: text("title").notNull().default(""),
  output: text("output").notNull().default(""),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const questProgress = pgTable(
  "quest_progress",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    periodKey: text("period_key").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questId, t.periodKey] })],
);

export const questEvents = pgTable("quest_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  /** what caused it: a tx signature, a job id. (user, kind, ref) is unique. */
  ref: text("ref"),
  amount: integer("amount").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Each Lexari instruction seen confirmed onchain, once. */
export const chainLedger = pgTable(
  "chain_ledger",
  {
    signature: text("signature").notNull(),
    ixIndex: integer("ix_index").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull().default(0),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    slot: bigint("slot", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.signature, t.ixIndex] })],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  priceLamports: bigint("price_lamports", { mode: "number" }).notNull(),
  mint: text("mint").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hires = pgTable("hires", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
  buyerId: uuid("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** payment signature, unique */
  tx: text("tx").notNull(),
  slug: text("slug").notNull().default(""),
  mint: text("mint").notNull().default("SOL"),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  payer: text("payer").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  refereeId: uuid("referee_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One virtual card per agent. issuer "devnet-test" cards are test cards; a real issuer stores its id in externalId. */
export const agentCards = pgTable(
  "agent_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    agentKey: text("agent_key").notNull(),
    issuer: text("issuer").notNull().default("devnet-test"),
    externalId: text("external_id"),
    number: text("number").notNull(),
    last4: text("last4").notNull(),
    expMonth: integer("exp_month").notNull(),
    expYear: integer("exp_year").notNull(),
    cvv: text("cvv").notNull(),
    spendLimit: integer("spend_limit").notNull().default(250),
    spent: integer("spent").notNull().default(0),
    frozen: boolean("frozen").notNull().default(false),
    payTx: text("pay_tx").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agent_cards_user_agent").on(t.userId, t.agentKey), uniqueIndex("agent_cards_pay_tx_key").on(t.payTx)],
);

/** A plan paid in devnet SOL to the treasury. Active until expiresAt. */
export const planPurchases = pgTable("plan_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  tx: text("tx").notNull().unique(),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  payer: text("payer").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** when the plan starts counting (null = createdAt); a renewal starts when the current one ends */
  startsAt: timestamp("starts_at", { withTimezone: true }),
  /** the payments row (card or USDC) that bought it; null for older devnet SOL purchases */
  paymentId: uuid("payment_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** monthly | yearly (migration 0012). A yearly plan runs a calendar year and refills its pools every month. */
  period: text("period").notNull().default("monthly"),
});

/** Devnet SOL the server sent to a person, so the per-person cap holds. */
export const faucetGrants = pgTable("faucet_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  wallet: text("wallet").notNull(),
  tx: text("tx").notNull(),
  lamports: bigint("lamports", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Profile picture and cover photo (already cropped and resized in the browser). */
export const userMedia = pgTable("user_media", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.kind] })]);

/** The bell: things that happened for you. key makes one-off events (quest ready, box ready) send once. */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  url: text("url").notNull().default("/app"),
  key: text("key"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("notifications_key").on(t.userId, t.key)]);

/** Browsers that said yes to push notifications. */
export const pushSubs = pgTable("push_subs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Hub (offchain coins and levels) ---------- */
export const hubPlayers = pgTable("hub_players", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  coins: bigint("coins", { mode: "number" }).notNull().default(0),
  lifetime: bigint("lifetime", { mode: "number" }).notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastCheckIn: bigint("last_check_in", { mode: "number" }).notNull().default(0),
  cosmetics: jsonb("cosmetics").$type<{ owned?: string[]; bg?: string; bubble?: string }>().notNull().default({}),
  seededFrom: text("seeded_from").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const hubLevels = pgTable("hub_levels", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.slug] })]);
export const hubClaims = pgTable("hub_claims", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  coins: integer("coins").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.key] })]);

/* ---------- Social accounts linked through Privy (0008) ---------- */
export const socialLinks = pgTable("social_links", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").$type<"twitter" | "discord" | "telegram">().notNull(),
  subject: text("subject").notNull(),
  handle: text("handle"),
  privyDid: text("privy_did"),
  rewardable: boolean("rewardable").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.provider] }), uniqueIndex("social_links_provider_subject").on(t.provider, t.subject)]);
export const socialSeen = pgTable("social_seen", {
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  firstUserId: uuid("first_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.provider, t.subject] })]);

/** Files in chat: sent by an agent from its computer, made by the image tool, or uploaded by you. Owner-only. */
export const agentFiles = pgTable("agent_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** agent | upload | generated */
  source: text("source").notNull(),
  agentSlug: text("agent_slug").notNull().default(""),
  convo: text("convo").notNull().default(""),
  messageId: text("message_id").notNull().default(""),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  /** where it lives on the agent's computer */
  path: text("path").notNull().default(""),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
