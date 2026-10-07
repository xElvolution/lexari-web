import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { connection } from "./hub/chain";

/** Marker in the system prompt: the agent can use the person's wallet through tags (see app/api/chat). */
export const WALLET_MARK = "[lexari-wallet]";
export const MAX_SEND_SOL = 0.5;

export const WALLET_HINT = [
  WALLET_MARK,
  "You can use the person's Lexari wallet on Solana devnet through tags that Lexari handles:",
  "write <wallet>balance</wallet> to read the balance, <wallet>address</wallet> to get the address,",
  `and <send to="ADDRESS" sol="AMOUNT"/> to prepare a SOL transfer (at most ${MAX_SEND_SOL} SOL).`,
  "A send is never automatic: Lexari shows the person a confirm card with the amount and recipient, and only they can tap Confirm.",
  "So after a send tag, say you've prepared it and they need to confirm. Never say SOL was sent until Lexari tells you the result (a Lexari event, or the wallet activity list below). Never invent an address; ask for one if missing.",
].join(" ");

export type SendReq = { to: string; sol: number; status: "pending" | "sent" | "cancelled" | "failed"; sig?: string; /** a hired agent asking you to fund its task wallet (in dollars, from your balance) */ kind?: "fund"; agent?: string; reason?: string; usd?: number };

/** Pulls wallet tags out of a reply. */
export function walletRequests(text: string) {
  const reads = [...text.matchAll(/<wallet>\s*(balance|address)\s*<\/wallet>/gi)].map((m) => m[1].toLowerCase() as "balance" | "address");
  const sends = [...text.matchAll(/<send\s+to=["']?([^"'\s/>]+)["']?\s+sol=["']?([0-9.]+)["']?\s*\/?>(?:\s*<\/send>)?/gi)].map((m) => ({ to: m[1], sol: Number(m[2]) }));
  return { reads: [...new Set(reads)], sends: sends.slice(0, 1) };
}
export const stripWalletTags = (t: string) => t.replace(/<wallet>[\s\S]*?<\/wallet>/gi, "").replace(/<send\b[^>]*\/?>(\s*<\/send>)?/gi, "").replace(/[ \t]+\n/g, "\n").trim();

export function checkSend(s: { to: string; sol: number }, from: string): { ok: true; send: SendReq } | { ok: false; why: string } {
  let to: PublicKey;
  try { to = new PublicKey(s.to); } catch { return { ok: false, why: "That isn't a valid Solana address." }; }
  if (!PublicKey.isOnCurve(to.toBytes())) return { ok: false, why: "That address can't receive SOL directly." };
  if (!(s.sol > 0)) return { ok: false, why: "The amount has to be more than 0." };
  if (s.sol > MAX_SEND_SOL) return { ok: false, why: `Agents can send at most ${MAX_SEND_SOL} SOL at a time.` };
  if (to.toBase58() === from) return { ok: false, why: "That's your own address." };
  return { ok: true, send: { to: to.toBase58(), sol: Math.round(s.sol * 1e9) / 1e9, status: "pending" } };
}

export async function walletFacts(address: string, reads: ("balance" | "address")[]) {
  const out: string[] = [];
  if (reads.includes("address")) out.push(`Wallet address: ${address}`);
  if (reads.includes("balance")) {
    try { out.push(`Balance: ${(await connection().getBalance(new PublicKey(address), "confirmed")) / LAMPORTS_PER_SOL} SOL (devnet)`); }
    catch { out.push("Balance: could not be read right now."); }
  }
  return out.join("\n");
}
