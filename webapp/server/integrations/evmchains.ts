/**
 * Agent wallets and sends on the EVM chains of this build's network mode (lib/network.ts). Testnet: Base Sepolia,
 * Ethereum Sepolia, Arbitrum Sepolia, Robinhood Chain testnet and Monad testnet. Mainnet: Base, Ethereum, Arbitrum
 * One and Monad. One address per agent works on all of them (evm.ts). Reads are free; a send is a sign tool: it
 * only prepares a Confirm card, and Lexari signs it from the agent's key after the person confirms.
 *
 * To fund one of these wallets from the person's USD balance on a mainnet, the agent uses intents.route (Aurora
 * Intents).
 */
import { z } from "zod";
import { createPublicClient, createWalletClient, defineChain, encodeFunctionData, erc20Abi, formatUnits, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EVM, evmAddress, evmBalances, evmKey, type EvmChain } from "./evm";
import { spotUsd } from "./market";
import { Reject } from "./reject";
import type { AgentRef, Executed, GrantLimits, Prepared, ToolDef } from "./registry";

const isAddr = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
export function viemChain(c: EvmChain) {
  const e = EVM[c];
  if (!e.available) throw new Reject(`${e.name} is not available on this Lexari network.`);
  return defineChain({ id: e.chainId, name: e.network, nativeCurrency: { name: e.native, symbol: e.native, decimals: 18 }, rpcUrls: { default: { http: [e.rpc()] } }, testnet: e.testnet });
}
export const publicClient = (c: EvmChain) => createPublicClient({ chain: viemChain(c), transport: http(EVM[c].rpc(), { timeout: 15_000, retryCount: 2 }) });
export function walletClient(c: EvmChain, agent: AgentRef) {
  const account = privateKeyToAccount(`0x${Buffer.from(evmKey(agent.userId, agent.slug)).toString("hex")}` as Hex);
  return createWalletClient({ account, chain: viemChain(c), transport: http(EVM[c].rpc(), { timeout: 20_000, retryCount: 2 }) });
}

/** USD value of a native coin, for the limits. Testnet coins are priced at their mainnet price (or ETH's). */
export async function nativeUsd(c: EvmChain) {
  const sym = EVM[c].native;
  try { return await spotUsd(sym); } catch { throw new Reject(`I couldn't get a live ${sym} price to check your limits, so nothing was prepared. Try again in a moment.`); }
}

/** Waits for the receipt (up to about a minute), so the card shows the real outcome. */
export async function sendAndWait(c: EvmChain, hash: Hex): Promise<{ confirmed: boolean; failed: boolean }> {
  try {
    const rc = await publicClient(c).waitForTransactionReceipt({ hash, timeout: 60_000 });
    return { confirmed: rc.status === "success", failed: rc.status !== "success" };
  } catch { return { confirmed: false, failed: false }; }
}
/** For settle(): a sent transaction's state on chain. */
export async function evmTxState(c: EvmChain, hash: string): Promise<"confirmed" | "failed" | "pending"> {
  const rc = await publicClient(c).getTransactionReceipt({ hash: hash as Hex }).catch(() => null);
  if (!rc) return "pending";
  return rc.status === "success" ? "confirmed" : "failed";
}

function walletTool(c: EvmChain): ToolDef {
  const e = EVM[c];
  return {
    name: `${c}.wallet`, connector: c, risk: "read", input: z.object({}).passthrough(),
    hint: `${c}.wallet {} : your own ${e.name} address and its ${e.network} balances (${e.native}${e.usdc ? " and test USDC" : ""}).`,
    run: async (_i: never, agent: AgentRef) => {
      const address = evmAddress(agent.userId, agent.slug);
      const [b, px] = await Promise.all([evmBalances(c, address), spotUsd(e.native).catch(() => 0)]);
      return { summary: `Checked its ${e.name} wallet`, text: `Your ${e.name} address: ${address} (the same address works on every EVM chain). On ${e.network} it holds ${+b.eth.toFixed(6)} test ${e.native}${e.usdc ? ` and ${b.usdc.toFixed(2)} test USDC` : ""}. Test coins have no real value.${px ? ` Live ${e.native} price: $${px.toFixed(2)}.` : ""} Explorer: ${e.explorer}${address}` };
    },
  };
}

