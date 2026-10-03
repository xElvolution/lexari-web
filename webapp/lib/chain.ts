"use client";

import { Buffer } from "buffer";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { create, fetchAsset, mplCore, update } from "@metaplex-foundation/mpl-core";
import { createGenericFile, generateSigner, publicKey } from "@metaplex-foundation/umi";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { CHAIN_NAME, LEXARI_PROGRAM_ID, SOLANA_CLUSTER, SOLANA_RPC, faceSvg, type NftRecord } from "./nft";

const PROGRAM = new PublicKey(LEXARI_PROGRAM_ID);
const DISC = {
  register_agent: Uint8Array.from([135, 157, 66, 195, 2, 113, 175, 30]),
  update_agent: Uint8Array.from([85, 2, 178, 9, 119, 139, 102, 164]),
  write_memory: Uint8Array.from([230, 48, 240, 225, 213, 184, 250, 80]),
  delete_memory: Uint8Array.from([197, 189, 203, 106, 20, 99, 209, 134]),
};

type Payer = { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> };

const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};
const utf8 = (s: string) => new TextEncoder().encode(s);
const str = (s: string) => {
  const body = utf8(s);
  return concat(u32(body.length), body);
};
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes: Uint8Array) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  return "1".repeat(zeros) + digits.reverse().map((d) => B58[d]).join("");
}
const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

export function agentPda(owner: PublicKey, asset: PublicKey) {
  return PublicKey.findProgramAddressSync([utf8("agent"), owner.toBuffer(), asset.toBuffer()], PROGRAM)[0];
}
export function memoryPda(agent: PublicKey, hash: Uint8Array) {
  return PublicKey.findProgramAddressSync([utf8("memory"), agent.toBuffer(), hash], PROGRAM)[0];
}

/** The home agent's card, or the first minted card. Old numeric token ids are ignored. */
export function registryAsset(meta: Record<string, { nft?: { tokenId?: string } } | undefined>): string | undefined {
  const ids = [meta.home?.nft?.tokenId, ...Object.values(meta).map((m) => m?.nft?.tokenId)];
  return ids.find((id) => {
    if (!id || /^\d+$/.test(id)) return false;
    try { new PublicKey(id); return true; } catch { return false; }
  });
}

export async function programIsLive(connection: Connection) {
  const info = await connection.getAccountInfo(PROGRAM);
  return !!info;
}

function umiFor(adapter: WalletAdapter) {
  const irys = SOLANA_CLUSTER === "mainnet-beta" ? "https://node1.irys.xyz" : "https://devnet.irys.xyz";
  return createUmi(SOLANA_RPC).use(mplCore()).use(walletAdapterIdentity(adapter)).use(irysUploader({ address: irys }));
}

async function uploadCard(adapter: WalletAdapter, name: string, role: string, dna: string, svg: string) {
  const umi = umiFor(adapter);
  const file = createGenericFile(utf8(svg), "face.svg", { contentType: "image/svg+xml" });
  const [imageUri] = await umi.uploader.upload([file]);
  if (!imageUri) throw new Error("The face could not be stored. Nothing was minted.");
  const uri = await umi.uploader.uploadJson({
    name,
    symbol: "LXID",
    description: `${name} is a Lexari agent. ${role}. The owner can update this card.`,
    image: imageUri,
    attributes: [
      { trait_type: "Role", value: role },
      { trait_type: "Face", value: dna },
    ],
  });
  if (!uri || uri.length > 200) throw new Error("The metadata link is missing or too long. Nothing was minted.");
  return uri;
}

async function send(connection: Connection, payer: Payer, ix: TransactionInstruction) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight }).add(ix);
  const signed = await payer.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  const result = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (result.value.err) throw new Error("The transaction failed on Solana.");
  return sig;
}

function ix(data: Uint8Array, keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]) {
  return new TransactionInstruction({ programId: PROGRAM, keys, data: Buffer.from(data) });
}

