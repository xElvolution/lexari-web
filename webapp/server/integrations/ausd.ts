/**
 * Agora AUSD (https://agora.finance): hold and pay in AUSD, a fiat-backed dollar stablecoin, from the agent's own
 * Monad wallet.
 *   ausd.balance : AUSD and MON held by the agent on Monad testnet. Read only.
 *   ausd.faucet  : ask Agora's testnet faucet for test AUSD (one Confirm; the agent pays the gas in MON).
 *   ausd.pay     : pay someone in AUSD. One Confirm card.
 *   ausd.send    : a cross-border AUSD send: shows what the recipient gets in their local currency at today's rate,
 *                  then sends AUSD. One Confirm card. Nothing is ever signed without your Confirm.
 * Contracts from https://docs.agora.finance/developer/contract-deployments (Monad testnet).
 */
import { z } from "zod";
import { createPublicClient, createWalletClient, defineChain, encodeFunctionData, erc20Abi, formatUnits, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { evmAddress, evmKey } from "./evm";
import { MONAD, monBalance } from "./monad";
import { Reject } from "./reject";
import { simulateEvm } from "./evmsim";
import type { AgentRef, Executed, GrantLimits, Prepared, ReadResult, ToolDef } from "./registry";

export const AUSD = (process.env.AUSD_ADDRESS || "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC") as `0x${string}`;
const FAUCET = (process.env.AUSD_FAUCET || "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C") as `0x${string}`;
const DECIMALS = 6;
const chain = () => defineChain({ id: MONAD.chainId, name: MONAD.network, nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [MONAD.rpc()] } } });
const pub = () => createPublicClient({ chain: chain(), transport: http(MONAD.rpc(), { timeout: 10_000 }) });
const faucetAbi = [{ type: "function", name: "requestFunds", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }], outputs: [] }] as const;
const isAddr = (s: string): s is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(s);
const tx = (h: string) => `https://testnet.monadexplorer.com/tx/${h}`;

export async function ausdBalance(address: string) {
  const raw = await pub().readContract({ address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`] });
  return Number(formatUnits(raw, DECIMALS));
}
async function needGas(addr: string) {
  if ((await monBalance(addr)) <= 0) throw new Reject(`My Monad wallet (${addr}) has no MON for gas yet. Send it test MON first.`);
}
async function sendData(agent: AgentRef, to: `0x${string}`, data: `0x${string}`) {
  const account = privateKeyToAccount(`0x${Buffer.from(evmKey(agent.userId, agent.slug)).toString("hex")}`);
  const w = createWalletClient({ account, chain: chain(), transport: http(MONAD.rpc(), { timeout: 15_000 }) });
  await pub().call({ account: account.address, to, data }).catch((e: Error) => { throw new Reject(`That wouldn't go through (${e.message.slice(0, 100)}). Nothing was sent.`); });
  const hash = await w.sendTransaction({ to, data });
  const rc = await pub().waitForTransactionReceipt({ hash, timeout: 30_000 }).catch(() => null);
  return { hash, ok: rc ? rc.status === "success" : false };
}

/* FX for cross-border sends: a public USD reference rate, for display only. */
let fx: { at: number; rates: Record<string, number> } | null = null;
async function usdTo(cur: string) {
  if (!fx || Date.now() - fx.at > 3_600_000) {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) }).then((x) => x.json(), () => null) as { rates?: Record<string, number> } | null;
    if (r?.rates) fx = { at: Date.now(), rates: r.rates };
  }
  return fx?.rates[cur.toUpperCase()] ?? null;
}

const balanceTool: ToolDef = {
  name: "ausd.balance", connector: "agora", risk: "read", input: z.object({}).passthrough(),
  hint: "ausd.balance {} : how much Agora AUSD (and MON for gas) you hold on Monad testnet.",
  run: async (_i: never, agent: AgentRef): Promise<ReadResult> => {
    const a = evmAddress(agent.userId, agent.slug);
    const [ausd, mon] = await Promise.all([ausdBalance(a), monBalance(a)]);
    return { summary: "Checked its AUSD", text: `You hold ${ausd} AUSD (test) and ${+mon.toFixed(6)} MON for gas at ${a} on Monad testnet.` };
  },
};

type FaucetPlan = { kind: "ausd-faucet" };
const faucetTool: ToolDef = {
  name: "ausd.faucet", connector: "agora", risk: "sign", input: z.object({}).passthrough(),
  hint: "ausd.faucet {} : ask Agora's testnet faucet for test AUSD into your Monad wallet. The person confirms it (you pay gas in MON).",
  prepare: async (_i: never, agent: AgentRef): Promise<Prepared> => {
    const a = evmAddress(agent.userId, agent.slug);
    await needGas(a);
    const sim = await simulateEvm("monad", a as `0x${string}`, [{ to: FAUCET, data: encodeFunctionData({ abi: faucetAbi, functionName: "requestFunds", args: [a as `0x${string}`] }) }], [{ sym: "AUSD", addr: AUSD, decimals: DECIMALS }]);
    return { title: "Get test AUSD from Agora", chain: "monad", usdMicros: 0, summary: "Agora AUSD faucet", plan: { kind: "ausd-faucet" } satisfies FaucetPlan, rows: [["From", "Agora AUSD testnet faucet"], ["To", `${a.slice(0, 6)}…${a.slice(-4)}`], ["Network", MONAD.network], ["Cost", "A little test MON for gas"], ...sim.rows] };
  },
  execute: async (p: never, agent: AgentRef): Promise<Executed> => {
    if ((p as FaucetPlan).kind !== "ausd-faucet") throw new Reject("That can't run any more.");
    const a = evmAddress(agent.userId, agent.slug);
    const { hash, ok } = await sendData(agent, FAUCET, encodeFunctionData({ abi: faucetAbi, functionName: "requestFunds", args: [a as `0x${string}`] }));
    return { sig: hash, confirmed: ok, rows: [["Requested", "Test AUSD from Agora"], ["Explorer", tx(hash)]] };
  },
};

