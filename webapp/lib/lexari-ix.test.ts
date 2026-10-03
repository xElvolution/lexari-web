import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as L from "./lexari-ix";

// Anchor's own coder, from contracts/solana, checks the hand-written layouts against the IDL.
const require = createRequire(import.meta.url);
const anchor = require("../../contracts/solana/node_modules/@coral-xyz/anchor");
const idl = require("../../contracts/solana/idl/lexari.json");
const accounts = new anchor.BorshAccountsCoder(idl);
const ixCoder = new anchor.BorshInstructionCoder(idl);
const BN = anchor.BN;
const pk = () => Keypair.generate().publicKey;

test("discriminators match the IDL", () => {
  for (const i of idl.instructions) assert.deepEqual([...L.IX[i.name as L.IxName]], i.discriminator, i.name);
  for (const a of idl.accounts) assert.deepEqual([...L.ACCOUNT[a.name as keyof typeof L.ACCOUNT] ?? a.discriminator], a.discriminator, a.name);
});

test("player decoder, with and without a referrer", async () => {
  const owner = pk(), ref = pk();
  for (const referrer of [null, ref]) {
    const data = await accounts.encode("Player", { owner, coins: new BN(1234), streak: 6, last_check_in: new BN(1_790_000_000), referrer, lifetime: new BN(99_999), bump: 254 });
    const p = L.decodePlayer(data)!;
    assert.equal(p.owner, owner.toBase58());
    assert.equal(p.coins, 1234);
    assert.equal(p.streak, 6);
    assert.equal(p.lastCheckIn, 1_790_000_000);
    assert.equal(p.referrer, referrer ? ref.toBase58() : null);
    assert.equal(p.lifetime, 99_999);
  }
});

test("agent, level, config and memory decoders", async () => {
  const owner = pk(), asset = pk(), agent = pk();
  const a = L.decodeAgent(await accounts.encode("Agent", { owner, asset, name: "Juniper", role: "Chief", dna: "shape=round", bump: 1 }))!;
  assert.deepEqual(a, { owner: owner.toBase58(), asset: asset.toBase58(), name: "Juniper", role: "Chief", dna: "shape=round" });
  const lv = L.decodeLevel(await accounts.encode("AgentLevel", { agent, owner, level: 7, xp: 123, bump: 1 }))!;
  assert.deepEqual(lv, { agent: agent.toBase58(), owner: owner.toBase58(), level: 7, xp: 123 });
  assert.equal(L.decodeConfig(await accounts.encode("Config", { authority: owner, bump: 1 }))!.authority, owner.toBase58());
  const hash = Array.from({ length: 32 }, (_, i) => i);
  const m = L.decodeMemory(await accounts.encode("Memory", { owner, agent, content_hash: hash, uri: "ar://x", revoked: true, bump: 1 }))!;
  assert.equal(m.contentHash, Buffer.from(hash).toString("hex"));
  assert.equal(m.uri, "ar://x");
  assert.equal(m.revoked, true);
  assert.equal(L.decodePlayer(new Uint8Array(100)), null);
});

test("instruction data matches Anchor's encoder and parses back", () => {
  const owner = pk(), asset = pk(), att = pk();
  const cases: [string, Record<string, unknown>, ReturnType<typeof L.claimQuestIx>][] = [
    ["claim_quest", { quest_id: 101, period: 202640, coins: new BN(120) }, L.claimQuestIx(owner, att, 101, 202640, 120)],
    ["open_box", { day: 20365, coins: new BN(60) }, L.openBoxIx(owner, att, 20365, 60)],
    ["level_up", { coins: new BN(500) }, L.levelUpIx(owner, asset, 500)],
    ["claim_referral_tier", { tier: 2 }, L.claimTierIx(owner, att, 2)],
    ["register_agent", { name: "Ada", role: "R", dna: "d" }, L.registerAgentIx(owner, asset, "Ada", "R", "d")],
    ["write_memory", { content_hash: Array(32).fill(7), uri: "ar://m" }, L.writeMemoryIx(owner, asset, new Uint8Array(32).fill(7), "ar://m")],
  ];
  for (const [name, args, built] of cases) {
    assert.deepEqual(Buffer.from(built.data), Buffer.from(ixCoder.encode(name, args)), name);
    const idlIx = idl.instructions.find((i: { name: string }) => i.name === name);
    assert.equal(built.keys.length, idlIx.accounts.length, `${name} account count`);
    const parsed = L.parseLexariIx(built.data, built.keys.map((k) => k.pubkey.toBase58()));
    assert.equal(parsed?.name, name);
  }
  const p = L.parseLexariIx(L.claimQuestIx(owner, att, 7, 9, 11).data, []);
  assert.deepEqual(p && "args" in p ? p.args : null, { questId: 7, period: 9, coins: 11 });
});

test("signer and writable flags follow the IDL", () => {
  const owner = pk(), asset = pk(), att = pk();
  const built = { claim_quest: L.claimQuestIx(owner, att, 1, 1, 1), level_up: L.levelUpIx(owner, asset, 1), init_player: L.initPlayerIx(owner), check_in: L.checkInIx(owner), update_agent: L.updateAgentIx(owner, asset, "a", "", "d"), sync_agent_owner: L.syncAgentOwnerIx(owner, asset) };
  for (const [name, b] of Object.entries(built)) {
    const idlIx = idl.instructions.find((i: { name: string }) => i.name === name);
    idlIx.accounts.forEach((a: { name: string; signer?: boolean; writable?: boolean }, i: number) => {
      assert.equal(b.keys[i].isSigner, !!a.signer, `${name}.${a.name} signer`);
      assert.equal(b.keys[i].isWritable, !!a.writable, `${name}.${a.name} writable`);
    });
  }
});

test("Core asset owner", () => {
  const owner = pk();
  const data = new Uint8Array(100); data[0] = 1; data.set(owner.toBytes(), 1);
  assert.equal(L.coreAssetOwner(L.MPL_CORE_ID, data), owner.toBase58());
  assert.equal(L.coreAssetOwner(new PublicKey(L.PROGRAM_ID), data), null);
  data[0] = 2;
  assert.equal(L.coreAssetOwner(L.MPL_CORE_ID, data), null);
});