async function register(connection: Connection, payer: Payer, asset: PublicKey, name: string, role: string, dna: string) {
  const agent = agentPda(payer.publicKey, asset);
  const existing = await connection.getAccountInfo(agent);
  const data = existing
    ? concat(DISC.update_agent, str(name), str(role), str(dna))
    : concat(DISC.register_agent, asset.toBytes(), str(name), str(role), str(dna));
  const keys = existing
    ? [
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        { pubkey: agent, isSigner: false, isWritable: true },
      ]
    : [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: agent, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];
  return send(connection, payer, ix(data, keys));
}

export async function mintCard(opts: {
  connection: Connection;
  adapter: WalletAdapter;
  payer: Payer;
  name: string;
  role: string;
  dna: string;
  svg: string;
}): Promise<NftRecord> {
  const umi = umiFor(opts.adapter);
  const uri = await uploadCard(opts.adapter, opts.name, opts.role, opts.dna, opts.svg);
  const assetSigner = generateSigner(umi);
  const created = await create(umi, { asset: assetSigner, name: opts.name, uri }).sendAndConfirm(umi);
  const asset = new PublicKey(assetSigner.publicKey);
  const coreTx = b58(created.signature);
  let registered = true;
  let tx = coreTx;
  try {
    tx = await register(opts.connection, opts.payer, asset, opts.name, opts.role, opts.dna);
  } catch {
    registered = false;
    tx = coreTx;
  }
  return {
    tokenId: asset.toBase58(),
    tx,
    dna: opts.dna,
    name: opts.name,
    role: opts.role,
    owner: opts.payer.publicKey.toBase58(),
    at: Date.now(),
    uri,
    registered,
  };
}

export async function updateCard(opts: {
  connection: Connection;
  adapter: WalletAdapter;
  payer: Payer;
  asset: string;
  name: string;
  role: string;
  dna: string;
  svg: string;
}): Promise<{ tx: string; uri: string }> {
  const uri = await uploadCard(opts.adapter, opts.name, opts.role, opts.dna, opts.svg);
  const umi = umiFor(opts.adapter);
  const assetAccount = await fetchAsset(umi, publicKey(opts.asset));
  await update(umi, { asset: assetAccount, name: opts.name, uri }).sendAndConfirm(umi);
  const tx = await register(opts.connection, opts.payer, new PublicKey(opts.asset), opts.name, opts.role, opts.dna);
  return { tx, uri };
}

function copyBytes(bytes: Uint8Array) {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out;
}
async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", copyBytes(bytes));
  return new Uint8Array(digest);
}

/** Encrypts the note with a key from the wallet signature, uploads the ciphertext, and records the hash. */
export async function publishMemory(opts: {
  connection: Connection;
  adapter: WalletAdapter;
  payer: Payer;
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>;
  asset: string;
  text: string;
}) {
  const sig = await opts.signMessage(utf8("Lexari memory key v1"));
  const raw = await crypto.subtle.digest("SHA-256", copyBytes(sig));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8(opts.text)));
  const hash = await sha256(ct);
  const umi = umiFor(opts.adapter);
  const uri = await umi.uploader.uploadJson({ v: 1, iv: b64(iv), ct: b64(ct) });
  if (!uri || uri.length > 200) throw new Error("The memory link is missing or too long to store onchain.");
  const agent = agentPda(opts.payer.publicKey, new PublicKey(opts.asset));
  const memory = memoryPda(agent, hash);
  const data = concat(DISC.write_memory, hash, str(uri));
  const tx = await send(opts.connection, opts.payer, ix(data, [
    { pubkey: opts.payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: agent, isSigner: false, isWritable: false },
    { pubkey: memory, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]));
  return { hash: toHex(hash), tx, uri };
}

export async function eraseMemory(opts: {
  connection: Connection;
  payer: Payer;
  asset: string;
  hashHex: string;
}) {
  const hash = fromHex(opts.hashHex);
  const agent = agentPda(opts.payer.publicKey, new PublicKey(opts.asset));
  const memory = memoryPda(agent, hash);
  const info = await opts.connection.getAccountInfo(memory);
  if (!info) return "";
  return send(opts.connection, opts.payer, ix(DISC.delete_memory, [
    { pubkey: opts.payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: memory, isSigner: false, isWritable: true },
  ]));
}

export const chainLabel = CHAIN_NAME;