const payIn = z.object({ to: z.string().trim(), amount: z.coerce.number().positive(), note: z.string().max(120).optional() }).passthrough();
const sendIn = payIn.extend({ recipient: z.string().max(60).optional(), country: z.string().max(40).optional(), currency: z.string().trim().length(3).optional() });
type PayPlan = { kind: "ausd-pay"; to: `0x${string}`; amount: number; note?: string; local?: string };
async function preparePay(agent: AgentRef, limits: GrantLimits, to: string, amount: number, extra: [string, string][], title: string, summary: string, note?: string, local?: string): Promise<Prepared> {
  if (!isAddr(to)) throw new Reject("AUSD sends go to a Monad (EVM) address starting with 0x.");
  if (amount > limits.perTxUsd) throw new Reject(`That's $${amount.toFixed(2)}, over your $${limits.perTxUsd} per payment limit.`);
  const a = evmAddress(agent.userId, agent.slug);
  const have = await ausdBalance(a);
  if (have < amount) throw new Reject(`I only hold ${have} AUSD. Ask me to get test AUSD from the Agora faucet first.`);
  await needGas(a);
  const sim = await simulateEvm("monad", a as `0x${string}`, [{ to: AUSD, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, parseUnits(String(amount), DECIMALS)] }) }], [{ sym: "AUSD", addr: AUSD, decimals: DECIMALS }]);
  return { title, chain: "monad", usdMicros: Math.round(amount * 1e6), summary, plan: { kind: "ausd-pay", to, amount, note, local } satisfies PayPlan,
    rows: [["Pay", `${amount} AUSD`], ["To", `${to.slice(0, 6)}…${to.slice(-4)}`], ...extra, ...(note ? [["Note", note] as [string, string]] : []), ["Network", MONAD.network], ["From", `${a.slice(0, 6)}…${a.slice(-4)}`], ...sim.rows] };
}
async function executePay(p: never, agent: AgentRef): Promise<Executed> {
  const pl = p as PayPlan;
  if (pl.kind !== "ausd-pay") throw new Reject("That payment can't run any more.");
  const { hash, ok } = await sendData(agent, AUSD, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [pl.to, parseUnits(String(pl.amount), DECIMALS)] }));
  return { sig: hash, confirmed: ok, rows: [["Paid", `${pl.amount} AUSD`], ...(pl.local ? [["They get", pl.local] as [string, string]] : []), ["Explorer", tx(hash)]], receipt: { amount: `${pl.amount} AUSD`, label: "Agora AUSD", url: tx(hash) } };
}
const payTool: ToolDef = {
  name: "ausd.pay", connector: "agora", risk: "sign", input: payIn,
  hint: 'ausd.pay {"to":"0x...","amount":5,"note":"lunch"} : pay someone in Agora AUSD from your Monad wallet. The person confirms it.',
  prepare: async (i: never, agent: AgentRef, limits: GrantLimits) => { const p = i as z.infer<typeof payIn>; return preparePay(agent, limits, p.to, p.amount, [], `Pay ${p.amount} AUSD`, "AUSD payment", p.note); },
  execute: executePay,
};
const sendTool: ToolDef = {
  name: "ausd.send", connector: "agora", risk: "sign", input: sendIn,
  hint: 'ausd.send {"to":"0x...","amount":50,"recipient":"Ada","country":"Nigeria","currency":"NGN"} : a cross-border AUSD send. The card shows what they get in their currency at today\'s rate; the person confirms it.',
  prepare: async (i: never, agent: AgentRef, limits: GrantLimits) => {
    const p = i as z.infer<typeof sendIn>;
    const rate = p.currency ? await usdTo(p.currency) : null;
    const local = rate ? `About ${(p.amount * rate).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${p.currency!.toUpperCase()} (1 AUSD ≈ ${+rate.toFixed(4)} ${p.currency!.toUpperCase()})` : undefined;
    const extra: [string, string][] = [...(p.recipient ? [["Recipient", p.recipient] as [string, string]] : []), ...(p.country ? [["Country", p.country] as [string, string]] : []), ...(local ? [["They get", local] as [string, string]] : []), ["Fees", "Network gas only, no FX spread"], ["Arrives", "In seconds, any day"]];
    return preparePay(agent, limits, p.to, p.amount, extra, `Send ${p.amount} AUSD${p.country ? ` to ${p.country}` : ""}`, "Cross-border AUSD send", p.note, local);
  },
  execute: executePay,
};

export const AUSD_TOOLS: ToolDef[] = [balanceTool, faucetTool, payTool, sendTool];
