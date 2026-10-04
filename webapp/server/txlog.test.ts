import { test } from "node:test";
import assert from "node:assert/strict";
import { historyBlock, receiptText } from "./txlog";

const W = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const TO = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

test("receipt text", () => {
  assert.equal(receiptText({ id: "a", kind: "send", status: "confirmed", sol: 0.01, at: 0, to: TO }), "Sent 0.01 SOL to 9WzD…AWWM · confirmed");
  assert.equal(receiptText({ id: "a", kind: "incoming", status: "confirmed", sol: 0.5, at: 0, from: TO, label: "Lexari faucet" }), "Received 0.5 SOL from Lexari faucet · confirmed");
});

test("history block: today's totals count confirmed sends only", () => {
  const now = Date.now();
  const block = historyBlock({
    at: now, balance: 2.43, hired: [],
    lines: [
      { sig: "5".repeat(88), at: now - 60_000, dir: "out", sol: 0.01, counterparty: TO, kind: "send", status: "confirmed", wallet: W },
      { at: now - 30_000, dir: "out", sol: 0.2, counterparty: TO, kind: "send", status: "cancelled", wallet: W },
      { sig: "6".repeat(88), at: now - 3 * 86_400_000, dir: "out", sol: 0.05, counterparty: TO, status: "confirmed", wallet: W },
    ],
  }, W, "UTC");
  assert.match(block, /balance: 2\.43 SOL/);
  assert.match(block, /sent today 0\.01 SOL in 1 transaction;/);
  assert.match(block, /today .* sent 0\.01 SOL to 9WzD…AWWM · confirmed · send from chat/);
  assert.match(block, /cancelled/);
});
