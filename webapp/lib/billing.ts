"use client";

/**
 * Models and billing in the app: the billing state from /api/billing, the sheets (model picker, Top up, out of
 * usage, spend limit) and the payment flows. Kept apart from lib/store.ts on purpose.
 */
import { useEffect, useSyncExternalStore } from "react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { BillingState } from "@/server/billing/state";
import type { Blocked } from "@/server/billing/meter";
import { LAMINA, keyModelInfo, modelById, modelCatalog, type CatalogRow, type ModelInfo } from "@/content/models";
import { api, ApiError, friendly } from "./api";
import { connection, payer } from "./pay";
import { confirmSig } from "./rpc";
import { openUpgrade } from "@/components/overlays";
import { moneyChanged, onMoneyChanged } from "./money";

export type { BillingState };
export type OutInfo = (Blocked | { reason: "model_unavailable"; model: string; modelLabel: string }) & { convo?: string; agent?: string };
/** need: a purchase was short, so the sheet shows the shortfall; then: runs after the top up lands (the purchase goes on). */
export type TopUpIntent = { product: "plan" | "credits"; id?: string; need?: { needMicros: number; haveMicros: number; shortMicros: number; what: string }; then?: () => void; cancel?: () => void };
export type BillingSheet =
  | { kind: "models"; convo: string; agent: string | null; group: boolean }
  | { kind: "topup"; intent: TopUpIntent }
  | { kind: "out"; info: OutInfo }
  | { kind: "spend" }
  | null;

type Store = { state: BillingState | null; loading: boolean; error: string; sheet: BillingSheet };
let store: Store = { state: null, loading: false, error: "", sheet: null };
const subs = new Set<() => void>();
const set = (patch: Partial<Store>) => { store = { ...store, ...patch }; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const SERVER: Store = { state: null, loading: false, error: "", sheet: null };

let inflight: Promise<BillingState | null> | null = null;
let fetchedAt = 0;
/** Fetches the billing state (deduped). */
export function refreshBilling(): Promise<BillingState | null> {
  if (inflight) return inflight;
  set({ loading: true });
  inflight = api<BillingState>("/api/billing")
    .then((s) => { fetchedAt = Date.now(); set({ state: s, loading: false, error: "" }); return s; })
    .catch((e) => { set({ loading: false, error: friendly(e, "Couldn't load billing.") }); return null; })
    .finally(() => { inflight = null; });
  return inflight;
}
export const applyState = (s: BillingState) => { fetchedAt = Date.now(); set({ state: s, error: "" }); };

// A money change refetches billing when something on screen shows it (or it was loaded before).
onMoneyChanged(() => { if (subs.size || store.state) void refreshBilling(); });

/** The billing state, fetched on first use and again when stale (30 s) or when the tab comes back. */
export function useBilling() {
  const s = useSyncExternalStore(subscribe, () => store, () => SERVER);
  useEffect(() => {
    if (!store.state || Date.now() - fetchedAt > 30_000) void refreshBilling();
    const back = () => { if (document.visibilityState === "visible" && Date.now() - fetchedAt > 10_000) void refreshBilling(); };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);
  return s;
}

/** A chat turn finished: meters moved, so refresh when something on screen shows them. */
export function billingTurnDone() {
  if (subs.size) setTimeout(() => void refreshBilling(), 400);
}
/** /api/chat said this turn is out of usage (402) or the model is unavailable (409): show the sheet. */
export function billingBlocked(info: OutInfo) {
  void refreshBilling();
  set({ sheet: { kind: "out", info } });
}

export const openModels = (convo: string, agent: string | null, group = false) => set({ sheet: { kind: "models", convo, agent, group } });
/** Top up adds to the balance. A plan intent opens the plans sheet instead (plans are paid from the balance, monthly or yearly). */
export const openTopUp = (intent: TopUpIntent = { product: "credits" }) => {
  if (intent.product === "plan") { set({ sheet: null }); openUpgrade("plans"); return; }
  set({ sheet: { kind: "topup", intent } });
};
export const openSpend = () => set({ sheet: { kind: "spend" } });
export const closeBillingSheet = () => set({ sheet: null });

/** A model by id: built in, or one on your API key (while that key is saved). */
export function infoFor(s: BillingState | null, id: string | null | undefined): ModelInfo | null {
  if (!id) return null;
  const b = modelById(id);
  if (b) return b;
  const k = keyModelInfo(id);
  return k && s?.models.keys.some((x) => id.startsWith(`key:${x.provider}:`)) ? k : null;
}
/** Every model in Settings > Models with its switch. */
export const catalogOf = (s: BillingState): CatalogRow[] => modelCatalog(s.models.keys.map((k) => k.provider), s.models.prefs, s.models.available);
/** The models you can pick (switched on), in list order. */
export const enabledModels = (s: BillingState): ModelInfo[] => catalogOf(s).filter((r) => r.enabled).map((r) => r.m);

/** The model that answers in a chat: the chat's pick, else the agent's, else the account default, else Lamina. */
export function modelFor(s: BillingState | null, convo: string, agent: string | null): { model: ModelInfo; from: "chat" | "agent" | "default" } {
  const c = infoFor(s, s?.models.chats[convo]);
  if (c) return { model: c, from: "chat" };
  const a = s && agent ? infoFor(s, s.models.agents[agent]) : null;
  if (a) return { model: a, from: "agent" };
  return { model: infoFor(s, s?.models.default) ?? LAMINA, from: "default" };
}

export async function setModel(input: { scope: "agent"; agent: string; model: string | null } | { scope: "chat"; convo: string; model: string | null }) {
  // optimistic: the chip changes at once, the server confirms
  const prev = store.state;
  if (prev) {
    const models = { ...prev.models, agents: { ...prev.models.agents }, chats: { ...prev.models.chats } };
    if (input.scope === "agent") models.agents[input.agent] = input.model;
    else if (input.model) models.chats[input.convo] = input.model; else delete models.chats[input.convo];
    set({ state: { ...prev, models } });
  }
  try { await api("/api/billing/model", { method: "PUT", body: input }); }
  catch (e) { if (prev) set({ state: prev }); throw e; }
}

export async function setSpend(mode: "disabled" | "fixed" | "unlimited", limitUsd?: number) {
  applyState(await api<BillingState>("/api/billing/settings", { method: "PUT", body: { spendMode: mode, ...(limitUsd ? { spendLimitUsd: limitUsd } : {}) } }));
}

/* ---------- paying Lexari: card (hosted checkout) or USDC on Solana ---------- */

export type CryptoRequest = { id: string; recipient: string; mint: string; reference: string; amountMinor: number; decimals: number; cluster: string; title: string; url: string; expiresAt: number };

export type BuyIntent = { product: "plan" | "credits"; id: string; period?: "monthly" | "yearly" };
export async function startCard(intent: BuyIntent) {
  const r = await api<{ rail: "card"; card: { id: string; url: string } }>("/api/billing/checkout", { body: { rail: "card", product: intent.product, id: intent.id, ...(intent.period ? { period: intent.period } : {}) } });
  return r.card;
}
export async function startCrypto(intent: BuyIntent) {
  const r = await api<{ rail: "crypto"; crypto: CryptoRequest }>("/api/billing/checkout", { body: { rail: "crypto", product: intent.product, id: intent.id, ...(intent.period ? { period: intent.period } : {}) } });
  return r.crypto;
}

/** USDC balance (base units) of an address, or null when it can't be read. */
export async function usdcBalance(owner: string, mint: string) {
  try {
    const ata = getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner));
    const b = await connection().getTokenAccountBalance(ata, "confirmed");
    return Number(b.value.amount);
  } catch (e) {
    return /could not find account|Invalid param/i.test((e as Error)?.message || "") ? 0 : null;
  }
}

