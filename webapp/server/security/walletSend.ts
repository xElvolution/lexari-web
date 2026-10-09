/** Sends from your own wallet that an agent prepares in chat: priced in dollars and checked against Settings > Security. */
import { coinUsd } from "../topup/prices";
import { checkMoney, countWalletSend } from ".";

async function solPrice() {
  try { return await coinUsd("SOL" as never); } catch { return 150; } // no live price: a conservative stand-in so the limit still applies
}

export async function walletSendGuard(userId: string, s: { to: string; sol: number }) {
  const valueUsd = Math.round(s.sol * (await solPrice()) * 100) / 100;
  const c = await checkMoney(userId, { usdMicros: Math.round(valueUsd * 1e6), to: s.to });
  return { firstTime: c.firstTime, valueUsd, stepup: c.needsStepUp };
}

/** A confirmed wallet send counts toward today's money limit (once per signature). */
export async function countSent(userId: string, sol: number, sig: string) {
  await countWalletSend(userId, Math.round(sol * (await solPrice()) * 1e6), sig);
}
