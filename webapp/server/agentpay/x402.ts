/**
 * x402 on Solana devnet, both sides.
 *
 * Seller (Lexari's own paid services, /api/x402/<service>): no X-PAYMENT header answers 402 with the payment
 * requirements (scheme "exact", network "solana-devnet", USDC, payTo the treasury, extra.feePayer = Lexari's
 * facilitator key). With X-PAYMENT (base64 JSON {x402Version, scheme, network, payload: {transaction}}) the
 * facilitator checks the partially signed transaction (fee payer is the facilitator, the only value-moving
 * instruction is a USDC transferChecked of at least the price into the treasury's token account, nothing else
 * touches the facilitator), co-signs as fee payer, sends, waits for confirmation, stores the signature (no replays)
 * and serves the resource with X-PAYMENT-RESPONSE.
 *
 * Buyer (an agent): GET, read the 402, check it is Solana devnet USDC within the price the agent agreed to, sign a
 * transferChecked from the agent's wallet with the facilitator as fee payer, retry with X-PAYMENT.
 */
import { ComputeBudgetProgram, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { eq } from "drizzle-orm";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createTransferCheckedInstruction, decodeTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { appOrigin, treasury, usdcMint } from "../config";
import { db } from "../db";
import { x402Receipts } from "../db/agentPaySchema";
import { connection } from "../hub/chain";
import { payoutKey } from "../agentWallets";

export const X402_NETWORK = "solana-devnet";
export type Requirements = { scheme: "exact"; network: string; maxAmountRequired: string; resource: string; description: string; mimeType: string; payTo: string; maxTimeoutSeconds: number; asset: string; extra: { feePayer: string; decimals: number } };

export function requirements(resource: string, priceAtoms: number, description: string): Requirements {
  const fp = payoutKey();
  return { scheme: "exact", network: X402_NETWORK, maxAmountRequired: String(priceAtoms), resource, description, mimeType: "application/json", payTo: treasury(), maxTimeoutSeconds: 90, asset: usdcMint(), extra: { feePayer: fp?.publicKey.toBase58() || "", decimals: 6 } };
}
export const paymentRequired = (req: Requirements, error = "X-PAYMENT header is required") =>
  Response.json({ x402Version: 1, error, accepts: [req] }, { status: 402 });

const ALLOWED_PROGRAMS = new Set([TOKEN_PROGRAM_ID.toBase58(), ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), ComputeBudgetProgram.programId.toBase58()]);

/** Seller side: verifies and settles an X-PAYMENT header. Returns the signature and payer, or an error message. */
export async function settlePayment(header: string, req: Requirements, service: string): Promise<{ ok: true; sig: string; payer: string } | { ok: false; error: string }> {
  let p: { x402Version?: number; scheme?: string; network?: string; payload?: { transaction?: string } };
  try { p = JSON.parse(Buffer.from(header, "base64").toString("utf8")); } catch { return { ok: false, error: "X-PAYMENT is not valid base64 JSON" }; }
  if (p.x402Version !== 1 || p.scheme !== "exact" || p.network !== X402_NETWORK || !p.payload?.transaction) return { ok: false, error: "unsupported payment scheme or network" };
  const fp = payoutKey();
  if (!fp) return { ok: false, error: "facilitator not configured" };
  let tx: Transaction;
  try { tx = Transaction.from(Buffer.from(p.payload.transaction, "base64")); } catch { return { ok: false, error: "transaction does not decode" }; }
  if (!tx.feePayer?.equals(fp.publicKey)) return { ok: false, error: "fee payer must be the facilitator" };
  const mint = new PublicKey(req.asset), payToAta = getAssociatedTokenAddressSync(mint, new PublicKey(req.payTo), true);
  let paid = BigInt(0), payer = "";
  for (const ix of tx.instructions) {
    if (!ALLOWED_PROGRAMS.has(ix.programId.toBase58())) return { ok: false, error: "transaction has an instruction that isn't allowed" };
    // The facilitator only pays the fee: it must not be any instruction's account (except as an ATA-create payer, which we refuse too).
    if (ix.keys.some((k) => k.pubkey.equals(fp.publicKey))) return { ok: false, error: "transaction uses the facilitator's account" };
    if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
      let d;
      try { d = decodeTransferCheckedInstruction(ix); } catch { return { ok: false, error: "only transferChecked is allowed" }; }
      if (!d.keys.mint.pubkey.equals(mint) || !d.keys.destination.pubkey.equals(payToAta) || d.data.decimals !== 6) return { ok: false, error: "payment goes to the wrong token or account" };
      paid += BigInt(d.data.amount.toString());
      payer = d.keys.owner.pubkey.toBase58();
    }
  }
  if (paid < BigInt(req.maxAmountRequired)) return { ok: false, error: "payment is less than the price" };
  const others = tx.signatures.filter((s) => !s.publicKey.equals(fp.publicKey));
  if (!others.length || others.some((s) => !s.signature)) return { ok: false, error: "transaction is not signed by the payer" };
  tx.partialSign(fp);
  if (!tx.verifySignatures()) return { ok: false, error: "signatures don't verify" };
  const c = connection();
  const sim = await c.simulateTransaction(tx).catch(() => null);
  if (!sim || sim.value.err) return { ok: false, error: "payment would fail on Solana (is the agent's wallet funded?)" };
  const sig = await c.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 5 });
  const inserted = await db().insert(x402Receipts).values({ sig, service, payer, amountAtoms: Number(paid) }).onConflictDoNothing().returning({ sig: x402Receipts.sig });
  if (!inserted.length) return { ok: false, error: "payment already used" };
  const end = Date.now() + 40_000;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 800));
    const st = (await c.getSignatureStatuses([sig]).catch(() => null))?.value[0];
    if (st?.err) { await db().delete(x402Receipts).where(eqSig(sig)); return { ok: false, error: "payment failed on Solana" }; }
    if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return { ok: true, sig, payer };
  }
  return { ok: true, sig, payer }; // sent and recorded; treat as paid (devnet confirmation can lag)
}
const eqSig = (sig: string) => eq(x402Receipts.sig, sig);