export type PayStep = "signing" | "sending" | "confirming" | "verifying";
/**
 * Pays a USDC request from the Lexari wallet (or the connected wallet): a transfer to the treasury's token account
 * carrying the payment's reference key, then the server verifies it on chain and grants it.
 */
export async function payCrypto(req: CryptoRequest, onStep: (s: PayStep, sig?: string) => void) {
  const w = await payer();
  if (!w) throw new Error("Your wallet is still loading. Wait a moment and try again.");
  const c = connection();
  const mint = new PublicKey(req.mint), to = new PublicKey(req.recipient), me = w.publicKey;
  const fromAta = getAssociatedTokenAddressSync(mint, me);
  const toAta = getAssociatedTokenAddressSync(mint, to, true);
  const transfer = createTransferCheckedInstruction(fromAta, mint, toAta, me, BigInt(req.amountMinor), req.decimals);
  transfer.keys.push({ pubkey: new PublicKey(req.reference), isSigner: false, isWritable: false });
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: me, blockhash, lastValidBlockHeight })
    .add(createAssociatedTokenAccountIdempotentInstruction(me, toAta, to, mint))
    .add(transfer as TransactionInstruction);
  onStep("signing");
  const signed = await w.signTransaction(tx);
  onStep("sending");
  const sig = await c.sendRawTransaction(signed.serialize());
  onStep("confirming", sig);
  // poll, like every other confirmation in the app (no websocket needed, works through the RPC proxy)
  await confirmSig(c, sig, lastValidBlockHeight).catch((e: Error) => { throw /failed on Solana/.test(e.message) ? new Error("The payment failed on Solana.") : e; });
  onStep("verifying", sig);
  return verifyPayment(req.id, sig);
}

/** Asks the server to check a payment (retrying while the RPC catches up) and applies the new billing state. */
export async function verifyPayment(paymentId: string, sig?: string, tries = 5) {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await api<{ status: string; state: BillingState }>("/api/billing/verify", { body: { paymentId, ...(sig ? { sig } : {}) } });
      applyState(r.state);
      if (r.status === "paid") moneyChanged(); // the Wallet tab, Hub and anything else showing dollars refetch now
      return r;
    } catch (e) {
      last = e;
      const st = (e as ApiError).status;
      if (st && st < 500 && st !== 404) break;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

/** Dev-only billing actions (local next dev with LEXARI_DEV_BILLING=1); the server answers 404 otherwise. */
export async function devBilling(body: Record<string, unknown>) {
  applyState(await api<BillingState>("/api/billing/dev", { body }));
  moneyChanged();
}
