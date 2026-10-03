/**
 * End-to-end API tests. Run with `npm run test:api` (scripts/test-api.sh starts the server,
 * Postgres and a local validator). Every call is real HTTP; every transaction is real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, publicKey as umiPk } from "@metaplex-foundation/umi";
import { create, mplCore, transferV1 } from "@metaplex-foundation/mpl-core";
import { checkInIx, initPlayerIx, levelUpIx, playerPda, registerAgentIx } from "../lib/lexari-ix";

const BASE = process.env.API_BASE!;
const RPC = process.env.SOLANA_RPC!;
const TREASURY = new PublicKey(process.env.LEXARI_TREASURY!);
const conn = new Connection(RPC, "confirmed");

type Client = { kp: Keypair; cookie: string; code?: string };
const clients: Record<string, Client> = {};

async function call(path: string, init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const res = await fetch(BASE + path, {
    method: init.method || (init.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(init.cookie ? { cookie: init.cookie } : {}), ...init.headers },
    body: init.body ? JSON.stringify(init.body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}

async function fund(pk: PublicKey, sol = 2) {
  const sig = await conn.requestAirdrop(pk, sol * LAMPORTS_PER_SOL);
  await conn.confirmTransaction(sig, "confirmed");
}

async function signIn(kp: Keypair, referral?: string, headers?: Record<string, string>) {
  const wallet = kp.publicKey.toBase58();
  const n = await call("/api/auth/nonce", { body: { wallet }, headers });
  assert.equal(n.status, 200, JSON.stringify(n.json));
  const signature = Buffer.from(nacl.sign.detached(new TextEncoder().encode(n.json.message), kp.secretKey)).toString("base64");
  const v = await call("/api/auth/verify", { body: { wallet, message: n.json.message, signature, ...(referral ? { referral } : {}) } });
  assert.equal(v.status, 200, JSON.stringify(v.json));
  const cookie = (v.headers.get("set-cookie") || "").split(";")[0];
  assert.match(cookie, /^lexari_session=/);
  return { cookie, code: v.json.referralCode as string, message: n.json.message as string, signature };
}

async function send(kp: Keypair, ixs: TransactionInstruction[]) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = kp.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(kp);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}

async function claim(c: Client, body: unknown) {
  const r = await call("/api/hub/claim", { body, cookie: c.cookie });
  if (r.status !== 200) return { status: r.status, json: r.json };
  const tx = Transaction.from(Buffer.from(r.json.tx, "base64"));
  tx.partialSign(c.kp);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  const done = await call("/api/hub/confirm", { body: { signature: sig }, cookie: c.cookie });
  return { status: done.status, json: done.json, coins: r.json.coins as number, sig };
}

async function chat(c: Client, body: Record<string, unknown>) {
  const res = await fetch(BASE + "/api/chat", { method: "POST", headers: { "content-type": "application/json", cookie: c.cookie }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.headers.get("content-type")?.includes("event-stream")) return { status: res.status, events: [] as any[], body: text };
  const events = text.split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
  return { status: res.status, events, body: text };
}

test("health reports readiness without secrets", async () => {
  const r = await call("/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.json.database, true);
  assert.equal(r.json.program, true);
  assert.equal(r.json.attestor, true);
  assert.equal(r.json.llm.ready, true);
  assert.ok(!JSON.stringify(r.json).includes("postgres://"));
});

test("everything needs a session", async () => {
  for (const [path, method] of [["/api/me", "GET"], ["/api/account", "GET"], ["/api/hub/state", "GET"], ["/api/agents", "GET"]] as const) {
    const r = await call(path, { method });
    assert.equal(r.status, 401, path);
  }
  const c = await fetch(BASE + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(c.status, 401);
});

test("sign in with a wallet; messages are bound to the configured origin", async () => {
  const kp = Keypair.generate();
  await fund(kp.publicKey);
  // A spoofed Host header must not change the domain in the sign-in message.
  const s = await signIn(kp, undefined, { host: "evil.example", "x-forwarded-host": "evil.example" });
  assert.ok(s.message.startsWith(new URL(BASE).host + " wants you to sign in"), s.message.split("\n")[0]);
  clients.a = { kp, cookie: s.cookie, code: s.code };
  const me = await call("/api/me", { cookie: s.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.wallet, kp.publicKey.toBase58());
  // The same signed message cannot be used twice.
  const replay = await call("/api/auth/verify", { body: { wallet: kp.publicKey.toBase58(), message: s.message, signature: s.signature } });
  assert.ok([400, 401].includes(replay.status), String(replay.status));
});

test("a bad signature is refused", async () => {
  const kp = Keypair.generate();
  const other = Keypair.generate();
  const n = await call("/api/auth/nonce", { body: { wallet: kp.publicKey.toBase58() } });
  const sig = Buffer.from(nacl.sign.detached(new TextEncoder().encode(n.json.message), other.secretKey)).toString("base64");
  const v = await call("/api/auth/verify", { body: { wallet: kp.publicKey.toBase58(), message: n.json.message, signature: sig } });
  assert.equal(v.status, 401);
  const bad = await call("/api/auth/nonce", { body: { wallet: "not-a-wallet-not-a-wallet-not-a-wallet" } });
  assert.equal(bad.status, 400);
});

test("referrals only apply to a new account", async () => {
  const kp = Keypair.generate();
  await fund(kp.publicKey);
  const s = await signIn(kp, clients.a.code);
  clients.b = { kp, cookie: s.cookie, code: s.code };
  // Signing in again with a different code does nothing.
  await signIn(kp, "ZZZZZZ");
  const me = await call("/api/me", { cookie: s.cookie });
  assert.equal(me.status, 200);
});

test("agents: create home, custom slug rules, 403 for a stranger agent in chat", async () => {
  const a = clients.a;
  let r = await call("/api/agents", { body: { slug: "home", name: "Ada", role: "Helper", tone: "warm", meta: { you: "boss" } }, cookie: a.cookie });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call("/api/agents", { body: { slug: "bad slug!", name: "X" }, cookie: a.cookie });
  assert.equal(r.status, 400);
  r = await call("/api/agents", { body: { slug: "c-writer", kind: "custom", name: "Wren", role: "Writer", about: "Writes release notes." }, cookie: a.cookie });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call("/api/agents", { body: { slug: "home", name: "Ada", asset: "11111111111111111111111111111111" }, cookie: a.cookie });
  assert.equal(r.status, 400, "the client can never set an asset");
  const me = await call("/api/me", { cookie: a.cookie });
  assert.deepEqual(me.json.agents.map((x: any) => x.slug).sort(), ["c-writer", "home"]);
  const c = await chat(a, { convo: "scout", text: "hello there", speaker: "scout", userMsgId: "u-001", replyMsgId: "r-001" });
  assert.equal(c.status, 403, c.body);
});

test("chat streams, saves both messages and makes a job", async () => {
  const a = clients.a;
  const c = await chat(a, { convo: "c-writer", text: "Draft the release notes for v2", speaker: "c-writer", userMsgId: "u-10", replyMsgId: "r-10" });
  assert.equal(c.status, 200, c.body);
  assert.equal(c.events.map((e) => e.token || "").join(""), "Hi from the test model.");
  assert.ok(c.events.some((e) => e.done));
  const acct = await call("/api/account", { cookie: a.cookie });
  const convo = acct.json.chats.find((x: any) => x.slug === "c-writer");
  assert.ok(convo, "chat saved");
  assert.deepEqual(convo.messages.map((m: any) => m.id), ["u-10", "r-10"]);
  assert.equal(acct.json.jobs.length, 1);
  assert.equal(acct.json.jobs[0].output, "Hi from the test model.");
  // Same client ids again: no duplicate rows.
  await chat(a, { convo: "c-writer", text: "Draft the release notes for v2", speaker: "c-writer", userMsgId: "u-10", replyMsgId: "r-10" });
  const again = await call("/api/account", { cookie: a.cookie });
  assert.equal(again.json.chats.find((x: any) => x.slug === "c-writer").messages.length, 2);
});

test("chat is rate limited per account", async () => {
  const a = clients.a;
  let limited = false;
  for (let i = 0; i < 8; i++) {
    const c = await chat(a, { convo: "home", text: `hi ${i}`, speaker: "home", userMsgId: `u-rl-${i}`, replyMsgId: `r-rl-${i}` });
    if (c.status === 429) { limited = true; break; }
  }
  assert.ok(limited, "429 after CHAT_PER_MINUTE");
});

test("memories: save, dedupe, ownership and bad ids", async () => {
  const a = clients.a, b = clients.b;
  const body = { agentSlug: "home", tag: "pref", ciphertext: "Y2lwaGVydGV4dA==", iv: "aXZpdml2aXZp", contentHash: "a".repeat(64) };
  const one = await call("/api/memories", { body, cookie: a.cookie });
  assert.equal(one.status, 200, JSON.stringify(one.json));
  const two = await call("/api/memories", { body, cookie: a.cookie });
  assert.equal(two.status, 200);
  const acct = await call("/api/account", { cookie: a.cookie });
  assert.equal(acct.json.memories.length, 1, "same hash saved once");
  const id = acct.json.memories[0].id;
  assert.equal((await call("/api/memories/not-a-uuid", { method: "DELETE", cookie: a.cookie })).status, 400);
  assert.equal((await call(`/api/memories/${id}`, { method: "DELETE", cookie: b.cookie })).status, 404);
  assert.equal((await call(`/api/memories/${id}`, { method: "DELETE", cookie: a.cookie })).status, 200);
});

test("hub: check in onchain, confirm, claim the quest once", async () => {
  const a = clients.a;
  let st = await call("/api/hub/state", { cookie: a.cookie });
  assert.equal(st.status, 200, JSON.stringify(st.json));
  assert.equal(st.json.player, null);
  const sig = await send(a.kp, [initPlayerIx(a.kp.publicKey, null), checkInIx(a.kp.publicKey)]);
  const conf = await call("/api/hub/confirm", { body: { signature: sig }, cookie: a.cookie });
  assert.equal(conf.status, 200, JSON.stringify(conf.json));
  assert.deepEqual(conf.json.recorded, ["init_player", "check_in"]);
  assert.equal(conf.json.state.player.checkedInToday, true);
  assert.equal(conf.json.state.player.coins, 10);
  const q = conf.json.state.quests.find((x: any) => x.id === "d-checkin");
  assert.equal(q.progress, 1);
  // Confirming twice records nothing new.
  const again = await call("/api/hub/confirm", { body: { signature: sig }, cookie: a.cookie });
  assert.deepEqual(again.json.recorded, []);
  // Someone else cannot claim this transaction.
  const steal = await call("/api/hub/confirm", { body: { signature: sig }, cookie: clients.b.cookie });
  assert.equal(steal.status, 403);

  const c = await claim(a, { kind: "quest", questId: "d-checkin" });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  assert.equal(c.json.state.quests.find((x: any) => x.id === "d-checkin").claimed, true);
  assert.equal(c.json.state.player.coins, 20);
  const twice = await call("/api/hub/claim", { body: { kind: "quest", questId: "d-checkin" }, cookie: a.cookie });
  assert.equal(twice.status, 409);
  const notDone = await call("/api/hub/claim", { body: { kind: "quest", questId: "h-streak" }, cookie: a.cookie });
  assert.equal(notDone.status, 400);
  const tier = await call("/api/hub/claim", { body: { kind: "tier", tier: 0 }, cookie: a.cookie });
  assert.equal(tier.status, 400, "no qualified friends yet");
});

test("hub: a tampered server transaction is rejected by the chain", async () => {
  const a = clients.a;
  const r = await call("/api/hub/claim", { body: { kind: "box" }, cookie: a.cookie });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const tx = Transaction.from(Buffer.from(r.json.tx, "base64"));
  const last = tx.instructions[tx.instructions.length - 1];
  last.data[last.data.length - 8] = 0xff; // more coins than attested
  const sigs = tx.signatures.map((s) => ({ ...s }));
  tx.partialSign(a.kp);
  for (const s of sigs) if (!s.publicKey.equals(a.kp.publicKey) && s.signature) tx.addSignature(s.publicKey, s.signature);
  await assert.rejects(conn.sendRawTransaction(tx.serialize({ verifySignatures: false })));
  // The honest box still works, once.
  const ok = await claim(a, { kind: "box" });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.state.box.opened, true);
  assert.equal((await call("/api/hub/claim", { body: { kind: "box" }, cookie: a.cookie })).status, 409);
});

test("referral counts only once the friend is active onchain", async () => {
  const a = clients.a, b = clients.b;
  let st = await call("/api/hub/state", { cookie: a.cookie });
  assert.equal(st.json.referral.friends, 0);
  const sig = await send(b.kp, [initPlayerIx(b.kp.publicKey, playerPda(a.kp.publicKey)), checkInIx(b.kp.publicKey)]);
  assert.equal((await call("/api/hub/confirm", { body: { signature: sig }, cookie: b.cookie })).status, 200);
  st = await call("/api/hub/state", { cookie: a.cookie });
  assert.equal(st.json.referral.friends, 1);
  const t = await claim(a, { kind: "tier", tier: 0 });
  assert.equal(t.status, 200, JSON.stringify(t.json));
  assert.equal(t.json.state.referral.tiers[0].claimed, true);
});

test("mint a Core agent, register it, level up, and follow a transfer", async () => {
  const a = clients.a, b = clients.b;
  assert.ok((await conn.getBalance(a.kp.publicKey)) > 0.1 * LAMPORTS_PER_SOL, "a has SOL");
  const base = createUmi(RPC, "confirmed").use(mplCore());
  const umi = base.use(keypairIdentity(base.eddsa.createKeypairFromSecretKey(a.kp.secretKey)));
  const asset = generateSigner(umi);
  await create(umi, { asset, name: "Ada", uri: "https://lexari.ai/a.json" }).sendAndConfirm(umi);
  const assetPk = new PublicKey(asset.publicKey);
  const reg = await send(a.kp, [registerAgentIx(a.kp.publicKey, assetPk, "Ada", "Helper", "dna")]);
  let r = await call("/api/hub/confirm", { body: { signature: reg }, cookie: a.cookie });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const me = await call("/api/me", { cookie: a.cookie });
  assert.equal(me.json.agents.find((x: any) => x.slug === "home").asset, assetPk.toBase58());
  const coins = r.json.state.player.coins as number;
  assert.ok(coins >= 60, `coins ${coins}`);
  const lv = await send(a.kp, [levelUpIx(a.kp.publicKey, assetPk, 60)]);
  r = await call("/api/hub/confirm", { body: { signature: lv }, cookie: a.cookie });
  assert.equal(r.json.state.levels[0].level, 2);
  assert.equal(r.json.state.quests.find((x: any) => x.id === "w-level").progress, 1);

  // Transfer the card to b; b syncs ownership and the agent moves with it.
  await transferV1(umi, { asset: asset.publicKey, newOwner: umiPk(b.kp.publicKey.toBase58()) }).sendAndConfirm(umi);
  const { syncAgentOwnerIx } = await import("../lib/lexari-ix");
  const sync = await send(b.kp, [syncAgentOwnerIx(b.kp.publicKey, assetPk)]);
  assert.equal((await call("/api/hub/confirm", { body: { signature: sync }, cookie: b.cookie })).status, 200);
  const bme = await call("/api/me", { cookie: b.cookie });
  assert.ok(bme.json.agents.some((x: any) => x.asset === assetPk.toBase58()), "agent moved to the new owner");
  const ame = await call("/api/me", { cookie: a.cookie });
  assert.ok(!ame.json.agents.some((x: any) => x.asset === assetPk.toBase58()));
});

test("hires: verified payment, one hire per payment", async () => {
  const b = clients.b;
  await fund(TREASURY, 1);
  const short = await send(b.kp, [SystemProgram.transfer({ fromPubkey: b.kp.publicKey, toPubkey: TREASURY, lamports: 1000 })]);
  assert.equal((await call("/api/hires", { body: { slug: "scout", tx: short, mint: "SOL" }, cookie: b.cookie })).status, 400);
  const wrongTo = await send(b.kp, [SystemProgram.transfer({ fromPubkey: b.kp.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 10_000_000 })]);
  assert.equal((await call("/api/hires", { body: { slug: "scout", tx: wrongTo, mint: "SOL" }, cookie: b.cookie })).status, 400);
  const paid = await send(b.kp, [SystemProgram.transfer({ fromPubkey: b.kp.publicKey, toPubkey: TREASURY, lamports: 10_000_000 })]);
  const ok = await call("/api/hires", { body: { slug: "scout", tx: paid, mint: "SOL" }, cookie: b.cookie });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal((await call("/api/hires", { body: { slug: "quill", tx: paid, mint: "SOL" }, cookie: b.cookie })).status, 409);
  assert.equal((await call("/api/hires", { body: { slug: "scout", tx: paid, mint: "SOL" }, cookie: clients.a.cookie })).status, 409);
  const me = await call("/api/me", { cookie: b.cookie });
  assert.ok(me.json.agents.some((x: any) => x.slug === "scout" && x.kind === "hired"));
});

test("export, clear chats, sign out, delete account", async () => {
  const a = clients.a;
  const ex = await call("/api/account", { cookie: a.cookie });
  assert.equal(ex.status, 200);
  assert.equal((await call("/api/chats", { method: "DELETE", cookie: a.cookie })).status, 200);
  assert.equal((await call("/api/account", { cookie: a.cookie })).json.chats.length, 0);
  assert.equal((await call("/api/auth/signout", { method: "POST", cookie: a.cookie })).status, 200);
  assert.equal((await call("/api/me", { cookie: a.cookie })).status, 401);
  const s = await signIn(a.kp);
  assert.equal((await call("/api/account", { method: "DELETE", cookie: s.cookie })).status, 200);
  assert.equal((await call("/api/me", { cookie: s.cookie })).status, 401);
});
