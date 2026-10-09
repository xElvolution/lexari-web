/**
 * Transaction awareness. Every Confirm card outcome (send SOL, fund a hired agent, return leftover, hire, plan,
 * card, mint) is written into the chat as a system message with meta.tx (a compact receipt row), verified on chain
 * here, and followed until it is confirmed or failed. The agent reads a short wallet history on every turn
 * (these events plus the last on-chain signatures of your wallet and your hired agents' task wallets), and SOL
 * that arrives from elsewhere is noticed and logged too.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { LAMPORTS_PER_SOL, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { db } from "./db";
import { agents, chats, messages } from "./db/schema";
import { cluster, treasury } from "./config";
import { serverConnection } from "./rpc";
import { faucetAddress } from "./faucet";
import { hireWallet } from "./hireWallet";

export type TxKind = "send" | "fund" | "return" | "hire" | "plan" | "card" | "mint" | "incoming" | "pay" | "topup";
export type TxStatus = "pending" | "confirmed" | "failed" | "cancelled";
export type TxEvent = {
  id: string; kind: TxKind; status: TxStatus; sol: number; at: number;
  to?: string; from?: string; sig?: string; url?: string; error?: string;
  /** the agent this is about (a hired agent's wallet, a card or mint) */
  agent?: string; label?: string;
  /** network fee in SOL, once confirmed */
  fee?: number;
  /** your wallet's balance right after it confirmed */
  balance?: number;
  /** a non-SOL amount, already formatted ("0.05 USDC", "$10.00"), and its network when not Solana devnet */
  amount?: string; net?: string;
};

