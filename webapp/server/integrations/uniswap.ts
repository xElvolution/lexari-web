/**
 * Uniswap v3 on EVM testnets (Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia), straight against Uniswap's own
 * deployed QuoterV2 and SwapRouter02 contracts, so there is no API key and no middleman:
 *   uniswap.quote : the best output across the 0.05%, 0.3% and 1% pools. Read only.
 *   uniswap.swap  : ETH and test USDC from the agent's own wallet. A sign tool: it only prepares a Confirm card; the
 *                   swap is sent after the person confirms, with the minimum output fixed on the card.
 * Testnet pools are thin, so testnet prices are not market prices; the card says so.
 */
import { z } from "zod";
import { encodeFunctionData, erc20Abi, parseUnits, type Hex } from "viem";
import { EVM, evmAddress, evmBalances, evmChainOf, type EvmChain } from "./evm";
import { fmtUnits, nativeUsd, publicClient, sendAndWait, walletClient } from "./evmchains";
import { Reject } from "./reject";
import { simulateEvm, type SimCall } from "./evmsim";
import type { AgentRef, Executed, GrantLimits, Prepared, ToolDef } from "./registry";

type UniChain = "ethereum" | "base" | "arbitrum";
const UNI: Record<UniChain, { quoter: Hex; router: Hex; weth: Hex }> = {
  ethereum: { quoter: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3", router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" },
  base: { quoter: "0xC5290058841028F1614F3A6F0F5816cAd0df5E27", router: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", weth: "0x4200000000000000000000000000000000000006" },
  arbitrum: { quoter: "0x2779a0CC1c3e0E44D2542EC3e79e3864Ae93Ef0B", router: "0x101F443B4d1b059569D643917553c771E1b9663E", weth: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" },
};
const FEES = [500, 3000, 10000] as const;
const quoterAbi = [{ type: "function", name: "quoteExactInputSingle", stateMutability: "nonpayable", inputs: [{ name: "params", type: "tuple", components: [{ name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "fee", type: "uint24" }, { name: "sqrtPriceLimitX96", type: "uint160" }] }], outputs: [{ name: "amountOut", type: "uint256" }, { name: "sqrtPriceX96After", type: "uint160" }, { name: "initializedTicksCrossed", type: "uint32" }, { name: "gasEstimate", type: "uint256" }] }] as const;
const routerAbi = [
  { type: "function", name: "exactInputSingle", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [{ name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "fee", type: "uint24" }, { name: "recipient", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" }, { name: "sqrtPriceLimitX96", type: "uint160" }] }], outputs: [{ name: "amountOut", type: "uint256" }] },
  { type: "function", name: "unwrapWETH9", stateMutability: "payable", inputs: [{ name: "amountMinimum", type: "uint256" }, { name: "recipient", type: "address" }], outputs: [] },
  { type: "function", name: "multicall", stateMutability: "payable", inputs: [{ name: "deadline", type: "uint256" }, { name: "data", type: "bytes[]" }], outputs: [{ name: "", type: "bytes[]" }] },
] as const;
/** SwapRouter02's "this contract" recipient: it holds the WETH until unwrapWETH9 pays out ETH. */
const ROUTER_SELF = "0x0000000000000000000000000000000000000002" as Hex;

function uniChain(s?: string): UniChain {
  const c = evmChainOf(s || "base");
  if (c !== "ethereum" && c !== "base" && c !== "arbitrum") throw new Reject("Uniswap swaps run on Ethereum Sepolia, Base Sepolia and Arbitrum Sepolia.");
  return c;
}
type Side = { sym: "ETH" | "USDC"; addr: Hex; decimals: number };
function sides(c: UniChain, sell: string, buy?: string): { a: Side; b: Side } {
  const norm = (s: string) => { const u = s.toUpperCase().replace(/^TEST/, ""); if (u === "ETH" || u === "WETH") return "ETH" as const; if (u === "USDC") return "USDC" as const; throw new Reject("On Uniswap testnets I trade ETH and test USDC."); };
  const sa = norm(sell), sb = buy ? norm(buy) : sa === "ETH" ? "USDC" : "ETH";
  if (sa === sb) throw new Reject("Pick two different tokens: ETH and USDC.");
  const of = (s: "ETH" | "USDC"): Side => (s === "ETH" ? { sym: "ETH", addr: UNI[c].weth, decimals: 18 } : { sym: "USDC", addr: EVM[c].usdc as Hex, decimals: 6 });
  return { a: of(sa), b: of(sb) };
}
export async function uniQuote(c: UniChain, a: Side, b: Side, amountIn: bigint) {
  const pc = publicClient(c);
  const res = await Promise.all(FEES.map(async (fee) => {
    try {
      const r = await pc.simulateContract({ address: UNI[c].quoter, abi: quoterAbi, functionName: "quoteExactInputSingle", args: [{ tokenIn: a.addr, tokenOut: b.addr, amountIn, fee, sqrtPriceLimitX96: BigInt(0) }] });
      return { fee, out: r.result[0] };
    } catch { return { fee, out: BigInt(0) }; }
  }));
  const best = res.reduce((x, y) => (y.out > x.out ? y : x));
  if (best.out <= BigInt(0)) throw new Reject(`Uniswap has no ${a.sym} / ${b.sym} liquidity on ${EVM[c].network} right now.`);
  return best;
}

const uIn = z.object({ chain: z.string().trim().optional(), sell: z.string().trim(), buy: z.string().trim().optional(), amount: z.coerce.number().positive(), slippage: z.coerce.number().positive().max(50).optional() }).passthrough();
type UIn = z.infer<typeof uIn>;

const quoteTool: ToolDef = {
  name: "uniswap.quote", connector: "uniswap", risk: "read", input: uIn,
  hint: 'uniswap.quote {"chain":"base","sell":"ETH","buy":"USDC","amount":0.01} : a live Uniswap v3 quote on Base Sepolia, Ethereum Sepolia or Arbitrum Sepolia. Read only.',
  run: async (i: never) => {
    const p = i as UIn;
    const c = uniChain(p.chain);
    const { a, b } = sides(c, p.sell, p.buy);
    const q = await uniQuote(c, a, b, parseUnits(String(p.amount), a.decimals));
    return { summary: `Uniswap quote on ${EVM[c].network}`, text: `Uniswap on ${EVM[c].network}: ${p.amount} ${a.sym} gets about ${fmtUnits(q.out, b.decimals)} ${b.sym} (best pool: ${q.fee / 10000}% fee). Testnet pool prices are not market prices. Quote only; nothing traded.` };
  },
};

/** The exact calls a swap sends (approve first when the router can't spend enough USDC yet). Used by the simulation and the send. */
function swapCalls(c: UniChain, a: Side, b: Side, me: Hex, amountIn: bigint, minOut: bigint, fee: number, approve: boolean): SimCall[] {
  const u = UNI[c];
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  if (a.sym === "ETH") {
    const swap = encodeFunctionData({ abi: routerAbi, functionName: "exactInputSingle", args: [{ tokenIn: u.weth, tokenOut: b.addr, fee, recipient: me, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: BigInt(0) }] });
    return [{ to: u.router, value: amountIn, data: encodeFunctionData({ abi: routerAbi, functionName: "multicall", args: [deadline, [swap]] }) }];
  }
  const swap = encodeFunctionData({ abi: routerAbi, functionName: "exactInputSingle", args: [{ tokenIn: a.addr, tokenOut: u.weth, fee, recipient: ROUTER_SELF, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: BigInt(0) }] });
  const unwrap = encodeFunctionData({ abi: routerAbi, functionName: "unwrapWETH9", args: [minOut, me] });
  return [
    ...(approve ? [{ to: a.addr, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [u.router, amountIn] }) }] : []),
    { to: u.router, data: encodeFunctionData({ abi: routerAbi, functionName: "multicall", args: [deadline, [swap, unwrap]] }) },
  ];
}

type SwapPlan = { kind: "uni-swap"; chain: UniChain; sell: "ETH" | "USDC"; buy: "ETH" | "USDC"; amountIn: string; minOut: string; fee: number; amount: number };
const swapTool: ToolDef = {
  name: "uniswap.swap", connector: "uniswap", risk: "sign", input: uIn,
  hint: 'uniswap.swap {"chain":"base","sell":"ETH","buy":"USDC","amount":0.01,"slippage":1} : prepare a Uniswap v3 swap from YOUR testnet wallet (ETH and test USDC); the person confirms it.',
  prepare: async (i: never, agent: AgentRef, limits: GrantLimits): Promise<Prepared> => {
    const p = i as UIn;
    const c = uniChain(p.chain), e = EVM[c];
    const { a, b } = sides(c, p.sell, p.buy);
    const slip = p.slippage ?? Math.min(limits.maxSlippageBps / 100, 1);
    if (slip * 100 > limits.maxSlippageBps) throw new Reject(`That's ${slip}% slippage, over your ${limits.maxSlippageBps / 100}% limit for Uniswap.`);
    const eth = await nativeUsd(c);
    const usd = a.sym === "USDC" ? p.amount : p.amount * eth;
    if (usd > limits.perTxUsd) throw new Reject(`That's about $${usd.toFixed(2)}, over your $${limits.perTxUsd} per trade limit for Uniswap.`);
    const addr = evmAddress(agent.userId, agent.slug);
    const bal = await evmBalances(c, addr);
    if (a.sym === "ETH" && p.amount >= bal.eth) throw new Reject(`My ${e.network} wallet holds ${+bal.eth.toFixed(6)} ETH and needs some left for the network fee.`);
    if (a.sym === "USDC" && p.amount > bal.usdc) throw new Reject(`My ${e.network} wallet only holds ${bal.usdc.toFixed(2)} test USDC.`);
    if (bal.eth <= 0) throw new Reject(`My ${e.network} wallet has no ETH for the network fee yet.`);
    const amountIn = parseUnits(String(p.amount), a.decimals);
    const q = await uniQuote(c, a, b, amountIn);
    const minOut = (q.out * BigInt(Math.round((100 - slip) * 100))) / BigInt(10000);
    const approve = a.sym === "USDC" && (await publicClient(c).readContract({ address: a.addr, abi: erc20Abi, functionName: "allowance", args: [addr as Hex, UNI[c].router] })) < amountIn;
    const sim = await simulateEvm(c, addr as Hex, swapCalls(c, a, b, addr as Hex, amountIn, minOut, q.fee, approve), [{ sym: "USDC", addr: EVM[c].usdc as Hex, decimals: 6 }]);
    return {
      title: `Swap ${p.amount} ${a.sym} for ${b.sym} on Uniswap`, chain: c, usdMicros: Math.round(usd * 1e6), summary: `Uniswap swap ${a.sym} to ${b.sym}`,
      rows: [["You pay", `${p.amount} ${a.sym}`], ["You get", `About ${fmtUnits(q.out, b.decimals)} ${b.sym}`], ["Minimum", `${fmtUnits(minOut, b.decimals)} ${b.sym} (${slip}% slippage)`], ["Pool", `Uniswap v3, ${q.fee / 10000}% fee`], ["Prices", "Testnet pool price, not a market price"], ["Wallet", `${addr.slice(0, 6)}…${addr.slice(-4)}`], ["Network", e.network], ...sim.rows],
      plan: { kind: "uni-swap", chain: c, sell: a.sym, buy: b.sym, amountIn: amountIn.toString(), minOut: minOut.toString(), fee: q.fee, amount: p.amount } satisfies SwapPlan,
    };
  },
  execute: async (pl: never, agent: AgentRef): Promise<Executed> => {
    const p = pl as SwapPlan;
    if (p.kind !== "uni-swap") throw new Reject("That swap can't run any more.");
    const c = p.chain, e = EVM[c], u = UNI[c];
    const { a, b } = sides(c, p.sell, p.buy);
    const w = walletClient(c, agent), pc = publicClient(c);
    const me = w.account.address;
    const amountIn = BigInt(p.amountIn), minOut = BigInt(p.minOut);
    const approve = a.sym === "USDC" && (await pc.readContract({ address: a.addr, abi: erc20Abi, functionName: "allowance", args: [me, u.router] })) < amountIn;
    const calls = swapCalls(c, a, b, me, amountIn, minOut, p.fee, approve);
    const main = calls[calls.length - 1];
    if (approve) {
      const ah = await w.sendTransaction({ to: calls[0].to, data: calls[0].data });
      const st = await sendAndWait(c, ah);
      if (!st.confirmed) throw new Reject(`Approving USDC for Uniswap didn't confirm (${e.txExplorer}${ah}). The swap was not sent.`);
    }
    const hash: Hex = await w.sendTransaction({ to: main.to, data: main.data, ...(main.value ? { value: main.value } : {}) });
    const st = await sendAndWait(c, hash);
    if (st.failed) throw new Reject(`The swap reverted on ${e.network}, most likely the price moved past your minimum (${e.txExplorer}${hash}). Only the network fee was spent.`);
    return { sig: hash, confirmed: st.confirmed, rows: [["Swapped", `${p.amount} ${a.sym} to ${b.sym}`], ["Explorer", `${e.txExplorer}${hash}`]], receipt: { amount: `${p.amount} ${a.sym}`, label: `Uniswap swap on ${e.network}`, url: `${e.txExplorer}${hash}` } };
  },
};

export const UNISWAP_TOOLS: ToolDef[] = [quoteTool, swapTool];
export type { EvmChain };