export const paymentResponse = (sig: string, payer: string) => Buffer.from(JSON.stringify({ success: true, transaction: sig, network: X402_NETWORK, payer })).toString("base64");

/* ---------- buyer side ---------- */
export class X402Error extends Error {}
const allowedHosts = () => {
  const own = appOrigin()?.domain;
  return new Set([...(own ? [own] : []), ...(process.env.X402_ALLOWED_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean)]);
};
/** Only Lexari's own services and hosts you list in X402_ALLOWED_HOSTS (the server never fetches arbitrary URLs). */
export function checkUrl(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { throw new X402Error("That isn't a valid URL."); }
  if (u.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && u.hostname === "localhost")) throw new X402Error("x402 services must use https.");
  if (!allowedHosts().has(u.host)) throw new X402Error(`${u.host} isn't an approved x402 service yet.`);
  return u.toString();
}

/** Step 1: ask the service its price. */
export async function quote(url: string): Promise<{ req: Requirements; free?: unknown }> {
  const r = await fetch(checkUrl(url), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (r.status === 200) return { req: null as never, free: await r.json().catch(() => null) };
  if (r.status !== 402) throw new X402Error(`The service answered ${r.status}.`);
  const j = (await r.json().catch(() => ({}))) as { accepts?: Requirements[] };
  const req = (j.accepts || []).find((a) => a.scheme === "exact" && a.network === X402_NETWORK && a.asset === usdcMint());
  if (!req) throw new X402Error("That service doesn't take devnet USDC on Solana.");
  if (!req.extra?.feePayer) throw new X402Error("That service has no fee payer.");
  return { req };
}

/** Step 2: pay from the agent's wallet and fetch the resource. */
export async function payAndFetch(url: string, req: Requirements, agent: Keypair) {
  const c = connection();
  const mint = new PublicKey(req.asset), payTo = new PublicKey(req.payTo), feePayer = new PublicKey(req.extra.feePayer);
  const from = getAssociatedTokenAddressSync(mint, agent.publicKey), to = getAssociatedTokenAddressSync(mint, payTo, true);
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer, blockhash, lastValidBlockHeight }).add(createTransferCheckedInstruction(from, mint, to, agent.publicKey, BigInt(req.maxAmountRequired), req.extra.decimals ?? 6));
  tx.partialSign(agent);
  const header = Buffer.from(JSON.stringify({ x402Version: 1, scheme: "exact", network: X402_NETWORK, payload: { transaction: tx.serialize({ requireAllSignatures: false }).toString("base64") } })).toString("base64");
  const r = await fetch(checkUrl(url), { headers: { accept: "application/json", "X-PAYMENT": header }, signal: AbortSignal.timeout(60000) });
  const body = await r.json().catch(() => null);
  if (r.status !== 200) throw new X402Error((body as { error?: string } | null)?.error || `The service answered ${r.status}.`);
  let sig = "";
  try { sig = JSON.parse(Buffer.from(r.headers.get("x-payment-response") || "", "base64").toString("utf8")).transaction || ""; } catch {}
  return { body, sig };
}