const SIG = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;
export const isSig = (s: unknown): s is string => typeof s === "string" && SIG.test(s);
const clusterQ = () => (cluster() === "mainnet-beta" ? "" : `?cluster=${cluster()}`);
export const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}${clusterQ()}`;
const short = (a?: string) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");
const solStr = (n: number) => `${+n.toFixed(6)} SOL`;
const VERB: Record<TxKind, string> = { send: "Sent", fund: "Funded", return: "Returned", hire: "Paid for a hire", plan: "Paid for a plan", card: "Paid for a card", mint: "Minted an ID card", incoming: "Received", pay: "Paid", topup: "Topped up" };

/** The one-line text of a receipt (shown when meta isn't rendered, and read by search). */
export function receiptText(e: TxEvent) {
  const st = e.status === "confirmed" ? "confirmed" : e.status;
  if (e.kind === "incoming") return `Received ${solStr(e.sol)}${e.from ? ` from ${e.label || short(e.from)}` : ""} · ${st}`;
  if (e.kind === "mint") return `Minted an ID card${e.sol ? ` (${solStr(e.sol)})` : ""} · ${st}`;
  if (e.amount) return `${VERB[e.kind]} ${e.amount}${e.label ? ` for ${e.label}` : ""} · ${st}`;
  return `${VERB[e.kind]} ${solStr(e.sol)}${e.to ? ` to ${e.label || short(e.to)}` : ""} · ${st}`;
}

async function chatFor(userId: string, convo: string) {
  const d = db();
  const [found] = await d.select({ id: chats.id }).from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, convo))).limit(1);
  if (found) return found.id;
  const [made] = await d.insert(chats).values({ userId, kind: convo.startsWith("g-") ? "group" : "dm", slug: convo, title: convo }).onConflictDoNothing().returning({ id: chats.id });
  if (made) return made.id;
  const [again] = await d.select({ id: chats.id }).from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, convo))).limit(1);
  return again.id;
}

/** Writes (or updates) the receipt row in a chat. A confirmed receipt never changes back (a failed one can be retried). */
export async function recordTx(userId: string, convo: string, ev: TxEvent): Promise<TxEvent> {
  const chatId = await chatFor(userId, convo);
  const clientId = `tx-${ev.id}`.slice(0, 40);
  const d = db();
  const [row] = await d.select().from(messages).where(and(eq(messages.chatId, chatId), eq(messages.clientId, clientId))).limit(1);
  const cur = (row?.metaJson as { tx?: TxEvent } | null)?.tx;
  let next: TxEvent = { ...(cur || {}), ...ev, at: cur?.at || ev.at };
  if (cur?.status === "confirmed" && ev.status !== "confirmed") next = { ...next, status: "confirmed", error: undefined };
  if (next.status === "confirmed") delete next.error;
  if (next.sig && !ev.url && !cur?.url) next.url = explorer(next.sig);
  if (row) await d.update(messages).set({ text: receiptText(next), metaJson: sql`coalesce(${messages.metaJson}, '{}'::jsonb) || ${JSON.stringify({ tx: next })}::jsonb` }).where(eq(messages.id, row.id));
  else await d.insert(messages).values({ chatId, fromId: "system", text: receiptText(next), clientId, metaJson: { tx: next }, createdAt: new Date(next.at) }).onConflictDoNothing();
  await d.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
  return next;
}

export async function readTx(userId: string, convo: string, id: string): Promise<TxEvent | null> {
  const [row] = await db().select({ meta: messages.metaJson }).from(messages).innerJoin(chats, eq(messages.chatId, chats.id))
    .where(and(eq(chats.userId, userId), eq(chats.slug, convo), eq(messages.clientId, `tx-${id}`.slice(0, 40)))).limit(1);
  return (row?.meta as { tx?: TxEvent } | null)?.tx || null;
}

/** Receipts in one chat (newest 40), so the app can refresh their status and pick up incoming SOL. */
export async function chatReceipts(userId: string, convo: string) {
  const rows = await db().select({ clientId: messages.clientId, meta: messages.metaJson, at: messages.createdAt }).from(messages).innerJoin(chats, eq(messages.chatId, chats.id))
    .where(and(eq(chats.userId, userId), eq(chats.slug, convo), sql`${messages.metaJson} ? 'tx'`)).orderBy(desc(messages.createdAt)).limit(40);
  return rows.map((r) => ({ id: r.clientId || "", at: r.at.getTime(), tx: (r.meta as { tx: TxEvent }).tx }));
}

/** Every receipt of yours across chats, newest first. */
async function allReceipts(userId: string, limit = 30) {
  const rows = await db().select({ meta: messages.metaJson, convo: chats.slug }).from(messages).innerJoin(chats, eq(messages.chatId, chats.id))
    .where(and(eq(chats.userId, userId), sql`${messages.metaJson} ? 'tx'`)).orderBy(desc(messages.createdAt)).limit(limit);
  return rows.map((r) => ({ ...(r.meta as { tx: TxEvent }).tx, convo: r.convo }));
}

/* ---------- on chain ---------- */

// Its own connection that fails fast on a 429 (the public devnet RPC rate-limits hard): history is cached and a
// receipt is re-checked on the next poll, so a skipped call costs nothing, while retry storms slowed every request.
const connection = () => serverConnection({ fast: true });

const parsed = new Map<string, ParsedTransactionWithMeta | null>();
type Transfer = { from: string; to: string; lamports: number };
function transfersOf(tx: ParsedTransactionWithMeta): Transfer[] {
  const out: Transfer[] = [];
  const ixs = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions || []).flatMap((i) => i.instructions)];
  for (const ix of ixs) {
    const p = (ix as { parsed?: { type?: string; info?: Record<string, unknown> }; program?: string }).parsed;
    if ((ix as { program?: string }).program !== "system" || !p?.info) continue;
    if (p.type === "transfer" || p.type === "transferWithSeed") out.push({ from: String(p.info.source), to: String(p.info.destination), lamports: Number(p.info.lamports) });
  }
  return out;
}
function deltaOf(tx: ParsedTransactionWithMeta, addr: string) {
  const i = tx.transaction.message.accountKeys.findIndex((k) => k.pubkey.toBase58() === addr);
  if (i < 0 || !tx.meta) return 0;
  return tx.meta.postBalances[i] - tx.meta.preBalances[i];
}
/** Parsed transactions, cached forever by signature; at most `max` new ones are fetched per call (one at a time). */
async function getParsed(sigs: string[], max = 8) {
  const need = sigs.filter((s) => !parsed.has(s)).slice(0, max);
  for (const sig of need) {
    const tx = await connection().getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }).catch(() => undefined);
    if (tx === undefined) break; // rate-limited: try the rest next time
    parsed.set(sig, tx);
  }
  if (parsed.size > 5000) parsed.clear();
  return sigs.map((s) => parsed.get(s) || null);
}

/** Checks one signature on chain. Returns the status and, once confirmed, what moved for `wallet`. */
export async function checkSig(sig: string, wallet: string, to?: string, parse = true) {
  const c = connection();
  const st = (await c.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0];
  if (!st) return { status: "pending" as TxStatus };
  if (st.err) return { status: "failed" as TxStatus, error: "The transaction failed on Solana." };
  if (st.confirmationStatus !== "confirmed" && st.confirmationStatus !== "finalized") return { status: "pending" as TxStatus };
  const [tx] = parse ? await getParsed([sig]) : [null];
  if (!tx) return { status: "confirmed" as TxStatus };
  const t = transfersOf(tx);
  const toMe = to ? t.filter((x) => x.to === to && x.from === wallet).reduce((a, x) => a + x.lamports, 0) : 0;
  return {
    status: "confirmed" as TxStatus, fee: (tx.meta?.fee || 0) / LAMPORTS_PER_SOL, at: tx.blockTime ? tx.blockTime * 1000 : undefined,
    sol: toMe ? toMe / LAMPORTS_PER_SOL : Math.abs(deltaOf(tx, wallet)) / LAMPORTS_PER_SOL, matched: !to || toMe > 0,
  };
}

/**
 * Follows a receipt until Solana says confirmed or failed (up to `waitMs`), then stores the result and your new balance.
 * The amount and recipient on a confirmed receipt are the on-chain ones.
 */
const settling = new Map<string, Promise<TxEvent | null>>();
export function settleTx(userId: string, convo: string, id: string, wallet: string, waitMs = 45_000): Promise<TxEvent | null> {
  const key = `${userId}:${convo}:${id}`;
  const cur = settling.get(key);
  if (cur) return waitMs > 0 ? cur : readTx(userId, convo, id); // one follower per receipt; a quick poll doesn't wait on it
  const p = settleOnce(userId, convo, id, wallet, waitMs).finally(() => settling.delete(key));
  settling.set(key, p);
  return p;
}
async function settleOnce(userId: string, convo: string, id: string, wallet: string, waitMs: number): Promise<TxEvent | null> {
  let ev = await readTx(userId, convo, id);
  if (!ev) return null;
  const end = Date.now() + waitMs;
  while (ev.sig && (ev.status === "pending" || (ev.status === "confirmed" && ev.balance === undefined))) {
    const payerWallet = ev.kind === "return" && ev.from ? ev.from : wallet;
    const r = await checkSig(ev.sig, payerWallet, ev.to).catch(() => ({ status: "pending" as TxStatus }));
    if (r.status !== "pending") {
      let bal: number | undefined;
      for (let i = 0; i < 3 && bal === undefined; i++) {
        bal = await connection().getBalance(new PublicKey(wallet), "confirmed").then((b) => b / LAMPORTS_PER_SOL).catch(() => undefined);
        if (bal === undefined) await new Promise((res) => setTimeout(res, 800));
      }
      const extra = r as { fee?: number; sol?: number; matched?: boolean; error?: string };
      ev = await recordTx(userId, convo, {
        ...ev, status: r.status, ...(extra.error ? { error: extra.error } : {}), ...(extra.fee !== undefined ? { fee: extra.fee } : {}),
        ...(extra.sol && extra.matched ? { sol: +extra.sol.toFixed(9) } : {}), ...(bal !== undefined ? { balance: bal } : { balance: -1 }),
      });
      break;
    }
    if (Date.now() > end) break;
    await new Promise((res) => setTimeout(res, 2000));
  }
  return ev;
}

/* ---------- the agent's wallet history ---------- */

export type TxLine = { sig?: string; at: number; dir: "out" | "in" | "self"; sol: number; counterparty: string; kind?: TxKind; status: TxStatus; wallet: string; fee?: number };
type Snapshot = { at: number; balance: number | null; lines: TxLine[]; hired: { name: string; address: string; balance: number | null }[]; names?: Map<string, string> };
type ChainPart = { at: number; balances: (number | null)[]; wallets: string[]; sigs: { signature: string; err: unknown; blockTime?: number | null }[][]; hired: { slug: string; name: string; address: string }[] };
const chainCache = new Map<string, ChainPart>();
const inflight = new Map<string, Promise<ChainPart>>();

async function hiredOf(userId: string) {
  const rows = await db().select({ slug: agents.slug, name: agents.name, meta: agents.meta }).from(agents).where(and(eq(agents.userId, userId), eq(agents.kind, "hired")));
  return rows.slice(0, 4).map((r) => { try { return { slug: r.slug, name: (r.meta as { nick?: string })?.nick || r.name, address: hireWallet(userId, r.slug).publicKey.toBase58() }; } catch { return null; } }).filter((x): x is { slug: string; name: string; address: string } => !!x);
}

/** Balances (one call) and recent signatures: 20 for your wallet, 5 per hired agent's task wallet. Cached 45 s. */
async function chainPart(userId: string, wallet: string): Promise<ChainPart> {
  const c = connection();
  const hired = await hiredOf(userId).catch(() => []);
  const wallets = [wallet, ...hired.map((h) => h.address)];
  const infos = await c.getMultipleAccountsInfo(wallets.map((w) => new PublicKey(w)), "confirmed").catch(() => null);
  const balances = wallets.map((_, i) => (infos ? (infos[i]?.lamports ?? 0) / LAMPORTS_PER_SOL : null));
  const sigs: ChainPart["sigs"] = [];
  for (let i = 0; i < wallets.length; i++) sigs.push(await c.getSignaturesForAddress(new PublicKey(wallets[i]), { limit: i ? 5 : 20 }, "confirmed").catch(() => []));
  // details for the newest ones (cached by signature, so this is only slow the first time)
  await getParsed(sigs.flat().sort((x, y) => (y.blockTime || 0) - (x.blockTime || 0)).map((x) => x.signature), 10).catch(() => []);
  return { at: Date.now(), balances, wallets, sigs, hired };
}

function build(part: ChainPart, events: (TxEvent & { convo: string })[], wallet: string): Snapshot {
  const names = new Map<string, string>([[wallet, "your wallet"]]);
  if (treasury()) names.set(treasury(), "Lexari (payment)");
  const fa = faucetAddress(); if (fa) names.set(fa, "Lexari faucet");
  for (const h of part.hired) names.set(h.address, `${h.name}'s task wallet`);
  const bySig = new Map(events.filter((e) => e.sig).map((e) => [e.sig!, e]));
  const lines: TxLine[] = [];
  const seen = new Set<string>();
  part.wallets.forEach((me, wi) => {
    for (const s of part.sigs[wi] || []) {
      if (seen.has(s.signature)) continue; // a fund transfer shows on both wallets: list it once, from your side
      const tx = parsed.get(s.signature) || null;
      const status: TxStatus = s.err ? "failed" : "confirmed";
      const at = (s.blockTime || 0) * 1000 || Date.now();
      const e = bySig.get(s.signature);
      if (!tx) {
        if (e) { lines.push({ sig: s.signature, at, dir: e.kind === "incoming" ? "in" : "out", sol: e.sol, counterparty: e.kind === "incoming" ? e.from || "" : e.to || "", kind: e.kind, status, wallet: me, fee: e.fee }); seen.add(s.signature); }
        continue; // not parsed yet: shown once the details are in
      }
      const delta = deltaOf(tx, me);
      const t = transfersOf(tx);
      const out = t.filter((x) => x.from === me), inn = t.filter((x) => x.to === me);
      const dir: TxLine["dir"] = delta > 0 ? "in" : "out";
      const big = [...(dir === "in" ? inn : out)].sort((x, y) => y.lamports - x.lamports)[0];
      const counter = big ? (dir === "in" ? big.from : big.to) : "";
      const moved = big ? (dir === "in" ? inn : out).filter((x) => (dir === "in" ? x.from : x.to) === counter).reduce((acc, x) => acc + x.lamports, 0) : Math.abs(delta);
      if (!moved) continue;
      lines.push({ sig: s.signature, at, dir, sol: moved / LAMPORTS_PER_SOL, counterparty: counter, kind: e?.kind, status, wallet: me, fee: (tx.meta?.fee || 0) / LAMPORTS_PER_SOL });
      seen.add(s.signature);
    }
  });
  // Receipts the chain list doesn't show (pending, cancelled, failed before sending, or older than the window).
  for (const e of events) if (!e.sig || !seen.has(e.sig)) {
    lines.push({ sig: e.sig, at: e.at, dir: e.kind === "incoming" ? "in" : "out", sol: e.sol, counterparty: e.kind === "incoming" ? e.from || "" : e.to || "", kind: e.kind, status: e.status, wallet: e.kind === "return" ? e.from || wallet : wallet, fee: e.fee });
    if (e.sig) seen.add(e.sig);
  }
  lines.sort((x, y) => y.at - x.at);
  // A receipt's balance (read right after it confirmed) is newer than a cached chain read.
  const latest = events.find((e) => e.status === "confirmed" && typeof e.balance === "number" && e.balance >= 0 && e.at > part.at - 120_000);
  const balance = latest && latest.at > part.at ? latest.balance! : part.balances[0];
  return { at: Date.now(), balance, lines: lines.slice(0, 24), hired: part.hired.map((h, i) => ({ name: h.name, address: h.address, balance: part.balances[i + 1] })), names };
}

