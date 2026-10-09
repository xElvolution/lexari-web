import { z } from "zod";
import { topupReceipt } from "@/server/topup/receipts";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Writes a confirmed crypto top-up into a chat as a receipt (only one that was already credited to you). */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, z.object({ convo: z.string().min(1).max(80), creditId: z.string().uuid().optional(), paymentId: z.string().uuid().optional() }).strict());
  if (b instanceof Response) return b;
  return Response.json({ receipt: await topupReceipt(user.userId, b.convo, b) });
});
