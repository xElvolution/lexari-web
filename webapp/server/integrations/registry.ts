/**
 * The integration connectors on the server: each tool an agent can call, MCP-shaped (name, description, input
 * schema), with `risk` "read" (returns live data to the agent) or "sign" (prepares a confirm card; the person
 * approves it and Lexari executes it from the agent's own wallet). Catalog copy for the app is in
 * content/integrations.ts under the same connector ids.
 *
 * Adding an integration: add its entry to content/integrations.ts, then its tools here. Limits, the social gate,
 * per-agent grants and the action log are applied to every tool by server/integrations/actions.ts.
 */
import { z } from "zod";
import type { Keypair } from "@solana/web3.js";
import type { IntegrationId, MarketsCard } from "@/content/integrations";
import { EVM, evmAddress, evmBalances, type EvmChain } from "./evm";
import { jupiterQuote, polymarketMarkets, spotUsd } from "./market";
import { EXTRA_TOOLS } from "./extra";
import { bridgeQuote } from "./bridge";
import { SOL_RESERVE_LAMPORTS, balances, feePayer, fmtAmount, isDevnet, network, orcaQuote, orcaSwap, parseAddress, transfer, type Asset } from "./solana";

export type AgentRef = { slug: string; kind: string; name: string; userId: string; keypair: () => Keypair };
export type GrantLimits = { perTxUsd: number; dailyUsd: number; maxSlippageBps: number };
export type ReadResult = { text: string; markets?: MarketsCard; summary: string };
export type Prepared = { title: string; rows: [string, string][]; usdMicros: number; chain: string; plan: Record<string, unknown>; summary: string };
export type Executed = {
  sig: string; confirmed: boolean; rows?: [string, string][];
  /** what the agent hears after an auto (within budget) payment */
  text?: string;
  /** a receipt row in the chat (kind "pay"): amount and label already formatted */
  receipt?: { amount: string; label: string; net?: string; url?: string };
};

import { Reject } from "./reject";
export { Reject };

export type ToolDef = {
  name: string;
  connector: IntegrationId;
  risk: "read" | "sign";
  /** one line for the agent's prompt, with the JSON input it takes */
  hint: string;
  input: z.ZodTypeAny;
  run?: (input: never, agent: AgentRef) => Promise<ReadResult>;
  prepare?: (input: never, agent: AgentRef, limits: GrantLimits) => Promise<Prepared>;
  execute?: (plan: never, agent: AgentRef) => Promise<Executed>;
  /** sign tools that run on their own inside the agent's budget (server/agentpay/budgets.ts); over it they're a Confirm card */
  auto?: boolean;
};

const num = z.union([z.number(), z.string().regex(/^\s*\$?\d+(\.\d+)?\s*$/).transform((s) => Number(s.replace(/[$\s]/g, "")))]);
const asset = z.string().transform((s) => s.toUpperCase().replace(/[^A-Z]/g, "").replace(/^TEST/, "").replace(/^DEV/, "")).pipe(z.enum(["SOL", "USDC"]));
const MICROS = 1_000_000;
const usdMicros = (usd: number) => Math.round(usd * MICROS);
const money = (usd: number) => `$${usd.toFixed(usd < 1 ? 4 : 2).replace(/(\.\d\d)\d*?0+$/, "$1")}`;

/** The per-trade limit is checked before anything else (the full check, with today's total, runs again after). */
function perTradeFirst(usdValue: number, limits: GrantLimits | undefined, name: string) {
  if (limits && usdValue > limits.perTxUsd) throw new Reject(`That's ${money(usdValue)}, over your $${limits.perTxUsd} per trade limit for ${name}.`);
}
async function solUsd() {
  try { return await spotUsd("SOL"); } catch { throw new Reject("I couldn't get a live SOL price to check your limits, so nothing was prepared. Try again in a moment."); }
}

const feeRow = (agent: AgentRef): [string, string] => ["Network fee", feePayer(agent.keypair()).publicKey.equals(agent.keypair().publicKey) ? "About 0.000005 SOL" : "Paid by Lexari on devnet"];

