/**
 * Solana for integrations: an agent's own wallet (balances, transfers) and Orca Whirlpools swaps between SOL and the
 * test USDC the agent was funded with. Everything here signs with the AGENT's key (server/agentWallets.ts); Lexari's
 * payout wallet only pays the network fee on devnet (and gets the temporary wrapped SOL rent back in the same
 * transaction), so the agent doesn't need SOL just to move its USDC.
 *
 * Every transaction is simulated before it is sent, and confirmation is polled with backoff (the public devnet
 * endpoint rate limits; server/rpc.ts retries 429s and uses HELIUS_API_KEY when set).
 */
import { ComputeBudgetProgram, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, type Connection, type TransactionInstruction } from "@solana/web3.js";
import { NATIVE_MINT, createAssociatedTokenAccountIdempotentInstruction, createCloseAccountInstruction, createSyncNativeInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { cluster, usdcMint } from "../config";
import { connection } from "../hub/chain";
import { payoutKey } from "../agentWallets";

export const USDC_DECIMALS = 6;
/** Keep this much SOL in an agent wallet after selling SOL, so the account stays rent exempt. */
export const SOL_RESERVE_LAMPORTS = 1_000_000;
/** Orca's devnet Whirlpool for SOL / test USDC (the same test USDC mint Lexari funds agents with). */
export const ORCA_DEVNET_POOL = process.env.ORCA_SOL_USDC_POOL || "5GPCnpWwoDayCP5FVCJT1cS7dePufC5FrjPTVvPoUYnm";

export const isDevnet = () => cluster() === "devnet";
export const network = () => (isDevnet() ? "Solana devnet" : "Solana");
export const txExplorer = (sig: string) => `https://explorer.solana.com/tx/${sig}${isDevnet() ? "?cluster=devnet" : ""}`;
export const addrExplorer = (a: string) => `https://explorer.solana.com/address/${a}${isDevnet() ? "?cluster=devnet" : ""}`;

export type Asset = "SOL" | "USDC";
export type SolBalances = { address: string; sol: number; usdc: number; lamports: number; usdcMicros: number };

export async function balances(owner: PublicKey, c: Connection = connection()): Promise<SolBalances> {
  const mint = usdcMint();
  const [lamports, usdcMicros] = await Promise.all([
    c.getBalance(owner, "confirmed"),
    mint ? c.getTokenAccountBalance(getAssociatedTokenAddressSync(new PublicKey(mint), owner, true), "confirmed").then((r) => Number(r.value.amount)).catch(() => 0) : Promise.resolve(0),
  ]);
  return { address: owner.toBase58(), lamports, usdcMicros, sol: lamports / LAMPORTS_PER_SOL, usdc: usdcMicros / 10 ** USDC_DECIMALS };
}

/** Who pays the network fee: Lexari's devnet payout wallet when it is set up, otherwise the agent itself. */
export function feePayer(agent: Keypair): Keypair {
  const p = isDevnet() ? payoutKey() : null;
  return p ?? agent;
}

/** Signs, simulates, sends and waits for confirmation. Returns the signature; `confirmed` false means still pending. */
async function sendIxs(ixs: TransactionInstruction[], payer: Keypair, signers: Keypair[], c: Connection = connection()) {
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
  const uniq = [payer, ...signers].filter((k, i, a) => a.findIndex((x) => x.publicKey.equals(k.publicKey)) === i);
  tx.sign(...uniq);
  const sim = await c.simulateTransaction(tx);
  if (sim.value.err) throw new SimError(simReason(sim.value.err, sim.value.logs || []));
  const sig = await c.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 5 });
  const end = Date.now() + 45_000;
  let wait = 700;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait * 1.4, 2500);
    const st = (await c.getSignatureStatuses([sig]).catch(() => null))?.value[0];
    if (st?.err) throw new ChainError("The transaction failed on Solana.", sig);
    if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return { sig, confirmed: true };
    if ((await c.getBlockHeight("confirmed").catch(() => 0)) > lastValidBlockHeight) break;
  }
  return { sig, confirmed: false };
}

/** Failed before anything was sent: nothing moved, no fee. */
export class SimError extends Error {}
/** Sent, then failed on chain (a network fee may have been paid). */
export class ChainError extends Error { constructor(message: string, public sig: string) { super(message); } }

