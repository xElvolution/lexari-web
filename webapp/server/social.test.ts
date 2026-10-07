import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLinked } from "./social";
import { enabledSocials, socialStatus } from "@/lib/socialInfo";

test("reads X, Discord, Telegram and Solana wallets from Privy linked accounts", () => {
  const out = parseLinked([
    { type: "wallet", chain_type: "solana", address: "W1" },
    { type: "wallet", chain_type: "ethereum", address: "0xabc" },
    { type: "twitter_oauth", subject: "123", username: "elvis", lv: 1 },
    { type: "discord_oauth", subject: "456", username: "elv" },
    { type: "telegram", telegram_user_id: 789, username: "elv_tg" },
    { type: "google_oauth", subject: "g1", email: "a@b.c" },
  ]);
  assert.deepEqual(out.wallets, ["W1"]);
  assert.deepEqual(out.accounts, [
    { provider: "twitter", subject: "123", handle: "elvis" },
    { provider: "discord", subject: "456", handle: "elv" },
    { provider: "telegram", subject: "789", handle: "elv_tg" },
  ]);
});

test("ignores junk and accounts without an id", () => {
  assert.deepEqual(parseLinked("nope"), { wallets: [], accounts: [] });
  assert.deepEqual(parseLinked([null, 3, { type: "twitter_oauth", username: "x" }, { type: "telegram" }]).accounts, []);
  // only the first account per network counts
  assert.equal(parseLinked([{ type: "twitter_oauth", subject: "1" }, { type: "twitter_oauth", subject: "2" }]).accounts.length, 1);
});

test("one verified badge: a linked account on a paid plan", () => {
  assert.equal(socialStatus(0, false).badge, false);
  assert.equal(socialStatus(0, true).badge, false);
  assert.equal(socialStatus(1, false).badge, false); // Free with links: chips, no badge
  assert.match(socialStatus(1, false).note, /comes with Pro/);
  assert.equal(socialStatus(1, true).badge, true);
  assert.equal(socialStatus(3, true).label, "Verified");
  for (const n of [0, 1, 2, 3]) for (const paid of [false, true]) assert.doesNotMatch(JSON.stringify(socialStatus(n, paid)), /trusted|member/i);
});

test("Telegram stays off unless listed", () => {
  assert.deepEqual(enabledSocials(undefined), ["twitter", "discord"]);
  assert.deepEqual(enabledSocials("twitter, Telegram"), ["twitter", "telegram"]);
  assert.deepEqual(enabledSocials(""), ["twitter", "discord"]);
  assert.deepEqual(enabledSocials("none"), []);
});
