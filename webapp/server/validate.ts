import { z } from "zod";

export const nonceBody = z.object({
  wallet: z.string().min(32).max(44),
}).strict();

export const verifyBody = z.object({
  wallet: z.string().min(32).max(44),
  message: z.string().min(20).max(2000),
  signature: z.string().min(64).max(200),
  referral: z.string().min(4).max(16).optional(),
}).strict();

export const memoryBody = z.object({
  agentSlug: z.string().min(1).max(80),
  tag: z.string().max(40).default(""),
  ciphertext: z.string().min(8).max(20000),
  iv: z.string().min(8).max(80),
  contentHash: z.string().length(64),
  uri: z.string().max(200).default(""),
}).strict();

export const agentBody = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(40),
  role: z.string().max(80).default(""),
  tone: z.string().max(40).default(""),
  look: z.record(z.string(), z.unknown()).optional(),
  asset: z.string().min(32).max(50).optional(),
  agentPda: z.string().min(32).max(50).optional(),
}).strict();

export const hireBody = z.object({
  slug: z.string().min(1).max(40),
  tx: z.string().min(32).max(100),
  priceLamports: z.number().int().positive(),
  mint: z.enum(["SOL", "USDC"]),
}).strict();
