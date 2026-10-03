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
