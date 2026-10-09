/**
 * Deposit top-ups on every non-Solana chain (content/topup.ts explains the model). The rules that keep crediting exact:
 *  - only the CONFIRMED balance (at the chain's confirmation depth) is ever credited;
 *  - credited_atoms only moves up to what was credited, under a row lock, inside the same database transaction as
 *    the balance credit, so two checks at once can't credit the same coins twice;
 *  - each credit has a unique ref (deposit snapshot or XRP transaction hash) on topup_credits and credit_ledger;
 *  - no live price, no credit (it is retried on the next check);
 *  - amounts under the coin's minimum wait until the total reaches it;
 *  - testnet: at most TESTNET_TOPUP_DAILY_USD credited per person per rolling day (testnet coins are free and the
 *    balance pays for real AI usage). Anything over waits and is credited on a later check.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { CHAINS, TESTNET_TOPUP_DAILY_USD, coinById, payKind, railById, railId, type Rail } from "@/content/topup";
import { db } from "../db";
import { topupCredits, topupWatches, topupXrpTags } from "../db/topupSchema";
import { HttpError } from "../http";
import { credit } from "../billing/balance";
import { notify } from "../notify";
import { held, xrplEnsureAccount, xrplPayments } from "./chains";
import { btcDepositAddress, evmDepositAddress, ltcDepositAddress, tronDepositAddress, xrpLexariAddress } from "./derive";
import { coinUsd } from "./prices";

const MICROS = 1_000_000;
const pow10 = (n: number) => BigInt(10) ** BigInt(n);
const minAtoms = (r: Rail) => BigInt(Math.round(r.min * 10 ** Math.min(r.decimals, 12))) * pow10(Math.max(0, r.decimals - 12));
export const toUi = (atoms: bigint, r: Rail) => Number(atoms) / 10 ** r.decimals;
const usdMicrosOf = (atoms: bigint, r: Rail, price: number) => Math.floor((Number(atoms) / 10 ** r.decimals) * price * MICROS);

export function depositRail(id: string) {
  const r = railById(id);
  if (!r || payKind(r) !== "deposit") throw new HttpError(400, "Pick a coin and a network.");
  if (!r.live || !CHAINS[r.chain].live) throw new HttpError(400, r.why || CHAINS[r.chain].why || "That network opens with mainnet.");
  return r;
}

function addressFor(userId: string, r: Rail) {
  switch (CHAINS[r.chain].family) {
    case "evm": return evmDepositAddress(userId);
    case "btc": return r.chain === "litecoin" ? ltcDepositAddress(userId) : btcDepositAddress(userId);
    case "tron": return tronDepositAddress(userId);
    case "xrpl": return xrpLexariAddress();
    default: throw new HttpError(400, "That network has no deposit address.");
  }
}

async function xrpTag(userId: string) {
  const d = db();
  await d.insert(topupXrpTags).values({ userId }).onConflictDoNothing();
  const [t] = await d.select({ tag: topupXrpTags.tag }).from(topupXrpTags).where(eq(topupXrpTags.userId, userId)).limit(1);
  return t.tag;
}

export type DepositView = {
  rail: string; address: string; tag?: number; network: string; confirmations: number; eta: string; min: number; explorer: string;
  /** "waiting": nothing new; "incoming": seen, not confirmed yet; "below": confirmed but under the minimum; "capped": over today's testnet cap */
  status: "waiting" | "incoming" | "below" | "capped";
  incoming: number; waitingUi: number;
  /** credited by this check */
  credited: { usd: number; amount: number; id: string } | null;
  price: number | null;
};

/** Your deposit address for a coin on a network (and starts watching it). */
export async function depositInfo(userId: string, id: string): Promise<DepositView> {
  const r = depositRail(id);
  const address = addressFor(userId, r);
  if (CHAINS[r.chain].family === "xrpl") { await xrplEnsureAccount(address).catch(() => {}); }
  else await db().insert(topupWatches).values({ userId, rail: railId(r), address }).onConflictDoNothing();
  return checkDeposit(userId, id);
}

async function creditedToday(userId: string) {
  const [row] = await db().select({ n: sql<string>`coalesce(sum(${topupCredits.usdMicros}),0)` }).from(topupCredits).where(and(eq(topupCredits.userId, userId), gt(topupCredits.createdAt, new Date(Date.now() - 86_400_000))));
  return Number(row?.n ?? 0);
}

async function announce(userId: string, r: Rail, amount: number, usd: number, key: string) {
  const sym = coinById(r.coin)?.symbol || r.coin;
  await notify(userId, { kind: "payment", title: `$${usd.toFixed(2)} added to your balance`, body: `${+amount.toFixed(8)} ${r.test ? "test " : ""}${sym} arrived on ${CHAINS[r.chain].network}.`, url: "/wallets", key: `topup:${key}` }).catch(() => {});
}

