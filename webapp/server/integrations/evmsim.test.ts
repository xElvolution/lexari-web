import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeErrorResult, type Hex } from "viem";
import { nativeFromLogs, revertReason, simRows } from "./evmsim";

const pad = (a: string) => `0x${a.toLowerCase().replace(/^0x/, "").padStart(64, "0")}` as Hex;
const ME = "0x1111111111111111111111111111111111111111" as Hex, OTHER = "0x2222222222222222222222222222222222222222" as Hex;
const T = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as Hex;
const log = (from: Hex, to: Hex, wei: bigint) => ({ address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", topics: [T, pad(from), pad(to)], data: `0x${wei.toString(16)}` as Hex });

test("native coin change from traced transfers: out minus in, null when untraced", () => {
  const res = [{ status: "0x1", returnData: "0x" as Hex, gasUsed: "0x1", logs: [log(ME, OTHER, BigInt(10)), log(OTHER, ME, BigInt(3))] }];
  assert.equal(nativeFromLogs(res, ME), BigInt(-7));
  assert.equal(nativeFromLogs([{ status: "0x1", returnData: "0x", gasUsed: "0x1" }], ME), null);
});

test("revert reasons: Error(string) decoded, otherwise the node's message", () => {
  const data = encodeErrorResult({ abi: [{ type: "error", name: "Error", inputs: [{ name: "m", type: "string" }] }], errorName: "Error", args: ["Too little received"] });
  assert.equal(revertReason({ returnData: data }), "Too little received");
  assert.equal(revertReason({ error: { message: "execution reverted: STF" } }), "STF");
  assert.equal(revertReason({}), "reverted");
});

test("card rows: signed amounts, the block, and the fee in the native coin", () => {
  const rows = simRows("base", { mode: "simulated", block: 42, gasUsed: BigInt(21000), feeWei: BigInt(21000) * BigInt(1e9), diffs: [{ sym: "ETH", delta: -0.001 }, { sym: "USDC", delta: 2.5 }] });
  assert.deepEqual(rows, [["Simulated", "Passed on Base Sepolia (block 42)"], ["Your ETH", "−0.001 ETH"], ["Your USDC", "+2.5 USDC"], ["Network fee", "About 0.000021 ETH"]]);
  assert.match(simRows("monad", { mode: "checked", block: 1, gasUsed: BigInt(0), feeWei: BigInt(0), diffs: [] })[0][1], /basic check on Monad testnet/);
});
