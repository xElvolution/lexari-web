import type { agentCards } from "../db/schema";

type Row = typeof agentCards.$inferSelect;
/** Masked by default: the full number, expiry and CVV only come from /api/cards/reveal after your PIN or a wallet confirm. */
export const view = (c: Row, full = false) => ({
  agent: c.agentKey, issuer: c.issuer, test: c.issuer === "devnet-test", number: full ? c.number : "", last4: c.last4,
  expMonth: full ? c.expMonth : 0, expYear: full ? c.expYear : 0, cvv: full ? c.cvv : "", limit: c.spendLimit, spent: c.spent, frozen: c.frozen, tx: c.payTx, amount: c.amount, createdAt: c.createdAt,
});

