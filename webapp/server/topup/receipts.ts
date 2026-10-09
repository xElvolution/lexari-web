/** A crypto top-up written into the chat you topped up from, as a receipt row the agent can follow up on. */
import { and, eq } from "drizzle-orm";
import { CHAINS, coinById, railById } from "@/content/topup";
import { db } from "../db";
import { topupCredits } from "../db/topupSchema";
import { recordTx, type TxEvent } from "../txlog";

const EXPLORER: Partial<Record<string, (h: string) => string>> = {
  solana: (h) => `https://explorer.solana.com/tx/${h}?cluster=devnet`,
  xrpl: (h) => `https://testnet.xrpl.org/transactions/${h}`,
};

export async function topupReceipt(userId: string, convo: string, ref: { creditId?: string; paymentId?: string }) {
  const d = db();
  const [c] = ref.creditId
    ? await d.select().from(topupCredits).where(and(eq(topupCredits.userId, userId), eq(topupCredits.id, ref.creditId))).limit(1)
    : await d.select().from(topupCredits).where(and(eq(topupCredits.userId, userId), eq(topupCredits.ref, `payment:${ref.paymentId}`))).limit(1);
  if (!c) return null;
  const r = railById(c.rail);
  if (!r) return null;
  const coin = coinById(r.coin)!;
  const amt = +(Number(c.atoms) / 10 ** r.decimals).toFixed(coin.stable ? 2 : 6);
  const id = `t${c.id.replace(/-/g, "").slice(0, 30)}`;
  const ev: TxEvent = {
    id, kind: "topup", status: "confirmed", sol: 0, at: c.createdAt.getTime(),
    amount: `$${(c.usdMicros / 1e6).toFixed(2)} (${amt} ${r.test ? "test " : ""}${coin.symbol})`, net: CHAINS[r.chain].network, label: "your Lexari balance",
    ...(c.tx ? { sig: c.tx, url: EXPLORER[r.chain]?.(c.tx) } : {}),
  };
  await recordTx(userId, convo, ev);
  return `tx-${id}`;
}