/** Your wallet history: receipts from the database (always fresh) plus the chain part (cached 45 s; a call turn uses whatever is cached). */
export async function walletHistory(userId: string, wallet: string, maxWaitMs = 4000, fresh = false): Promise<Snapshot | null> {
  const events = allReceipts(userId).catch(() => [] as (TxEvent & { convo: string })[]);
  const hit = chainCache.get(userId);
  let part: ChainPart | null = hit && Date.now() - hit.at < (fresh ? 8_000 : 45_000) ? hit : null;
  if (!part) {
    let p = inflight.get(userId);
    if (!p) {
      p = chainPart(userId, wallet).then((x) => { chainCache.set(userId, x); return x; }).finally(() => inflight.delete(userId));
      inflight.set(userId, p);
    }
    p.catch(() => {});
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), maxWaitMs));
    part = (await Promise.race([p, timeout]).catch(() => null)) || hit || null;
  }
  const ev = await events;
  if (!part) part = { at: 0, balances: [null], wallets: [wallet], sigs: [[]], hired: [] };
  return build(part, ev, wallet);
}

const KIND_NOTE: Partial<Record<TxKind, string>> = { send: "send from chat", fund: "funded a hired agent's task", return: "leftover returned", hire: "hire payment", plan: "plan payment", card: "card payment", mint: "ID card mint", incoming: "incoming" };

