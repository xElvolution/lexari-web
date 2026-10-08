"use client";

/**
 * Paying from your Lexari balance: hires, agent cards and funding agents are priced in dollars and debited on the
 * server. One sheet confirms the price; a short balance opens Top up with the shortfall, then the purchase goes on.
 */
import { useSyncExternalStore, type ReactNode } from "react";
import { packFor } from "@/content/billing";
import { ApiError } from "./api";
import { openTopUp, refreshBilling } from "./billing";

export type Short = { needMicros: number; haveMicros: number; shortMicros: number };

/** The shortfall from a 402 the server sent when the balance is too low, or null for any other error. */
export function shortOf(e: unknown): Short | null {
  if (!(e instanceof ApiError) || e.status !== 402) return null;
  const b = (e.data as { billing?: Short & { reason?: string } } | undefined)?.billing;
  return b?.reason === "short_balance" ? { needMicros: b.needMicros, haveMicros: b.haveMicros, shortMicros: b.shortMicros } : null;
}

export { packFor };

/** Opens Top up for a shortfall. `then` runs once the top up lands; `cancel` if the sheet is closed first. */
export function topUpFor(short: Short, what: string, then: () => void, cancel?: () => void) {
  openTopUp({ product: "credits", id: String(packFor(short.shortMicros)), need: { ...short, what }, then, cancel });
}

export type PayReq = {
  kind: "hire" | "card" | "fund" | "plan";
  title: string;
  /** how Top up names it when the balance is short: "Hiring Ava" */
  doing?: string;
  /** what you get, one short line under the title */
  what: string;
  art?: ReactNode;
  usd: number;
  /** amount choices (Fund agent); `usd` is the default */
  amounts?: readonly number[];
  note?: string;
  cta?: (usd: number) => string;
  run: (usd: number) => Promise<unknown>;
};
type Open = { req: PayReq; auto?: number; done: (r: { ok: true; result: unknown; usd: number } | { ok: false }) => void } | null;
let open: Open = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const usePayReq = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => open, () => null);

/** Opens the pay-from-balance sheet. Resolves when the purchase went through or the sheet was closed. */
export function payFromBalance(req: PayReq): Promise<{ ok: true; result: unknown; usd: number } | { ok: false }> {
  if (open) open.done({ ok: false });
  void refreshBilling();
  return new Promise((resolve) => {
    open = { req, done: (r) => { open = null; emit(); resolve(r); } };
    emit();
  });
}
/** Hide the sheet while Top up is open (the promise stays pending), and bring it back to finish. */
export function parkPay() { if (open) { const o = open; open = null; emit(); return o; } return null; }
export function resumePay(o: NonNullable<Open>, autoUsd?: number) { open = { ...o, auto: autoUsd }; emit(); }
export type { Open as OpenPay };
