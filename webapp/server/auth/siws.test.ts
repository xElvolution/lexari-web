import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { buildSignInMessage, isWallet, verifySolanaSignature } from "./siws";

test("a wallet signature matches only the exact message and key", () => {
  const kp = Keypair.generate();
  const wallet = kp.publicKey.toBase58();
  const message = buildSignInMessage({
    domain: "localhost:3001",
    wallet,
    uri: "http://localhost:3001",
    nonce: "nonce-1",
    issuedAt: "2026-10-03T00:00:00.000Z",
    chainId: "solana:devnet",
  });
  assert.match(message, /Nonce: nonce-1/);
  assert.match(message, new RegExp(wallet));
  const signature = Buffer.from(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey)).toString("base64");
  assert.equal(verifySolanaSignature(message, signature, wallet), true);
  assert.equal(verifySolanaSignature(`${message}\n`, signature, wallet), false);
  assert.equal(verifySolanaSignature(message, signature, Keypair.generate().publicKey.toBase58()), false);
  assert.equal(verifySolanaSignature(message, Buffer.from("nope").toString("base64"), wallet), false);
  assert.equal(isWallet(wallet), true);
  assert.equal(isWallet("not-a-wallet"), false);
});