function fmt(ms: number, tz: string) {
  try { return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(ms); }
  catch { return new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC"; }
}
function dayKey(ms: number, tz: string) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms); }
  catch { return new Date(ms).toISOString().slice(0, 10); }
}
export const TX_MARK = "[lexari-tx]";

/** The block the agent reads on every turn: balance, recent transactions (newest first) and today's totals. */
export function historyBlock(snap: Snapshot, wallet: string, tz = "UTC") {
  const names = snap.names || new Map<string, string>();
  const who = (a: string) => (a ? names.get(a) ? `${names.get(a)} (${short(a)})` : short(a) : "unknown");
  const today = dayKey(Date.now(), tz), yest = dayKey(Date.now() - 86_400_000, tz);
  const mine = snap.lines.filter((l) => l.wallet === wallet);
  const sum = (f: (l: TxLine) => boolean) => mine.filter((l) => l.status === "confirmed" && f(l)).reduce((a, l) => ({ n: a.n + 1, sol: a.sol + l.sol }), { n: 0, sol: 0 });
  const sentToday = sum((l) => l.dir === "out" && dayKey(l.at, tz) === today);
  const inToday = sum((l) => l.dir === "in" && dayKey(l.at, tz) === today);
  const sentAll = sum((l) => l.dir === "out");
  const rows = snap.lines.slice(0, 20).map((l) => {
    const d = dayKey(l.at, tz); const when = `${d === today ? "today" : d === yest ? "yesterday" : ""} ${fmt(l.at, tz)}`.trim();
    const verb = l.dir === "in" ? `received ${solStr(l.sol)} from ${who(l.counterparty)}` : l.counterparty ? `sent ${solStr(l.sol)} to ${who(l.counterparty)}` : `spent ${solStr(l.sol)} (network fees/rent, no transfer)`;
    const side = l.wallet === wallet ? "" : ` [on ${who(l.wallet)}]`;
    const isNew = l.dir === "in" && Date.now() - l.at < 15 * 60_000 ? " (NEW, just arrived)" : "";
    return `- ${when} · ${verb}${side} · ${l.status}${l.kind ? ` · ${KIND_NOTE[l.kind]}` : ""}${l.sig ? ` · sig ${short(l.sig)}` : ""}${isNew}`;
  });
  return [
    TX_MARK,
    `The person's wallet activity on Solana ${cluster()} (real data from Lexari and the chain). Now: ${fmt(Date.now(), tz)} (${tz}).`,
    `Their wallet ${short(wallet)} balance: ${snap.balance === null ? "unknown right now" : solStr(snap.balance)}.`,
    ...snap.hired.map((h) => `${h.name}'s task wallet ${short(h.address)}: ${h.balance === null ? "unknown" : solStr(h.balance)}.`),
    rows.length ? `Recent transactions, newest first:\n${rows.join("\n")}` : "No transactions yet.",
    `Totals from this list (confirmed only): sent today ${solStr(sentToday.sol)} in ${sentToday.n} transaction${sentToday.n === 1 ? "" : "s"}; received today ${solStr(inToday.sol)}; sent in all listed ${solStr(sentAll.sol)} (${sentAll.n}).`,
    "Use this to answer questions about transfers, payments, balances and spending (\"did it go through?\", \"what did I send today?\"). Say amounts and short addresses exactly as listed; pending means not confirmed yet; cancelled means nothing was sent. Never invent a transaction that isn't listed. If something marked NEW arrived that you haven't mentioned, mention it briefly.",
  ].join("\n");
}

