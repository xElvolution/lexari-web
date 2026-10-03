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
  meta: z.object({ nick: z.string().max(40).optional(), notes: z.string().max(2000).optional(), you: z.string().max(40).optional(), color: z.string().max(20).optional() }).partial().default({}),
}).strict();

export const agentNotes = z.object({ nick: z.string().max(40).optional(), notes: z.string().max(2000).optional(), memoryOn: z.boolean().optional() }).strict();
export const rehireBody = z.object({ slug: z.string().min(1).max(40) }).strict();

export const hireBody = z.object({
  slug: z.string().min(1).max(40),
  tx: z.string().min(64).max(100),
  mint: z.enum(["SOL", "USDC"]),
}).strict();

export const mePatch = z.object({
  profile: z.object({ name: z.string().max(60), username: z.string().max(30), bio: z.string().max(300) }).partial().optional(),
  prefs: z.record(z.string(), z.union([z.string().max(2000), z.boolean(), z.number(), z.array(z.string().max(80)).max(50), z.record(z.string(), z.boolean())])).optional(),
}).strict();

export const chatBody = z.object({
  convo: z.string().min(1).max(80),
  text: z.string().min(1).max(4000),
  speaker: z.string().min(1).max(80),
  history: z.array(z.object({ from: z.string().max(80), text: z.string().max(2000) })).max(16).default([]),
  recall: z.array(z.object({ tag: z.string().max(40), text: z.string().max(240) })).max(8).default([]),
  userMsgId: z.string().min(4).max(40),
  replyMsgId: z.string().min(4).max(40),
  meta: z.object({ file: z.object({ name: z.string().max(120), size: z.string().max(20) }).optional(), voice: z.number().max(3600).optional(), reply: z.object({ id: z.string().max(40), from: z.string().max(80), text: z.string().max(300) }).optional() }).partial().default({}),
}).strict();

export const groupBody = z.object({
  slug: z.string().regex(/^g-[a-z0-9]{4,20}$/),
  title: z.string().min(1).max(60),
  members: z.array(z.string().max(80)).min(1).max(12),
}).strict();

export const reactionBody = z.object({
  convo: z.string().min(1).max(80),
  clientId: z.string().min(4).max(40),
  re: z.record(z.string().max(8), z.array(z.string().max(80)).max(20)),
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