function simReason(err: unknown, logs: string[]) {
  const l = logs.join("\n");
  if (/insufficient lamports|insufficient funds for rent/i.test(l)) return "There isn't enough SOL in the wallet for that.";
  if (/insufficient funds/i.test(l)) return "The wallet doesn't hold enough for that.";
  if (/AmountOutBelowMinimum|0x1794/i.test(l)) return "The price moved past your slippage limit. Ask again for a fresh quote.";
  if (/TokenMinSubceeded|LiquidityZero|0x177/i.test(l)) return "The pool can't fill that size right now. Try a smaller amount.";
  if (/AccountNotFound|could not find account/i.test(JSON.stringify(err)) || /AccountNotFound/.test(l)) return "The wallet has nothing to send yet.";
  return "Solana rejected it in simulation, so nothing was sent.";
}

/** Is the payout (fee) wallet able to cover fees right now. */
export async function feeWalletOk(c: Connection = connection()) {
  const p = feePayer(Keypair.generate());
  return (await c.getBalance(p.publicKey, "confirmed").catch(() => 0)) > 10_000_000;
}

export function parseAddress(to: string): PublicKey | null {
  try { const k = new PublicKey(to.trim()); return PublicKey.isOnCurve(k.toBytes()) ? k : null; } catch { return null; }
}

/** A transfer of test USDC or SOL from the agent's own wallet. */
export async function transfer(agent: Keypair, to: PublicKey, asset: Asset, amount: number) {
  const c = connection();
  const payer = feePayer(agent);
  const ixs: TransactionInstruction[] = [];
  if (asset === "USDC") {
    const mint = new PublicKey(usdcMint());
    const micros = Math.round(amount * 10 ** USDC_DECIMALS);
    const src = getAssociatedTokenAddressSync(mint, agent.publicKey, true);
    const dst = getAssociatedTokenAddressSync(mint, to, true);
    ixs.push(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, dst, to, mint), createTransferCheckedInstruction(src, mint, dst, agent.publicKey, BigInt(micros), USDC_DECIMALS));
  } else {
    ixs.push(SystemProgram.transfer({ fromPubkey: agent.publicKey, toPubkey: to, lamports: Math.round(amount * LAMPORTS_PER_SOL) }));
  }
  return sendIxs(ixs, payer, [agent], c);
}

/* ---------- Orca Whirlpools (SOL / test USDC on devnet) ---------- */

type Orca = typeof import("@orca-so/whirlpools-sdk");
let orcaMod: Promise<{ sdk: Orca; common: typeof import("@orca-so/common-sdk"); BN: typeof import("@coral-xyz/anchor").BN }> | null = null;
/** Loaded on first use, so chat turns without a swap never load the Orca SDK. */
const orca = () => (orcaMod ??= Promise.all([import("@orca-so/whirlpools-sdk"), import("@orca-so/common-sdk"), import("@coral-xyz/anchor")]).then(([sdk, common, anchor]) => ({ sdk, common, BN: anchor.BN })));

function orcaCtx(sdk: Orca, c: Connection, owner: PublicKey) {
  // Read-only wallet for the SDK: Lexari signs the transaction itself with the agent's key.
  const wallet = { publicKey: owner, signTransaction: async <T>(t: T) => t, signAllTransactions: async <T>(t: T[]) => t, payer: undefined as never };
  return sdk.WhirlpoolContext.from(c, wallet as never);
}

export type SwapQuote = {
  sell: Asset; buy: Asset; amountIn: number; estOut: number; minOut: number; slippageBps: number;
  /** pool price in USDC per SOL */
  poolPrice: number; feeIn: number; pool: string;
  raw: { inAtoms: string; outAtoms: string; minAtoms: string };
};

const atoms = (asset: Asset, n: number) => Math.round(n * 10 ** (asset === "SOL" ? 9 : USDC_DECIMALS));
const units = (asset: Asset, a: number) => a / 10 ** (asset === "SOL" ? 9 : USDC_DECIMALS);

