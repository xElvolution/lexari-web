"use client";

/**
 * One signal for "your money changed": a top up landed, a plan or hire was paid from the balance, a payment
 * notification arrived, or you came back to the tab (a wallet app, a card checkout). Every store that shows dollars
 * (the Wallet tab's balance and history, Billing, the Hub) listens here, so none of them shows a stale $0.00.
 * No imports on purpose: lib/billing, lib/store and the wallet store all depend on this, never the other way.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let last = 0;

/** Subscribe; returns the unsubscribe. */
export function onMoneyChanged(f: Listener) { listeners.add(f); return () => { listeners.delete(f); }; }

/** Tell every money view to refetch. `soft` (focus, visibility) is skipped if a refetch ran in the last few seconds. */
export function moneyChanged(soft = false) {
  const now = Date.now();
  if (soft && now - last < 4000) return;
  last = now;
  listeners.forEach((f) => { try { f(); } catch { /* one view failing never blocks the others */ } });
}

let started = false;
/** Coming back to Lexari (from a wallet app, a card checkout or another tab) refreshes balances once. */
export function startMoneySync() {
  if (started || typeof window === "undefined") return;
  started = true;
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") moneyChanged(true); });
  window.addEventListener("focus", () => moneyChanged(true));
}
