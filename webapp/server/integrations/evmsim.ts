/**
 * Simulation before a Confirm card: every EVM sign tool runs its exact calls through eth_simulateV1 against the latest
 * block, from the agent's own address, with balanceOf reads before and after in the same simulated block. The card
 * then shows the balance change the person will see (tokens from the simulation, the native coin as value plus gas).
 * A call that would revert never becomes a card. Nodes without eth_simulateV1 get a plain eth_call check instead,
 * and the card says the change is estimated from the quote.
 */
import { decodeErrorResult, encodeFunctionData, erc20Abi, formatUnits, type Hex } from "viem";
import { EVM, rpc, type EvmChain } from "./evm";
import { Reject } from "./reject";

export type SimCall = { to: Hex; data?: Hex; value?: bigint };
export type SimToken = { sym: string; addr: Hex; decimals: number };
export type SimResult = { mode: "simulated" | "checked"; block: number; gasUsed: bigint; feeWei: bigint; diffs: { sym: string; delta: number }[]; rows: [string, string][] };

const hexOf = (n: bigint) => `0x${n.toString(16)}` as Hex;
const balData = (who: Hex) => encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [who] });
type CallRes = { status: string; returnData: Hex; gasUsed: string; logs?: { address: string; topics: Hex[]; data: Hex }[]; error?: { message?: string; data?: Hex } };
/** eth_simulateV1 traceTransfers reports native coin moves as ERC-20 Transfer logs from this address. */
const NATIVE_LOG = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
/** The native coin in and out of `who` across the simulated calls, or null when the node didn't trace transfers. */
export function nativeFromLogs(res: CallRes[], who: Hex): bigint | null {
  const me = who.toLowerCase().slice(2).padStart(64, "0");
  let seen = false, net = BigInt(0);
  for (const r of res) for (const l of r.logs || []) {
    if (l.address.toLowerCase() !== NATIVE_LOG || l.topics[0]?.toLowerCase() !== TRANSFER) continue;
    seen = true;
    const amt = BigInt(l.data);
    if (l.topics[1]?.toLowerCase().endsWith(me)) net -= amt;
    if (l.topics[2]?.toLowerCase().endsWith(me)) net += amt;
  }
  return seen ? net : null;
}

/** A short reason from a revert ("ERC20: transfer amount exceeds balance", "Too little received"...). */
export function revertReason(r: { returnData?: Hex; error?: { message?: string; data?: Hex } }): string {
  const data = r.error?.data || r.returnData;
  if (data && data.length > 10) {
    try {
      const d = decodeErrorResult({ abi: [{ type: "error", name: "Error", inputs: [{ name: "m", type: "string" }] }], data });
      return String(d.args?.[0] ?? "").slice(0, 120) || "reverted";
    } catch { /* not a string revert */ }
  }
  return (r.error?.message || "reverted").replace(/^execution reverted:?\s*/i, "").slice(0, 120) || "reverted";
}

const fmt = (sym: string, delta: number) => `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${+Math.abs(delta).toFixed(6)} ${sym}`;

/** The rows a Confirm card shows for a simulation. Exported for tests. */
export function simRows(c: EvmChain, r: Omit<SimResult, "rows">): [string, string][] {
  const e = EVM[c];
  const rows: [string, string][] = [["Simulated", r.mode === "simulated" ? `Passed on ${e.network} (block ${r.block})` : `Passed a basic check on ${e.network}; change estimated from the quote`]];
  for (const d of r.diffs) rows.push([`Your ${d.sym}`, fmt(d.sym, d.delta)]);
  rows.push(["Network fee", `About ${+Number(formatUnits(r.feeWei, 18)).toFixed(6)} ${e.native}`]);
  return rows;
}

/**
 * Simulates calls from `from` in order. `tokens` are the ERC-20s whose balance change to show. Throws Reject when a
 * call would revert, so no card is made for a transaction that can't go through.
 */
export async function simulateEvm(c: EvmChain, from: Hex, calls: SimCall[], tokens: SimToken[]): Promise<SimResult> {
  const e = EVM[c];
  const gasPrice = BigInt(await rpc<string>(c, "eth_gasPrice", []));
  const reads = tokens.map((t) => ({ from, to: t.addr, data: balData(from) }));
  const body = [...reads, ...calls.map((x) => ({ from, to: x.to, ...(x.data ? { data: x.data } : {}), ...(x.value ? { value: hexOf(x.value) } : {}) })), ...reads];
  let blocks: { number: string; calls: CallRes[] }[] | null = null;
  try {
    blocks = await rpc<{ number: string; calls: CallRes[] }[]>(c, "eth_simulateV1", [{ blockStateCalls: [{ calls: body }], validation: false, traceTransfers: true }, "latest"]);
  } catch (err) {
    if (!/not (found|supported|available)|does not exist|unknown method|method not|-32601/i.test((err as Error).message)) throw new Reject(`I couldn't simulate this on ${e.network} right now (${(err as Error).message.slice(0, 80)}), so nothing was prepared.`);
  }
  const value = calls.reduce((n, x) => n + (x.value ?? BigInt(0)), BigInt(0));
  if (blocks?.[0]?.calls) {
    const res = blocks[0].calls;
    const mid = res.slice(reads.length, reads.length + calls.length);
    const bad = mid.findIndex((r) => r.status !== "0x1");
    if (bad >= 0) throw new Reject(`The simulation says this would fail on ${e.network} (${revertReason(mid[bad])}), so nothing was prepared and nothing was sent.`);
    const gasUsed = mid.reduce((n, r) => n + BigInt(r.gasUsed), BigInt(0));
    const feeWei = gasUsed * gasPrice;
    const num = (r: CallRes) => (r.returnData && r.returnData !== "0x" ? BigInt(r.returnData) : BigInt(0));
    const diffs = tokens.map((t, i) => ({ sym: t.sym, delta: Number(formatUnits(num(res[reads.length + calls.length + i]) - num(res[i]), t.decimals)) }));
    const nativeDelta = nativeFromLogs(mid, from) ?? -value;
    const all = [...(nativeDelta !== BigInt(0) ? [{ sym: e.native, delta: Number(formatUnits(nativeDelta, 18)) }] : []), ...diffs.filter((d) => d.delta !== 0)];
    const r = { mode: "simulated" as const, block: Number(BigInt(blocks[0].number)), gasUsed, feeWei, diffs: all };
    return { ...r, rows: simRows(c, r) };
  }
  // Fallback: each call on its own (later calls that depend on earlier ones, like approve then swap, are only gas-estimated after the first).
  let gasUsed = BigInt(0);
  for (const [i, x] of calls.entries()) {
    const tx = { from, to: x.to, ...(x.data ? { data: x.data } : {}), ...(x.value ? { value: hexOf(x.value) } : {}) };
    try {
      await rpc<string>(c, "eth_call", [tx, "latest"]);
      gasUsed += BigInt(await rpc<string>(c, "eth_estimateGas", [tx, "latest"]));
    } catch (err) {
      if (i === 0) throw new Reject(`The check says this would fail on ${e.network} (${(err as Error).message.replace(/^execution reverted:?\s*/i, "").slice(0, 100)}), so nothing was prepared.`);
      gasUsed += BigInt(200_000);
    }
  }
  const block = Number(BigInt(await rpc<string>(c, "eth_blockNumber", [])));
  const r = { mode: "checked" as const, block, gasUsed, feeWei: gasUsed * gasPrice, diffs: value ? [{ sym: e.native, delta: -Number(formatUnits(value, 18)) }] : [] };
  return { ...r, rows: simRows(c, r) };
}
