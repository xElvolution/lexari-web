"use client";

import { useSyncExternalStore } from "react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { confirmSig, rpcConnection } from "./rpc";
import { CARD_LAMPORTS, HIRE_LAMPORTS, TREASURY } from "./prices";
import { api, friendly } from "./api";
import { ackTx, get, logTx, refreshHub } from "./store";
import { ensureBridge, type WalletBridge } from "./walletBridge";

/** Network fee plus what Solana keeps in an account (rent), so a payment never fails for "insufficient funds for rent". */
export const PAY_BUFFER = 1_000_000;

export type PayRequest = {
  title: string; // "Hire Quill"
  what: string; // "a one-time hire" (shown under the price)
  lamports: number;
  /** Server verification after the payment confirmed. Throw to show the error in the sheet. */
  record: (sig: string) => Promise<unknown>;
  /** The receipt this payment writes into a chat (the agent then follows up there). */
  receipt?: { convo: string; kind: "hire" | "plan" | "card"; label: string; speaker?: string };
};
export type PayResult = { ok: true; tx: string; result: unknown } | { ok: false; error: string; cancelled?: boolean };

type Open = { req: PayRequest; done: (r: PayResult) => void } | null;
let open: Open = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function usePaySheet() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => open, () => null);
}
/** Opens the payment sheet. Resolves when the person paid (and the server verified it) or closed the sheet. */
export function requestPayment(req: PayRequest): Promise<PayResult> {
  if (!TREASURY) return Promise.resolve({ ok: false, error: "Payments are not set up on this server." });
  if (open) open.done({ ok: false, error: "", cancelled: true });
  return new Promise((resolve) => {
    open = { req, done: (r) => { open = null; emit(); resolve(r); receiptFor(req, r); } };
    emit();
  });
}

/** A payment's outcome as a receipt in the chat it's about; confirmed and failed ones get the agent's follow-up. */
function receiptFor(req: PayRequest, r: PayResult) {
  const rc = req.receipt;
  if (!rc) return;
  if (!r.ok && r.cancelled && rc.kind === "hire") return; // closing a hire sheet: that agent's chat isn't on your team
  const sol = req.lamports / 1e9;
  const id = r.ok ? `pay-${r.tx.slice(0, 32)}` : `pay-${Math.random().toString(36).slice(2, 12)}`;
  const status = r.ok ? "confirmed" as const : r.cancelled ? "cancelled" as const : "failed" as const;
  void (async () => {
    // a hire's chat only works once the hire is saved: wait a beat so the store has it
    await new Promise((x) => setTimeout(x, r.ok ? 900 : 0));
    const t = await logTx(rc.convo, { id, kind: rc.kind, status, sol, ...(TREASURY ? { to: TREASURY } : {}), ...(r.ok ? { sig: r.tx } : {}), ...(!r.ok && r.error ? { error: r.error.slice(0, 200) } : {}), label: rc.label });
    if (t && status !== "cancelled") void ackTx(rc.convo, `tx-${id}`, rc.speaker);
  })();
}

export const connection = () => rpcConnection();
export const isEmbedded = () => get().auth?.method === "google";

/** The wallet that pays: the Privy wallet for Google/email accounts, the connected wallet otherwise. */
export async function payer(): Promise<WalletBridge | null> {
  const a = get().auth;
  return ensureBridge(a?.address, a?.wallet, isEmbedded());
}

export async function balanceOf(address: string) {
  return connection().getBalance(new PublicKey(address), "confirmed");
}

/** Signs and sends one SOL transfer to the treasury and waits until it is confirmed. Returns the signature. */
export async function sendToTreasury(bridge: WalletBridge, lamports: number, onSigned?: () => void, onSent?: () => void) {
  const c = connection();
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: bridge.publicKey, blockhash, lastValidBlockHeight })
    .add(SystemProgram.transfer({ fromPubkey: bridge.publicKey, toPubkey: new PublicKey(TREASURY), lamports }));
  const signed = await bridge.signTransaction(tx);
  onSigned?.();
  const sig = await c.sendRawTransaction(signed.serialize());
  onSent?.();
  await confirmSig(c, sig, lastValidBlockHeight).catch((e: Error) => { throw /failed on Solana/.test(e.message) ? new Error("The payment failed on Solana.") : e; });
  return sig;
}

/** Retries server verification while the RPC catches up. */
export async function verifyWithRetry<T>(run: () => Promise<T>) {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try { return await run(); }
    catch (e) { last = e; const st = (e as { status?: number }).status; if (st && st < 500 && st !== 404) break; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw last;
}

/* ---------- what people pay for ---------- */

export async function payForHire(slug: string, name: string): Promise<{ ok: true; tx: string; mint: "SOL"; price: number } | { ok: false; error: string; cancelled?: boolean }> {
  const r = await requestPayment({
    title: `Hire ${name}`, what: "One-time hire. Release and rehire for free.", lamports: HIRE_LAMPORTS, receipt: { convo: slug, kind: "hire", label: `hiring ${name}`, speaker: slug },
    record: (sig) => verifyWithRetry(() => api("/api/hires", { method: "POST", body: { slug, tx: sig, mint: "SOL" } })).then((r) => { void refreshHub(); return r; }), // hire and team quests
  });
  return r.ok ? { ok: true, tx: r.tx, mint: "SOL", price: HIRE_LAMPORTS } : r;
}

export type Card = { agent: string; issuer: string; test: boolean; number: string; last4: string; expMonth: number; expYear: number; cvv: string; limit: number; spent: number; frozen: boolean; tx: string; amount?: number; createdAt?: string };

/** Pays the card price in devnet SOL to the treasury, then the server verifies it and issues the card. */
export async function payForCard(agent: string, limit: number, name = "your agent"): Promise<{ ok: true; tx: string; card: Card } | { ok: false; error: string; cancelled?: boolean }> {
  const r = await requestPayment({
    title: `A card for ${name}`, what: `Virtual test card, $${limit} a month limit.`, lamports: CARD_LAMPORTS, receipt: { convo: agent, kind: "card", label: `${name}'s $${limit}/month card`, speaker: agent },
    record: (sig) => verifyWithRetry(() => api<{ card: Card }>("/api/cards", { method: "POST", body: { agent, tx: sig, limit } })),
  });
  return r.ok ? { ok: true, tx: r.tx, card: (r.result as { card: Card }).card } : r;
}

export type PlanState = { id: string; name: string; seats: number; expiresAt: number | null };
export async function payForPlan(plan: { id: string; name: string; lamports: number; seats: number }, period: "month" | "year" = "month"): Promise<{ ok: true; tx: string; plan: PlanState } | { ok: false; error: string; cancelled?: boolean }> {
  const year = period === "year";
  const r = await requestPayment({
    title: `Upgrade to ${plan.name}`, what: `${plan.seats} seats for ${year ? "a year (2 months free)" : "30 days"}, on devnet.`, lamports: year ? plan.lamports * 10 : plan.lamports, receipt: { convo: "home", kind: "plan", label: `the ${plan.name} plan (${year ? "a year" : "30 days"})`, speaker: "home" },
    record: (sig) => verifyWithRetry(() => api<{ plan: PlanState }>("/api/plans", { method: "POST", body: { plan: plan.id, tx: sig, period } })),
  });
  return r.ok ? { ok: true, tx: r.tx, plan: (r.result as { plan: PlanState }).plan } : r;
}

export { friendly };