/* ---------- Solana ---------- */
const solanaWallet: ToolDef = {
  name: "solana.wallet", connector: "solana", risk: "read", input: z.object({}).passthrough(),
  hint: `solana.wallet {} : your own Solana wallet address and what it holds (${isDevnet() ? "devnet" : "mainnet"}).`,
  run: async (_i: never, agent) => {
    const b = await balances(agent.keypair().publicKey);
    return { summary: "Checked its Solana wallet", text: `Your Solana wallet (${network()}): ${b.address}. It holds ${fmtAmount("SOL", b.sol)} SOL and ${b.usdc.toFixed(2)} test USDC.` };
  },
};

const transferInput = z.object({ to: z.string().min(32).max(44), asset: asset.default("USDC"), amount: num }).passthrough();
const solanaTransfer: ToolDef = {
  name: "solana.transfer", connector: "solana", risk: "sign", input: transferInput,
  hint: `solana.transfer {"to":"ADDRESS","asset":"USDC" or "SOL","amount":1.5} : prepare a transfer from YOUR wallet; the person confirms it.`,
  prepare: async (i: z.output<typeof transferInput>, agent, limits) => {
    if (!isDevnet()) throw new Reject("Transfers run on devnet only right now.");
    const to = parseAddress(i.to);
    if (!to) throw new Reject("That isn't a valid Solana wallet address.");
    const kp = agent.keypair();
    if (to.equals(kp.publicKey)) throw new Reject("That's my own wallet.");
    if (!(i.amount > 0)) throw new Reject("The amount has to be more than 0.");
    const a = i.asset as Asset;
    perTradeFirst(a === "USDC" ? i.amount : i.amount * (await solUsd()), limits, "Solana");
    const b = await balances(kp.publicKey);
    if (a === "USDC") {
      if (Math.round(i.amount * 1e6) > b.usdcMicros) throw new Reject(`My wallet only holds ${b.usdc.toFixed(2)} test USDC.`);
    } else {
      const lamports = Math.round(i.amount * 1e9);
      if (lamports > b.lamports) throw new Reject(`My wallet only holds ${fmtAmount("SOL", b.sol)} SOL.`);
      const left = b.lamports - lamports;
      if (left > 0 && left < SOL_RESERVE_LAMPORTS) throw new Reject("Send it all, or leave at least 0.001 SOL in my wallet.");
    }
    const usd = a === "USDC" ? i.amount : i.amount * (await solUsd());
    const amount = a === "USDC" ? Math.round(i.amount * 1e6) / 1e6 : Math.round(i.amount * 1e9) / 1e9;
    return {
      title: `Send ${fmtAmount(a, amount)} ${a}`, chain: "solana", usdMicros: usdMicros(usd), summary: `Send ${fmtAmount(a, amount)} ${a}`,
      rows: [["Send", `${fmtAmount(a, amount)} ${a === "USDC" ? "test USDC" : "SOL"}`], ["Value", a === "USDC" ? money(usd) : `≈ ${money(usd)} at market price`], ["To", `${to.toBase58().slice(0, 4)}…${to.toBase58().slice(-4)}`], ["From", `${agent.name}'s wallet`], ["Network", network()], feeRow(agent)],
      plan: { kind: "transfer", to: to.toBase58(), asset: a, amount },
    };
  },
  execute: async (p: { to: string; asset: Asset; amount: number }, agent) => {
    const to = parseAddress(p.to);
    if (!to) throw new Reject("That isn't a valid Solana wallet address.");
    return transfer(agent.keypair(), to, p.asset, p.amount);
  },
};