async function loadQuote(c: Connection, owner: PublicKey, sell: Asset, amountIn: number, slippageBps: number) {
  if (!isDevnet()) throw new SimError("Swaps run on Solana devnet only right now.");
  if (!usdcMint()) throw new SimError("Test USDC isn't set up on this server.");
  const { sdk, common, BN } = await orca();
  const ctx = orcaCtx(sdk, c, owner);
  const client = sdk.buildWhirlpoolClient(ctx);
  const pool = await client.getPool(new PublicKey(ORCA_DEVNET_POOL), sdk.IGNORE_CACHE);
  const d = pool.getData();
  const usdc = new PublicKey(usdcMint());
  if (!d.tokenMintA.equals(NATIVE_MINT) || !d.tokenMintB.equals(usdc)) throw new SimError("The Orca pool doesn't match this server's test USDC.");
  const inputMint = sell === "SOL" ? NATIVE_MINT : usdc;
  const q = await sdk.swapQuoteByInputToken(pool, inputMint, new BN(atoms(sell, amountIn)), common.Percentage.fromFraction(slippageBps, 10_000), ctx.program.programId, ctx.fetcher, sdk.IGNORE_CACHE);
  const sp = Number(d.sqrtPrice.toString()) / 2 ** 64;
  const poolPrice = sp * sp * 10 ** (9 - USDC_DECIMALS); // USDC per SOL
  const buy: Asset = sell === "SOL" ? "USDC" : "SOL";
  const quote: SwapQuote = {
    sell, buy, amountIn: units(sell, Number(q.estimatedAmountIn.toString())), estOut: units(buy, Number(q.estimatedAmountOut.toString())),
    minOut: units(buy, Number(q.otherAmountThreshold.toString())), slippageBps, poolPrice, feeIn: units(sell, Number(q.estimatedFeeAmount.toString())), pool: ORCA_DEVNET_POOL,
    raw: { inAtoms: q.estimatedAmountIn.toString(), outAtoms: q.estimatedAmountOut.toString(), minAtoms: q.otherAmountThreshold.toString() },
  };
  return { sdk, ctx, pool, q, quote, usdc, BN };
}

/** A live quote from the Orca pool (no wallet needed). */
export async function orcaQuote(sell: Asset, amountIn: number, slippageBps: number): Promise<SwapQuote> {
  return (await loadQuote(connection(), PublicKey.default, sell, amountIn, slippageBps)).quote;
}

/**
 * Swaps in the agent's own wallet. `minOutAtoms` (from the quote the person confirmed) is the floor: if the fresh
 * quote now gives less than that, nothing is sent. The transaction itself also enforces the slippage minimum.
 */
export async function orcaSwap(agent: Keypair, sell: Asset, amountIn: number, slippageBps: number, minOutAtoms: string) {
  const c = connection();
  const owner = agent.publicKey;
  const { sdk, ctx, pool, q, quote, usdc, BN } = await loadQuote(c, owner, sell, amountIn, slippageBps);
  if (new BN(quote.raw.outAtoms).lt(new BN(minOutAtoms))) throw new SimError(`The price moved: you'd now get about ${quote.estOut.toFixed(sell === "SOL" ? 4 : 6)} ${quote.buy}, under the minimum you approved. Ask again for a fresh quote.`);
  const payer = feePayer(agent);
  const wsol = getAssociatedTokenAddressSync(NATIVE_MINT, owner, true);
  const usdcAta = getAssociatedTokenAddressSync(usdc, owner, true);
  const [wsolInfo] = await c.getMultipleAccountsInfo([wsol], "confirmed");
  const rent = await c.getMinimumBalanceForRentExemption(165);
  const ixs: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })];
  ixs.push(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, wsol, owner, NATIVE_MINT));
  ixs.push(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, usdcAta, owner, usdc));
  if (sell === "SOL") ixs.push(SystemProgram.transfer({ fromPubkey: owner, toPubkey: wsol, lamports: Number(q.amount.toString()) }), createSyncNativeInstruction(wsol));
  const params = sdk.SwapUtils.getSwapParamsFromQuote(q, ctx, pool, sell === "SOL" ? wsol : usdcAta, sell === "SOL" ? usdcAta : wsol, owner);
  ixs.push(...sdk.WhirlpoolIx.swapIx(ctx.program, params).instructions);
  // Unwrap: the wrapped SOL account closes back into the agent's wallet, then the rent the payout wallet put up
  // for it goes back to the payout wallet, so the fee sponsor only ever pays the network fee.
  ixs.push(createCloseAccountInstruction(wsol, owner, owner));
  if (!wsolInfo && !payer.publicKey.equals(owner)) ixs.push(SystemProgram.transfer({ fromPubkey: owner, toPubkey: payer.publicKey, lamports: rent }));
  const sent = await sendIxs(ixs, payer, [agent], c);
  return { ...sent, quote };
}

export const fmtAmount = (asset: Asset, n: number) => (asset === "USDC" ? n.toFixed(n < 1 ? 4 : 2) : (+n.toFixed(6)).toString());