/** Looks at the chain and credits whatever confirmed and isn't credited yet. Safe to call as often as you like. */
export async function checkDeposit(userId: string, id: string): Promise<DepositView> {
  const r = depositRail(id);
  const chain = CHAINS[r.chain];
  const address = addressFor(userId, r);
  const base = { rail: railId(r), address, network: chain.network, confirmations: chain.confirmations, eta: chain.eta, min: r.min, explorer: chain.explorerAddress(address) };
  if (chain.family === "xrpl") return checkXrp(userId, r, base);

  const h = await held(r, address);
  const price = await coinUsd(r.coin).catch(() => null);
  const capLeft = TESTNET_TOPUP_DAILY_USD * MICROS - (await creditedToday(userId));
  const out = await db().transaction(async (tx) => {
    await tx.insert(topupWatches).values({ userId, rail: railId(r), address }).onConflictDoNothing();
    const [w] = await tx.select().from(topupWatches).where(and(eq(topupWatches.userId, userId), eq(topupWatches.rail, railId(r)))).for("update");
    const was = BigInt(w.creditedAtoms);
    let credited: DepositView["credited"] = null;
    let status: DepositView["status"] = "waiting";
    let creditedNow = was;
    const delta = h.confirmed - was;
    if (delta < BigInt(0)) creditedNow = h.confirmed; // coins moved out (a sweep): start counting from what's there
    else if (delta > BigInt(0)) {
      if (delta < minAtoms(r)) status = "below";
      else if (price === null) status = "incoming"; // priced on the next check
      else {
        const micros = usdMicrosOf(delta, r, price);
        if (micros > capLeft) status = "capped";
        else if (micros > 0) {
          const ref = `dep:${railId(r)}:${userId}:${h.confirmed.toString()}`;
          const [row] = await tx.insert(topupCredits).values({ userId, rail: railId(r), atoms: delta.toString(), usdMicros: micros, price, ref }).onConflictDoNothing().returning({ id: topupCredits.id });
          if (row) {
            await credit(tx as never, userId, micros, "topup_crypto", `deposit:${row.id}`);
            credited = { usd: micros / MICROS, amount: toUi(delta, r), id: row.id };
          }
          creditedNow = h.confirmed;
        }
      }
    }
    await tx.update(topupWatches).set({ creditedAtoms: creditedNow.toString(), seenAtoms: h.latest.toString(), checkedAt: new Date() }).where(and(eq(topupWatches.userId, userId), eq(topupWatches.rail, railId(r))));
    const incoming = h.latest > h.confirmed ? toUi(h.latest - h.confirmed, r) : 0;
    if (status === "waiting" && incoming > 0) status = "incoming";
    return { credited, status, incoming, waitingUi: h.confirmed > creditedNow ? toUi(h.confirmed - creditedNow, r) : 0 };
  });
  if (out.credited) await announce(userId, r, out.credited.amount, out.credited.usd, `${railId(r)}:${h.confirmed}`);
  return { ...base, ...out, price };
}

async function checkXrp(userId: string, r: Rail, base: Omit<DepositView, "status" | "incoming" | "waitingUi" | "credited" | "price">): Promise<DepositView> {
  const tag = await xrpTag(userId);
  const pays = await xrplPayments(base.address, tag);
  const price = await coinUsd(r.coin).catch(() => null);
  const d = db();
  const done = new Set((pays.length ? await d.select({ ref: topupCredits.ref }).from(topupCredits).where(and(eq(topupCredits.userId, userId), eq(topupCredits.rail, railId(r)))) : []).map((x) => x.ref));
  const fresh = pays.filter((p) => !done.has(`xrp:${p.hash}`));
  const sum = fresh.reduce((a, p) => a + p.drops, BigInt(0));
  let status: DepositView["status"] = "waiting";
  let credited: DepositView["credited"] = null;
  if (fresh.length && sum < minAtoms(r)) status = "below";
  else if (fresh.length && price === null) status = "incoming";
  else if (fresh.length && price !== null) {
    const capLeft = TESTNET_TOPUP_DAILY_USD * MICROS - (await creditedToday(userId));
    if (usdMicrosOf(sum, r, price) > capLeft) status = "capped";
    else {
      let usd = 0, amount = 0, first = "";
      await d.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`topup:xrp:${userId}`}))`);
        for (const p of fresh) {
          const micros = usdMicrosOf(p.drops, r, price);
          const [row] = await tx.insert(topupCredits).values({ userId, rail: railId(r), atoms: p.drops.toString(), usdMicros: micros, price, ref: `xrp:${p.hash}`, tx: p.hash }).onConflictDoNothing().returning({ id: topupCredits.id });
          if (!row) continue;
          await credit(tx as never, userId, micros, "topup_crypto", `deposit:${row.id}`);
          usd += micros / MICROS; amount += toUi(p.drops, r); first ||= row.id;
        }
      });
      if (usd > 0) { credited = { usd, amount, id: first }; await announce(userId, r, amount, usd, `xrp:${fresh[0].hash}`); }
    }
  }
  return { ...base, tag, status, incoming: 0, waitingUi: status === "below" || status === "capped" ? toUi(sum, r) : 0, credited, price };
}

/** Checks the deposit addresses you used in the last 3 days (called when billing state loads), quietly. */
export async function checkRecentDeposits(userId: string) {
  const rows = await db().select().from(topupWatches).where(and(eq(topupWatches.userId, userId), gt(topupWatches.createdAt, new Date(Date.now() - 3 * 86_400_000)))).limit(8);
  for (const w of rows) {
    if (w.checkedAt && Date.now() - w.checkedAt.getTime() < 30_000) continue;
    await checkDeposit(userId, w.rail).catch(() => null);
  }
  const [tag] = await db().select({ at: topupXrpTags.createdAt }).from(topupXrpTags).where(eq(topupXrpTags.userId, userId)).limit(1);
  if (tag) await checkDeposit(userId, "XRP:xrpl").catch(() => null);
}