/* ---------- Orca ---------- */
const swapInput = z.object({ sell: asset.optional(), from: asset.optional(), buy: asset.optional(), to: asset.optional(), amount: num, slippageBps: num.optional(), slippage: num.optional() }).passthrough();
type SwapIn = z.output<typeof swapInput>;
function swapSide(i: SwapIn): { sell: Asset; buy: Asset } {
  const sell = (i.sell || i.from || (i.buy || i.to ? ((i.buy || i.to) === "SOL" ? "USDC" : "SOL") : "USDC")) as Asset;
  const buy = (i.buy || i.to || (sell === "SOL" ? "USDC" : "SOL")) as Asset;
  if (sell === buy) throw new Reject("Pick two different tokens: SOL and USDC trade on devnet.");
  return { sell, buy };
}
const slipOf = (i: SwapIn, max: number) => {
  const v = i.slippageBps !== undefined ? i.slippageBps : i.slippage !== undefined ? i.slippage * 100 : Math.min(max, 100);
  return Math.round(v);
};
const orcaQuoteTool: ToolDef = {
  name: "orca.quote", connector: "orca", risk: "read", input: swapInput,
  hint: `orca.quote {"sell":"USDC","buy":"SOL","amount":1} : a live quote from Orca's SOL / USDC pool.`,
  run: async (i: SwapIn) => {
    const { sell } = swapSide(i);
    if (!(i.amount > 0)) throw new Reject("The amount has to be more than 0.");
    const q = await orcaQuote(sell, i.amount, 100);
    const mkt = await spotUsd("SOL").catch(() => 0);
    return { summary: `Quoted ${fmtAmount(sell, i.amount)} ${sell} on Orca`, text: `Orca quote on ${network()}: ${fmtAmount(sell, q.amountIn)} ${sell} gets about ${fmtAmount(q.buy, q.estOut)} ${q.buy} (at least ${fmtAmount(q.buy, q.minOut)} with 1% slippage). Devnet pool price: 1 SOL = ${q.poolPrice.toFixed(2)} test USDC.${mkt ? ` Real mainnet price for reference: 1 SOL ≈ $${mkt.toFixed(2)}.` : ""} Devnet prices are test prices, not real market prices.` };
  },
};
const orcaSwapTool: ToolDef = {
  name: "orca.swap", connector: "orca", risk: "sign", input: swapInput,
  hint: `orca.swap {"sell":"USDC","buy":"SOL","amount":1} : prepare a swap in YOUR wallet on Orca (SOL and test USDC); the person confirms it.`,
  prepare: async (i: SwapIn, agent, limits) => {
    if (!isDevnet()) throw new Reject("Swaps run on devnet only right now.");
    const { sell, buy } = swapSide(i);
    if (!(i.amount > 0)) throw new Reject("The amount has to be more than 0.");
    const slip = slipOf(i, limits.maxSlippageBps);
    if (slip > limits.maxSlippageBps) throw new Reject(`That's ${slip / 100}% slippage, over your ${limits.maxSlippageBps / 100}% limit for Orca.`);
    if (slip < 1) throw new Reject("Slippage has to be above 0.");
    perTradeFirst(sell === "USDC" ? i.amount : i.amount * (await solUsd()), limits, "Orca");
    const kp = agent.keypair();
    const b = await balances(kp.publicKey);
    if (sell === "USDC" && Math.round(i.amount * 1e6) > b.usdcMicros) throw new Reject(`My wallet only holds ${b.usdc.toFixed(2)} test USDC. Fund me from your balance first.`);
    if (sell === "SOL" && Math.round(i.amount * 1e9) > b.lamports - SOL_RESERVE_LAMPORTS) throw new Reject(`My wallet holds ${fmtAmount("SOL", b.sol)} SOL, and I keep 0.001 SOL so the wallet stays open.`);
    const q = await orcaQuote(sell, i.amount, slip);
    if (buy === "SOL" && q.minOut < 0.001) throw new Reject("That's too small to swap: the minimum is about 0.001 SOL out.");
    if (buy === "USDC" && q.minOut < 0.01) throw new Reject("That's too small to swap: the minimum is about $0.01 out.");
    const mkt = await solUsd();
    const usd = sell === "USDC" ? q.amountIn : Math.max(q.amountIn * mkt, q.estOut);
    return {
      title: `Swap ${fmtAmount(sell, q.amountIn)} ${sell} for ${buy}`, chain: "solana", usdMicros: usdMicros(usd), summary: `Swap ${fmtAmount(sell, q.amountIn)} ${sell} for ${buy}`,
      rows: [["You pay", `${fmtAmount(sell, q.amountIn)} ${sell}`], ["You get", `≈ ${fmtAmount(buy, q.estOut)} ${buy}`], ["Minimum", `${fmtAmount(buy, q.minOut)} ${buy} (${slip / 100}% slippage)`], ["Pool price", `1 SOL = ${q.poolPrice.toFixed(2)} USDC (devnet)`], ["Market price", `1 SOL ≈ $${mkt.toFixed(2)}`], ["From", `${agent.name}'s wallet`], ["Network", network()], feeRow(agent)],
      plan: { kind: "swap", sell, amount: q.amountIn, slippageBps: slip, minOutAtoms: q.raw.minAtoms },
    };
  },
  execute: async (p: { sell: Asset; amount: number; slippageBps: number; minOutAtoms: string }, agent) => {
    const r = await orcaSwap(agent.keypair(), p.sell, p.amount, p.slippageBps, p.minOutAtoms);
    return { sig: r.sig, confirmed: r.confirmed, rows: [["Got about", `${fmtAmount(r.quote.buy, r.quote.estOut)} ${r.quote.buy}`]] };
  },
};

