import assert from "node:assert/strict";
import test from "node:test";
import { isSolanaMobile, userAgent } from "../src/lib/device.ts";
import { asCluster, networkBadge, solscanTx } from "../src/lib/network.ts";
import { takeSse } from "../src/lib/sse.ts";
import { chatTurnBody } from "../src/lib/chatTurn.ts";
import { findSecrets, isBlockedKind, scanSecrets } from "../src/lib/secretScan.ts";

test("seeker and saga are solana mobile, a pixel is not", () => {
  assert.equal(isSolanaMobile({ brand: "solanamobile", model: "Seeker" }), true);
  assert.equal(isSolanaMobile({ manufacturer: "Solana Mobile", model: "Saga" }), true);
  assert.equal(isSolanaMobile({ brand: "Google", model: "Pixel 7" }), false);
  assert.equal(userAgent("1.0.0", "Pixel 7"), "LexariAndroid/1.0.0 (Pixel 7)");
});

test("badges and solscan", () => {
  assert.equal(asCluster(undefined), "devnet");
  assert.equal(networkBadge("mainnet-beta").tone, "real");
  assert.equal(networkBadge("devnet").label.includes("TESTNET"), true);
  assert.equal(solscanTx("abc", "mainnet-beta").includes("cluster"), false);
  assert.match(solscanTx("abc", "devnet"), /cluster=devnet/);
});

test("chat body matches the server's chatBody: history is { from, text }, files go in meta", () => {
  const msgs = [
    { id: "hello", from: "home", text: "Hi, I'm Nova. Ask me anything." },
    { id: "m1", from: "you", text: "hi" },
    { id: "s1", from: "system", text: "Voice call" },
    { id: "m2", from: "home", text: "" },
    { id: "m3", from: "home", text: "Hello!" },
  ];
  const b = chatTurnBody({ convo: "home", speaker: "home", text: " next ", history: msgs, userMsgId: "mabcd", replyMsgId: "mefgh", tz: "Africa/Lagos" });
  assert.deepEqual(b.history, [{ from: "you", text: "hi" }, { from: "home", text: "Hello!" }]);
  assert.equal(b.text, "next");
  assert.deepEqual(b.meta, {});
  assert.equal("file" in b, false);
  assert.equal(b.tz, "Africa/Lagos");
  const f = chatTurnBody({ convo: "home", speaker: "home", text: "", file: { name: "notes.pdf", size: "12 KB", id: "3f2a1b4c-0000-4000-8000-000000000000" }, history: [], userMsgId: "mabcd", replyMsgId: "mefgh" });
  assert.equal(f.text, "Attachment: notes.pdf");
  assert.deepEqual(f.meta, { file: { name: "notes.pdf", size: "12 KB", id: "3f2a1b4c-0000-4000-8000-000000000000" } });
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, from: i % 2 ? "home" : "you", text: "x".repeat(3000) }));
  const h = chatTurnBody({ convo: "home", speaker: "home", text: "a", history: many, userMsgId: "mabcd", replyMsgId: "mefgh" }).history;
  assert.equal(h.length, 12);
  assert.equal(h[0].text.length, 2000);
});

test("sse frames", () => {
  const first = takeSse('data: {"token":"hi"}\n\n');
  assert.deepEqual(first.events, ['{"token":"hi"}']);
  const split = takeSse('data: {"token":"a"}\n\ndata: {"done":true}\n\npartial');
  assert.equal(split.events.length, 2);
  assert.equal(split.rest, "partial");
});

test("seed phrases are blocked and ordinary chat is not", async () => {
  const phrase = "abandon ability able about above absent absorb abstract absurd abuse access accident";
  const seeds = scanSecrets(phrase);
  assert.equal(seeds.some((f) => f.kind === "seed"), true);
  assert.equal(isBlockedKind("seed"), true);
  assert.equal(isBlockedKind("private"), true);
  assert.equal(isBlockedKind("key"), false);
  assert.equal(scanSecrets("hello from lexari").length, 0);
  const keys = await findSecrets("abandon ability able about above absent absorb abstract absurd abuse access accident");
  assert.equal(keys.some((f) => isBlockedKind(f.kind)), true);
});

test("memory vault matches the web's WebCrypto sealing", async () => {
  const { deriveKeys, sealNote, openNote, toB64, fromB64, packKeys, unpackKeys } = await import("../src/lib/vaultCore.ts");
  const sig = Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + 3) & 255);
  const keys = deriveKeys(sig);
  const iv = Uint8Array.from({ length: 12 }, (_, i) => i + 1);
  const sealed = sealNote(keys, "Calls you Ada", iv);
  // the same thing through WebCrypto, exactly as webapp/lib/vault.ts does it
  const s = globalThis.crypto.subtle, te = new TextEncoder();
  const base = await s.importKey("raw", sig, "HKDF", false, ["deriveKey"]);
  const p = (info: string) => ({ name: "HKDF", hash: "SHA-256", salt: te.encode("lexari"), info: te.encode(info) });
  const enc = await s.deriveKey(p("memory-enc"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const mac = await s.deriveKey(p("memory-mac"), base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  const ct = new Uint8Array(await s.encrypt({ name: "AES-GCM", iv }, enc, te.encode("Calls you Ada")));
  const h = Array.from(new Uint8Array(await s.sign("HMAC", mac, te.encode("calls you ada"))), (x) => x.toString(16).padStart(2, "0")).join("");
  assert.equal(sealed.ciphertext, Buffer.from(ct).toString("base64"));
  assert.equal(sealed.iv, toB64(iv));
  assert.equal(sealed.contentHash, h);
  assert.equal(openNote(keys, sealed.ciphertext, sealed.iv), "Calls you Ada");
  assert.deepEqual(fromB64(toB64(Uint8Array.from([1, 2, 3, 4, 250]))), Uint8Array.from([1, 2, 3, 4, 250]));
  assert.deepEqual(unpackKeys(packKeys(keys)), keys);
});
