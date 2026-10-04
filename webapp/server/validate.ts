import { z } from "zod";

const wallet = z.string().min(32).max(44);
const slug = z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9-]*$/i, "letters, numbers and dashes");

export const nonceBody = z.object({ wallet }).strict();

export const verifyBody = z.object({
  wallet,
  message: z.string().min(20).max(2000),
  signature: z.string().min(64).max(200),
  referral: z.string().min(4).max(16).optional(),
  privyToken: z.string().min(20).max(4000).optional(),
  email: z.string().max(200).optional(),
}).strict();

export const memoryBody = z.object({
  agentSlug: slug,
  tag: z.string().max(40).default(""),
  source: z.string().max(60).default(""),
  ciphertext: z.string().min(8).max(20000),
  iv: z.string().min(8).max(80),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

export const voiceBody = z.object({ name: z.string().max(120).default(""), pitch: z.number().min(0.5).max(2).default(1), rate: z.number().min(0.5).max(2).default(1), preset: z.string().max(20).optional() }).strict();
const look = z.union([z.number().int(), z.null(), z.record(z.string(), z.unknown())]);
export const agentBody = z.object({
  slug,
  kind: z.enum(["home", "custom"]).default("home"),
  name: z.string().min(1).max(40),
  role: z.string().max(80).default(""),
  tone: z.string().max(40).default(""),
  about: z.string().max(2000).default(""),
  skills: z.array(z.string().max(40)).max(20).default([]),
  memoryOn: z.boolean().default(true),
  look: look.optional(),
  meta: z.object({ nick: z.string().max(40).optional(), notes: z.string().max(2000).optional(), you: z.string().max(40).optional(), color: z.string().max(20).optional(), voice: voiceBody.optional() }).partial().default({}),
}).strict();

export const agentNotes = z.object({ nick: z.string().max(40).optional(), notes: z.string().max(2000).optional(), memoryOn: z.boolean().optional(), voice: voiceBody.nullable().optional() }).strict();
export const rehireBody = z.object({ slug: z.string().min(1).max(40) }).strict();

export const hireBody = z.object({
  slug: z.string().min(1).max(40),
  tx: z.string().min(64).max(100),
  mint: z.enum(["SOL", "USDC"]),
}).strict();

export const mePatch = z.object({
  profile: z.object({ name: z.string().max(60), username: z.string().max(30), bio: z.string().max(300), coverFit: z.string().max(20) }).partial().optional(),
  prefs: z.record(z.string(), z.union([z.string().max(2000), z.boolean(), z.number(), z.array(z.string().max(80)).max(50), z.record(z.string(), z.boolean())])).optional(),
}).strict();

export const chatBody = z.object({
  convo: z.string().min(1).max(80),
  text: z.string().min(1).max(4000),
  speaker: z.string().min(1).max(80),
  history: z.array(z.object({ from: z.string().max(80), text: z.string().max(2000) })).max(16).default([]),
  recall: z.array(z.object({ tag: z.string().max(40), text: z.string().max(240) })).max(20).default([]),
  userMsgId: z.string().min(4).max(40),
  replyMsgId: z.string().min(4).max(40),
  meta: z.object({ file: z.object({ name: z.string().max(120), size: z.string().max(20) }).optional(), voice: z.number().max(3600).optional(), reply: z.object({ id: z.string().max(40), from: z.string().max(80), text: z.string().max(300) }).optional() }).partial().default({}),
  /** a live voice call turn: answered in short spoken sentences and not saved to the chat */
  call: z.boolean().optional(),
  /** a group turn after the first member answered (the same message, so it doesn't count against the per-minute limit) */
  follow: z.boolean().optional(),
  /** what other group members already answered to this message */
  peers: z.array(z.object({ from: z.string().max(80), text: z.string().max(1200) })).max(12).optional(),
  /** a transaction receipt just landed in this chat: the agent follows up on it (no message from the person) */
  event: z.object({ tx: z.string().regex(/^tx-[A-Za-z0-9_-]{4,37}$/) }).strict().optional(),
  /** the person's time zone (IANA), so "today" and times in the wallet history are theirs */
  tz: z.string().max(64).regex(/^[A-Za-z0-9_+\-/]+$/).optional(),
}).strict();

export const groupBody = z.object({
  slug: z.string().regex(/^g-[a-z0-9]{4,20}$/),
  title: z.string().min(1).max(60),
  members: z.array(z.string().max(80)).min(1).max(12),
}).strict();

export const reactionBody = z.object({
  convo: z.string().min(1).max(80),
  clientId: z.string().min(4).max(40),
  re: z.record(z.string().max(8), z.array(z.string().max(80)).max(20)).optional(),
  /** The outcome of a transfer the agent prepared (status only; amount and recipient can't change). */
  send: z.object({ status: z.enum(["sent", "cancelled", "failed"]), sig: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/).optional(), error: z.string().max(200).optional() }).strict().optional(),
}).strict();

export const messageBody = z.object({
  convo: z.string().min(1).max(80),
  clientId: z.string().min(4).max(40),
  from: z.literal("system"),
  text: z.string().max(200),
  meta: z.object({ call: z.number().max(36000) }).partial().default({}),
}).strict();

export const claimBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("quest"), questId: z.string().max(30) }).strict(),
  z.object({ kind: z.literal("box") }).strict(),
  z.object({ kind: z.literal("tier"), tier: z.number().int().min(0).max(9) }).strict(),
]);
export const signatureBody = z.object({ signature: z.string().min(64).max(100) }).strict();

export const cardBuyBody = z.object({
  agent: z.string().regex(/^[a-z0-9-]{1,40}$/),
  tx: z.string().min(64).max(100),
  limit: z.number().int().min(10).max(5000),
}).strict();

export const cardPatchBody = z.object({
  agent: z.string().regex(/^[a-z0-9-]{1,40}$/),
  frozen: z.boolean().optional(),
  limit: z.number().int().min(10).max(5000).optional(),
}).strict();

export const planBuyBody = z.object({ plan: z.enum(["pro", "plus", "max"]), tx: z.string().min(64).max(100), period: z.enum(["month", "year"]).default("month") }).strict();
export const lockBody = z.object({ pin: z.string().regex(/^[0-9]{4,6}$/, "4 to 6 digits"), current: z.string().max(6).optional() }).strict();
export const lockCheckBody = z.object({ pin: z.string().regex(/^[0-9]{4,6}$/, "4 to 6 digits") }).strict();