/* ---------- Jupiter (mainnet quotes, read only) ---------- */
const jupInput = z.object({ from: z.string().min(1).max(60).optional(), sell: z.string().max(60).optional(), to: z.string().min(1).max(60).optional(), buy: z.string().max(60).optional(), amount: num }).passthrough();
const jupiterQuoteTool: ToolDef = {
  name: "jupiter.quote", connector: "jupiter", risk: "read", input: jupInput,
  hint: `jupiter.quote {"from":"SOL","to":"BONK","amount":1} : a live best-route quote on Solana mainnet (reference only, nothing is swapped).`,
  run: async (i: z.output<typeof jupInput>) => {
    const from = i.from || i.sell, to = i.to || i.buy;
    if (!from || !to) throw new Reject("Say which token to sell and which to buy.");
    const q = await jupiterQuote(from, to, i.amount);
    return { summary: `Quoted ${q.amount} ${q.from} to ${q.to} on Jupiter`, text: `Jupiter mainnet quote (reference only, not executed): ${q.amount} ${q.from} gets about ${+q.out.toPrecision(8)} ${q.to}${q.venues.length ? ` via ${q.venues.slice(0, 3).join(", ")}` : ""}, price impact ${q.impactPct}%.` };
  },
};

/* ---------- Cross-chain (LI.FI quotes, read only) ---------- */
const bridgeInput = z.object({ fromChain: z.string().min(2).max(30), toChain: z.string().min(2).max(30), token: z.string().min(1).max(20).optional(), from: z.string().max(20).optional(), to: z.string().max(20).optional(), amount: num }).passthrough();
const bridgeQuoteTool: ToolDef = {
  name: "bridge.quote", connector: "bridge", risk: "read", input: bridgeInput,
  hint: `bridge.quote {"fromChain":"solana","toChain":"base","from":"SOL","to":"USDC","amount":1} : a live cross-chain quote (route, fees, time) via LI.FI; reference only, nothing is bridged.`,
  run: async (i: z.output<typeof bridgeInput>) => {
    const fromToken = i.from || i.token || "";
    if (!fromToken) throw new Reject("Which token should I quote?");
    const q = await bridgeQuote({ fromChain: i.fromChain, toChain: i.toChain, fromToken, toToken: i.to || i.token, amount: i.amount }).catch((e: Error) => { throw new Reject(e.message); });
    const mins = q.secs < 90 ? `${q.secs} s` : `${Math.round(q.secs / 60)} min`;
    return { summary: `Quoted ${q.amount} ${q.from} ${q.fromChain} → ${q.to} ${q.toChain}`, text: `Cross-chain quote (LI.FI, reference only, not executed): ${q.amount} ${q.from} on ${q.fromChain} → about ${+q.out.toPrecision(7)} ${q.to} on ${q.toChain} (at least ${+q.outMin.toPrecision(7)} after slippage${q.outUsd ? `, ≈ $${q.outUsd.toFixed(2)}` : ""}). Route: ${q.route}. Fees ≈ $${q.feesUsd.toFixed(2)}, gas ≈ $${q.gasUsd.toFixed(2)}, about ${mins}.` };
  },
};

