"use client";

/**
 * Everything the browser sends to Solana. Instructions come from lib/lexari-ix.ts (shared with the server).
 * Each transaction is signed by the wallet bridge (Phantom/Solflare/Backpack or the Privy wallet), then
 * posted to /api/hub/confirm so the server records what the chain did.
 */
import { Connection, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { create, fetchAsset, mplCore, update } from "@metaplex-foundation/mpl-core";
import { createGenericFile, generateSigner, publicKey as umiPk, type Umi } from "@metaplex-foundation/umi";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { fromWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import type { HubState } from "@/server/hub/state";
import { api } from "./api";
import {
  PROGRAM_ID, agentPda, checkInIx, deleteMemoryIx, initPlayerIx, levelUpIx, memoryPda, playerPda, registerAgentIx, updateAgentIx, writeMemoryIx,
} from "./lexari-ix";
import { CHAIN_NAME, SOLANA_CLUSTER, SOLANA_RPC, type NftRecord } from "./nft";
import { applyHub } from "./store";
import { hexToBytes } from "./vault";
import type { WalletBridge } from "./walletBridge";

export const connection = () => new Connection(SOLANA_RPC, "confirmed");
const utf8 = (s: string) => new TextEncoder().encode(s);
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes: Uint8Array) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = Math.floor(carry / 58); }
    while (carry > 0) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  return "1".repeat(zeros) + digits.reverse().map((d) => B58[d]).join("");
}

/** The home agent's card, or the first minted card. */
export function registryAsset(meta: Record<string, { nft?: { tokenId?: string } } | undefined>): string | undefined {
  const ids = [meta.home?.nft?.tokenId, ...Object.values(meta).map((m) => m?.nft?.tokenId)];
  return ids.find((id) => { if (!id || /^\d+$/.test(id)) return false; try { new PublicKey(id); return true; } catch { return false; } });
}

let liveCache: { at: number; ok: boolean } | null = null;
export async function programIsLive(conn = connection()) {
  if (liveCache && Date.now() - liveCache.at < 60_000) return liveCache.ok;
  const info = await conn.getAccountInfo(PROGRAM_ID);
  liveCache = { at: Date.now(), ok: !!info?.executable };
  return liveCache.ok;
}

/** Records a confirmed transaction on the server and refreshes the Hub. */
export async function confirmOnServer(signature: string) {
  const r = await api<{ recorded: string[]; state: HubState }>("/api/hub/confirm", { body: { signature } });
  applyHub(r.state);
  return r;
}

async function sendSigned(tx: Transaction, lastValidBlockHeight: number) {
  const conn = connection();
  const sig = await conn.sendRawTransaction(tx.serialize());
  const res = await conn.confirmTransaction({ signature: sig, blockhash: tx.recentBlockhash!, lastValidBlockHeight }, "confirmed");
  if (res.value.err) throw new Error("The transaction failed on Solana.");
  return sig;
}

/** Signs and sends instructions with your wallet, then lets the server record them. */
export async function sendAndRecord(bridge: WalletBridge, ixs: TransactionInstruction[]) {
  const { blockhash, lastValidBlockHeight } = await connection().getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: bridge.publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
  const signed = await bridge.signTransaction(tx);
  const sig = await sendSigned(signed, lastValidBlockHeight);
  const r = await confirmOnServer(sig);
  return { sig, ...r };
}

/** A reward the server checked and co-signed (quest, box, referral tier). Your wallet signs and pays the fee. */
export async function claimReward(bridge: WalletBridge, req: { kind: "quest"; questId: string } | { kind: "box" } | { kind: "tier"; tier: number }) {
  const { sig, coins, settled } = await claimRewardFast(bridge, req);
  const r = await settled;
  return { sig, coins, ...r };
}

/**
 * Fast claim: resolves as soon as Solana accepted the transaction (preflight passed), so the app can show the
 * coins right away. `settled` confirms on chain and records it on the server in the background.
 */
export async function claimRewardFast(bridge: WalletBridge, req: { kind: "quest"; questId: string } | { kind: "box" } | { kind: "tier"; tier: number }) {
  const built = await api<{ tx: string; coins: number; lastValidBlockHeight: number }>("/api/hub/claim", { body: req });
  const tx = Transaction.from(Uint8Array.from(atob(built.tx), (c) => c.charCodeAt(0)));
  if (!tx.feePayer?.equals(bridge.publicKey)) throw new Error("That reward was built for another wallet.");
  const signed = await bridge.signTransaction(tx);
  const conn = connection();
  const sig = await conn.sendRawTransaction(signed.serialize(), { preflightCommitment: "confirmed", maxRetries: 5 });
  const settled = (async () => {
    const res = await conn.confirmTransaction({ signature: sig, blockhash: signed.recentBlockhash!, lastValidBlockHeight: built.lastValidBlockHeight }, "confirmed");
    if (res.value.err) throw new Error("The claim failed on Solana.");
    return confirmOnServer(sig);
  })();
  settled.catch(() => {});
  return { sig, coins: built.coins, settled };
}

export async function checkIn(bridge: WalletBridge, live: HubState | null | undefined) {
  const ixs: TransactionInstruction[] = [];
  if (!live?.player) ixs.push(initPlayerIx(bridge.publicKey, live?.referrerPlayer ? new PublicKey(live.referrerPlayer) : null));
  ixs.push(checkInIx(bridge.publicKey));
  return sendAndRecord(bridge, ixs);
}