/**
 * SOL that arrived from somewhere else (not a Confirm card): logged as a receipt in the chat of the wallet it reached
 * (yours: your main chat; a hired agent's: that agent's chat). Only the last 24 hours, newest 3 per wallet.
 */
export async function noticeIncoming(userId: string, wallet: string) {
  const snap = await walletHistory(userId, wallet, 8000, true);
  if (!snap) return 0;
  const hired = await hiredOf(userId).catch(() => []);
  const fresh = snap.lines.filter((l) => l.dir === "in" && l.status === "confirmed" && l.sig && !l.kind && Date.now() - l.at < 86_400_000 && l.sol > 0);
  if (!fresh.length) return 0;
  const known = await db().select({ clientId: messages.clientId }).from(messages).innerJoin(chats, eq(messages.chatId, chats.id))
    .where(and(eq(chats.userId, userId), inArray(messages.clientId, fresh.map((l) => `tx-in-${l.sig!.slice(0, 34)}`)))).catch(() => []);
  const have = new Set(known.map((k) => k.clientId));
  const per = new Map<string, number>();
  let n = 0;
  for (const l of fresh) {
    const id = `in-${l.sig!.slice(0, 34)}`;
    if (have.has(`tx-${id}`)) continue;
    if (l.counterparty === wallet || hired.some((h) => h.address === l.counterparty)) continue; // your own moves are already receipts
    const c = (per.get(l.wallet) || 0) + 1; per.set(l.wallet, c); if (c > 3) continue;
    const h = hired.find((x) => x.address === l.wallet);
    const from = snap.names?.get(l.counterparty);
    await recordTx(userId, h ? h.slug : "home", { id, kind: "incoming", status: "confirmed", sol: +l.sol.toFixed(9), at: l.at, from: l.counterparty, to: l.wallet, sig: l.sig, ...(from ? { label: from } : {}), ...(h ? { agent: h.slug } : {}) });
    n++;
  }
  return n;
}
