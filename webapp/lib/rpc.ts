"use client";

/**
 * The browser's Solana connection. When the server has a private RPC (HELIUS_API_KEY or SOLANA_RPC), the build sets
 * NEXT_PUBLIC_RPC_PROXY and the browser goes through /api/rpc, so the key never reaches the page. Websocket
 * subscriptions stay on the public endpoint, and confirmations poll instead of relying on a socket.
 */
import { Connection, type Commitment, type ConnectionConfig } from "@solana/web3.js";
import { SOLANA_RPC } from "./nft";

const PROXY = process.env.NEXT_PUBLIC_RPC_PROXY === "1";
const wsFrom = (http: string) => http.replace(/^http/, "ws");

/** The HTTP endpoint for this page. */
export function rpcEndpoint() {
  if (PROXY && typeof window !== "undefined") return `${window.location.origin}/api/rpc`;
  return SOLANA_RPC;
}
export const rpcConfig: ConnectionConfig = { commitment: "confirmed", wsEndpoint: wsFrom(SOLANA_RPC) };

let shared: Connection | null = null;
let sharedFor = "";
/** One shared connection per page. */
export function rpcConnection() {
  const url = rpcEndpoint();
  if (!shared || sharedFor !== url) { shared = new Connection(url, rpcConfig); sharedFor = url; }
  return shared;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/**
 * Waits until a signature is confirmed (or fails, or its blockhash expires) by polling, with backoff on errors.
 * Throws "The transaction failed on Solana." or "Transaction expired: not confirmed in time.".
 */
export async function confirmSig(c: Connection, sig: string, lastValidBlockHeight: number, commitment: Commitment = "confirmed") {
  let wait = 900;
  for (let i = 0; i < 120; i++) {
    try {
      const st = (await c.getSignatureStatuses([sig])).value[0];
      if (st?.err) throw new Error("The transaction failed on Solana.");
      if (st && (st.confirmationStatus === "finalized" || (commitment !== "finalized" && st.confirmationStatus === "confirmed"))) return;
      if (i % 4 === 3 && (await c.getBlockHeight("confirmed")) > lastValidBlockHeight) {
        const again = (await c.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0];
        if (again?.err) throw new Error("The transaction failed on Solana.");
        if (again?.confirmationStatus) return;
        throw new Error("Transaction expired: not confirmed in time.");
      }
      wait = 900;
    } catch (e) {
      if (/failed on Solana|expired/.test((e as Error).message)) throw e;
      wait = Math.min(wait * 2, 5000); // a rate limit or a dropped request: back off, keep waiting
    }
    await sleep(wait);
  }
  throw new Error("Transaction expired: not confirmed in time.");
}