export async function levelUp(bridge: WalletBridge, asset: string, coins: number) {
  const player = await connection().getAccountInfo(playerPda(bridge.publicKey));
  if (!player) throw new Error("Check in once first. That opens your coin account.");
  return sendAndRecord(bridge, [levelUpIx(bridge.publicKey, new PublicKey(asset), coins)]);
}

/* ---------- ID cards (Metaplex Core) ---------- */
function umiFor(bridge: WalletBridge): Umi {
  const irys = SOLANA_CLUSTER === "mainnet-beta" ? "https://node1.irys.xyz" : "https://devnet.irys.xyz";
  // umi only needs these four members of a wallet adapter.
  const adapter = {
    publicKey: bridge.publicKey,
    signMessage: bridge.signMessage,
    signTransaction: bridge.signTransaction,
    signAllTransactions: bridge.signAllTransactions || (async <T,>(txs: T[]) => { const out: T[] = []; for (const t of txs) out.push(await bridge.signTransaction(t as never) as T); return out; }),
  };
  return createUmi(SOLANA_RPC, "confirmed").use(mplCore()).use(walletAdapterIdentity(adapter as never)).use(irysUploader({ address: irys }));
}

async function uploadCard(umi: Umi, name: string, role: string, dna: string, svg: string) {
  const file = createGenericFile(utf8(svg), "face.svg", { contentType: "image/svg+xml" });
  const [imageUri] = await umi.uploader.upload([file]);
  if (!imageUri) throw new Error("The face could not be stored. Nothing was minted.");
  const uri = await umi.uploader.uploadJson({
    name, symbol: "LXID", description: `${name} is a Lexari agent. ${role}. The owner can update this card.`, image: imageUri,
    attributes: [{ trait_type: "Role", value: role }, { trait_type: "Face", value: dna }],
  });
  if (!uri || uri.length > 200) throw new Error("The metadata link is missing or too long. Nothing was minted.");
  return uri;
}

/** Mints the Core asset and registers the agent in one transaction, so a card is never half made. */
export async function mintCard(opts: { bridge: WalletBridge; name: string; role: string; dna: string; svg: string }): Promise<NftRecord> {
  const umi = umiFor(opts.bridge);
  const uri = await uploadCard(umi, opts.name, opts.role, opts.dna, opts.svg);
  const assetSigner = generateSigner(umi);
  const asset = new PublicKey(assetSigner.publicKey);
  const reg = fromWeb3JsInstruction(registerAgentIx(opts.bridge.publicKey, asset, opts.name, opts.role, opts.dna));
  const built = create(umi, { asset: assetSigner, name: opts.name, uri }).add({ instruction: reg, signers: [umi.identity], bytesCreatedOnChain: 0 });
  const res = await built.sendAndConfirm(umi);
  const tx = b58(res.signature);
  await confirmOnServer(tx);
  return { tokenId: asset.toBase58(), tx, dna: opts.dna, name: opts.name, role: opts.role, owner: opts.bridge.publicKey.toBase58(), at: Date.now(), uri, registered: true };
}

export async function updateCard(opts: { bridge: WalletBridge; asset: string; name: string; role: string; dna: string; svg: string }): Promise<{ tx: string; uri: string }> {
  const umi = umiFor(opts.bridge);
  const uri = await uploadCard(umi, opts.name, opts.role, opts.dna, opts.svg);
  const assetAccount = await fetchAsset(umi, umiPk(opts.asset));
  const upd = fromWeb3JsInstruction(updateAgentIx(opts.bridge.publicKey, new PublicKey(opts.asset), opts.name, opts.role, opts.dna));
  const res = await update(umi, { asset: assetAccount, name: opts.name, uri }).add({ instruction: upd, signers: [umi.identity], bytesCreatedOnChain: 0 }).sendAndConfirm(umi);
  const tx = b58(res.signature);
  await confirmOnServer(tx);
  return { tx, uri };
}

/* ---------- memories ---------- */
/** Records a memory's hash onchain under your agent's card. The ciphertext stays in your account. */
export async function publishMemory(opts: { bridge: WalletBridge; asset: string; hashHex: string; serverId: string }) {
  const hash = hexToBytes(opts.hashHex);
  const pda = memoryPda(agentPda(new PublicKey(opts.asset)), hash);
  if (await connection().getAccountInfo(pda)) return { sig: "", pda: pda.toBase58() };
  const r = await sendAndRecord(opts.bridge, [writeMemoryIx(opts.bridge.publicKey, new PublicKey(opts.asset), hash, `lexari:memory/${opts.serverId}`)]);
  return { sig: r.sig, pda: pda.toBase58() };
}

export async function eraseMemory(opts: { bridge: WalletBridge; asset: string; hashHex: string }) {
  const pda = memoryPda(agentPda(new PublicKey(opts.asset)), hexToBytes(opts.hashHex));
  if (!(await connection().getAccountInfo(pda))) return "";
  return (await sendAndRecord(opts.bridge, [deleteMemoryIx(opts.bridge.publicKey, pda)])).sig;
}

export const chainLabel = CHAIN_NAME;