/* ---------- Polymarket (read only) ---------- */
const pmInput = z.object({ query: z.string().max(80).optional(), q: z.string().max(80).optional(), limit: num.optional() }).passthrough();
const polymarketTool: ToolDef = {
  name: "polymarket.markets", connector: "polymarket", risk: "read", input: pmInput,
  hint: `polymarket.markets {"query":"bitcoin","limit":5} : live Polymarket markets and odds for a topic; {} for what's trending.`,
  run: async (i: z.output<typeof pmInput>) => {
    const query = (i.query || i.q || "").trim();
    const items = await polymarketMarkets(query, Number(i.limit) || 5);
    const text = items.length
      ? `Live Polymarket markets${query ? ` for "${query}"` : " trending now"} (odds are the market's implied chance):\n${items.map((m, n) => `${n + 1}. ${m.title}: ${m.outcomes.map((o) => `${o.label} ${o.pct}%`).join(", ")} (24h volume $${m.volume24h.toLocaleString("en-US")})`).join("\n")}`
      : `No open Polymarket markets matched "${query}".`;
    return { summary: query ? `Looked up "${query}" on Polymarket` : "Looked up trending Polymarket markets", text, markets: { source: "polymarket", query, items, at: Date.now() } };
  },
};

/* ---------- Base and Ethereum (testnet reads) ---------- */
function evmWallet(chain: EvmChain): ToolDef {
  const c = EVM[chain];
  return {
    name: `${chain}.wallet`, connector: chain, risk: "read", input: z.object({}).passthrough(),
    hint: `${chain}.wallet {} : your own ${c.name} address and its ${c.network} balances, plus the live ETH price. Swaps and transfers on ${c.name} are coming soon.`,
    run: async (_i: never, agent) => {
      const address = evmAddress(agent.userId, agent.slug);
      const [b, eth] = await Promise.all([evmBalances(chain, address), spotUsd("ETH").catch(() => 0)]);
      return { summary: `Checked its ${c.name} wallet`, text: `Your ${c.name} address: ${address} (the same address works on every EVM chain). On ${c.network} it holds ${+b.eth.toFixed(6)} test ETH and ${b.usdc.toFixed(2)} test USDC.${eth ? ` Live ETH price: $${eth.toFixed(2)}.` : ""} Swaps and transfers on ${c.name} are coming soon in Lexari, so you can't send from it yet.` };
    },
  };
}

/* ---------- Market prices ---------- */
const priceInput = z.object({ symbols: z.array(z.string().max(12)).max(6).optional(), symbol: z.string().max(12).optional() }).passthrough();
const pricesTool: ToolDef = {
  name: "prices.get", connector: "prices", risk: "read", input: priceInput,
  hint: `prices.get {"symbols":["BTC","ETH","SOL"]} : live USD spot prices (up to 6).`,
  run: async (i: z.output<typeof priceInput>) => {
    const syms = [...new Set([...(i.symbols || []), ...(i.symbol ? [i.symbol] : [])].map((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean))].slice(0, 6);
    if (!syms.length) throw new Reject("Say which assets to price.");
    const out = await Promise.all(syms.map(async (s) => { try { return `${s} $${(await spotUsd(s)).toLocaleString("en-US", { maximumFractionDigits: 6 })}`; } catch { return `${s}: no price found`; } }));
    return { summary: `Checked prices for ${syms.join(", ")}`, text: `Live USD spot prices: ${out.join("; ")}.` };
  },
};

export const TOOLS: ToolDef[] = [solanaWallet, solanaTransfer, orcaQuoteTool, orcaSwapTool, jupiterQuoteTool, bridgeQuoteTool, polymarketTool, evmWallet("base"), evmWallet("ethereum"), pricesTool, ...EXTRA_TOOLS];
export const toolByName = (name: string) => TOOLS.find((t) => t.name === name.trim().toLowerCase());
