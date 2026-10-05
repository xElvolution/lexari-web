import { z } from "zod";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { chatReceipts, checkSig, isSig, noticeIncoming, readTx, recordTx, settleTx, type TxEvent } from "@/server/txlog";

export const runtime = "nodejs";

const txBody = z.object({
  convo: z.string().min(1).max(80),
  id: z.string().regex(/^[A-Za-z0-9_-]{4,37}$/),
  kind: z.enum(["send", "fund", "hire", "plan", "card", "mint"]),
  status: z.enum(["pending", "confirmed", "failed", "cancelled"]),
  sol: z.number().min(0).max(1000),
  to: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).optional(),
  sig: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/).optional(),
  error: z.string().max(200).optional(),
  agent: z.string().max(80).optional(),
  label: z.string().max(80).optional(),
}).strict();

/**
 * A Confirm card's outcome, written into the chat as a receipt. "confirmed" is never taken on trust: the signature is
 * checked on chain (amount and recipient from the chain), and anything not final yet is followed in the background.
 */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, txBody);
  if (body instanceof Response) return body;
  if (!(await rateLimit(`tx:${user.userId}`, 40))) return jsonError(429, "Too many updates. Wait a minute.");
  const prev = await readTx(user.userId, body.convo, body.id);
  const { convo, ...fields } = body;
  let ev: TxEvent = { ...(prev || {}), ...fields, at: prev?.at || Date.now() } as TxEvent;
  if (body.status === "confirmed" && !body.sig) ev.status = "failed";
  if (ev.sig && (body.status === "confirmed" || body.status === "pending")) {
    // a quick status check only; the background follower fills in the on-chain amount, fee and new balance
    const quick = checkSig(ev.sig, user.wallet, ev.to, false).catch(() => ({ status: "pending" as const }));
    const r = await Promise.race([quick, new Promise<{ status: "pending" }>((res) => setTimeout(() => res({ status: "pending" }), 2500))]);
    ev.status = r.status;
    if ("error" in r && r.error) ev.error = r.error;
  }
  ev = await recordTx(user.userId, convo, ev);
  if (ev.sig && (ev.status === "pending" || ev.status === "confirmed")) void settleTx(user.userId, convo, body.id, user.wallet).catch(() => {});
  return Response.json({ tx: ev, id: `tx-${body.id}` });
});

/** Receipts in a chat with their latest status; also logs SOL that arrived from elsewhere. */
export const GET = withUser(async (user, req) => {
  const url = new URL(req.url);
  const convo = (url.searchParams.get("convo") || "home").slice(0, 80);
  if (url.searchParams.get("scan") === "1" && user.wallet && (await rateLimit(`txscan:${user.userId}`, 10))) await noticeIncoming(user.userId, user.wallet).catch(() => 0);
  let list = await chatReceipts(user.userId, convo);
  const pending = list.filter((r) => r.tx.status === "pending" && isSig(r.tx.sig)).slice(0, 3);
  if (pending.length) {
    await Promise.all(pending.map((r) => settleTx(user.userId, convo, r.id.replace(/^tx-/, ""), user.wallet, 0).catch(() => null)));
    list = await chatReceipts(user.userId, convo);
  }
  return Response.json({ receipts: list }, { headers: { "cache-control": "no-store" } });
});