type SendPlan = { kind: "evm-send"; chain: EvmChain; to: string; asset: string; atoms: string; amount: number };
const sendIn = z.object({ to: z.string().trim(), asset: z.string().trim().default("native"), amount: z.coerce.number().positive() }).passthrough();
function sendTool(c: EvmChain): ToolDef {
  const e = EVM[c];
  return {
    name: `${c}.transfer`, connector: c, risk: "sign", input: sendIn,
    hint: `${c}.transfer {"to":"0x...","asset":"${e.native}"${e.usdc ? ` or "USDC"` : ""},"amount":0.01} : prepare a send from YOUR ${e.network} wallet; the person confirms it. "to":"me" sends to the person's own linked EVM wallet.`,
    prepare: async (i: never, agent: AgentRef, limits: GrantLimits): Promise<Prepared> => {
      const p = i as z.infer<typeof sendIn>;
      if (!isAddr(p.to)) throw new Reject("That isn't a valid EVM address (0x followed by 40 hex characters).");
      const from = evmAddress(agent.userId, agent.slug);
      if (p.to.toLowerCase() === from.toLowerCase()) throw new Reject("That's my own wallet.");
      const sym = p.asset.toUpperCase().replace(/^TEST/, "");
      const isUsdc = sym === "USDC";
      if (!isUsdc && !["NATIVE", e.native].includes(sym)) throw new Reject(`On ${e.network} I send ${e.native}${e.usdc ? " or test USDC" : ""}.`);
      if (isUsdc && !e.usdc) throw new Reject(`There's no test USDC I can send on ${e.network}; I can send ${e.native}.`);
      const usd = isUsdc ? p.amount : p.amount * (await nativeUsd(c));
      if (usd > limits.perTxUsd) throw new Reject(`That's about $${usd.toFixed(2)}, over your $${limits.perTxUsd} per trade limit for ${e.name}.`);
      const b = await evmBalances(c, from).catch(() => { throw new Reject(`${e.network} didn't answer. Try again in a moment.`); });
      if (isUsdc && p.amount > b.usdc) throw new Reject(`My ${e.network} wallet only holds ${b.usdc.toFixed(2)} test USDC.`);
      if (!isUsdc && p.amount >= b.eth) throw new Reject(`My ${e.network} wallet holds ${+b.eth.toFixed(6)} ${e.native}, and it needs a little left for the network fee.`);
      if (isUsdc && b.eth <= 0) throw new Reject(`My ${e.network} wallet has no ${e.native} for the network fee. Send it a little test ${e.native} first.`);
      const atoms = parseUnits(String(p.amount), isUsdc ? 6 : 18).toString();
      const asset = isUsdc ? "USDC" : e.native;
      return {
        title: `Send ${p.amount} ${asset} on ${e.name}`, chain: c, usdMicros: Math.round(usd * 1e6), summary: `Send ${p.amount} ${asset} on ${e.name}`,
        rows: [["Send", `${p.amount} test ${asset}`], ["Value", isUsdc ? `$${usd.toFixed(2)}` : `About $${usd.toFixed(2)} at the ${e.native} price`], ["To", `${p.to.slice(0, 6)}…${p.to.slice(-4)}`], ["From", `${agent.name}'s wallet`], ["Network", e.network]],
        plan: { kind: "evm-send", chain: c, to: p.to, asset, atoms, amount: p.amount } satisfies SendPlan,
      };
    },
    execute: async (pl: never, agent: AgentRef): Promise<Executed> => {
      const p = pl as SendPlan;
      if (p.kind !== "evm-send" || p.chain !== c) throw new Reject("That send can't run any more.");
      const w = walletClient(c, agent);
      const hash = p.asset === "USDC"
        ? await w.sendTransaction({ to: e.usdc as Hex, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [p.to as Hex, BigInt(p.atoms)] }) })
        : await w.sendTransaction({ to: p.to as Hex, value: BigInt(p.atoms) });
      const st = await sendAndWait(c, hash);
      if (st.failed) throw new Reject(`The send reverted on ${e.network} (${e.txExplorer}${hash}).`);
      return { sig: hash, confirmed: st.confirmed, rows: [["Sent", `${p.amount} ${p.asset}`], ["Explorer", `${e.txExplorer}${hash}`]], receipt: { amount: `${p.amount} ${p.asset}`, label: `Sent on ${e.network}`, url: `${e.txExplorer}${hash}` } };
    },
  };
}

export const fmtUnits = (v: bigint, d: number) => +Number(formatUnits(v, d)).toFixed(6);
export const EVMCHAIN_TOOLS: ToolDef[] = [
  walletTool("base"), sendTool("base"),
  walletTool("ethereum"), sendTool("ethereum"),
  walletTool("arbitrum"), sendTool("arbitrum"),
  walletTool("robinhood"), sendTool("robinhood"),
  sendTool("monad"),
];
