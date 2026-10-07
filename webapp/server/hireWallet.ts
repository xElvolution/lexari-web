/**
 * A hired agent's own task wallet (devnet). Every specialist you hire gets one wallet per person, held by Lexari on
 * behalf of the specialist's maker (the maker can't sign for it in this demo; Lexari's server does). It starts empty:
 * when the agent needs money for a task it asks in chat, you approve a confirm card and SOL moves from your wallet
 * to this one; whatever is left goes back to you with one tap.
 *
 * The key is derived from SESSION_SECRET with a fixed label, so no key is stored and each (person, agent) pair has
 * its own address. Rotating SESSION_SECRET moves these to new addresses (fine on devnet; return leftovers first).
 */
import { createHmac } from "node:crypto";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { connection } from "./hub/chain";

const FEE = 5000;

export function hireWallet(userId: string, slug: string) {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 16) throw new Error("Hired agent wallets are not set up on this server.");
  const seed = createHmac("sha256", secret).update(`lexari-hire-wallet:v1:${userId}:${slug}`).digest();
  return Keypair.fromSeed(seed.subarray(0, 32));
}

export async function hireWalletInfo(userId: string, slug: string) {
  const kp = hireWallet(userId, slug);
  const lamports = await connection().getBalance(kp.publicKey, "confirmed").catch(() => -1);
  return { address: kp.publicKey.toBase58(), lamports, sol: lamports >= 0 ? lamports / LAMPORTS_PER_SOL : null };
}

/**
 * Sends everything left (minus the network fee) from the agent's task wallet back to your wallet.
 * Confirmation is polled for up to ~25 s. A transfer that is sent but not confirmed in that window comes back with
 * `confirmed: false` and its signature (it used to throw, so the app said it failed while the SOL was on its way).
 */
export async function returnLeftover(userId: string, slug: string, to: string) {
  const kp = hireWallet(userId, slug);
  const c = connection();
  const bal = await c.getBalance(kp.publicKey, "confirmed");
  const lamports = bal - FEE;
  if (lamports <= 0) return { sig: null as string | null, lamports: 0, confirmed: false };
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: kp.publicKey, blockhash, lastValidBlockHeight }).add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(to), lamports }));
  tx.sign(kp);
  const sig = await c.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed", maxRetries: 5 });
  const end = Date.now() + 25_000;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1200));
    const st = (await c.getSignatureStatuses([sig]).catch(() => null))?.value[0];
    if (st?.err) throw new Error("The return transfer failed on Solana.");
    if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return { sig, lamports, confirmed: true };
  }
  return { sig, lamports, confirmed: false };
}

export const FUND_MARK = "[lexari-fund]";
export const MAX_FUND_USD = 10;
export const FUND_HINT = (name: string) => [
  FUND_MARK,
  `You are a hired specialist with your own task wallet on Solana devnet. You never touch the person's money directly.`,
  `If a task really needs money (paid API credits, compute, a domain, test tokens), ask for it in US dollars with one tag: <fund usd="AMOUNT" for="what it pays for"/> (at most $${MAX_FUND_USD}; keep it small, like 1 to 3).`,
  `Lexari shows the person a Confirm card. If they approve, the dollars come from their Lexari balance and arrive in your wallet as test USDC on devnet. Anything you don't use goes back to their balance.`,
  `After a fund tag say briefly what it is for and that they need to confirm. Never claim money arrived. Don't ask for funds unless the task needs them. You are ${name}.`,
].join(" ");

/** A fund request in dollars. Old "sol" tags from earlier replies are read as dollars too, at most the cap. */
export function fundRequest(text: string) {
  const m = text.match(/<fund\s+(?:usd|sol)=["']?\$?([0-9.]+)["']?(?:\s+for=["']([^"']{1,120})["'])?\s*\/?>(?:\s*<\/fund>)?/i);
  if (!m) return null;
  const usd = Number(m[1]);
  if (!(usd > 0)) return null;
  return { usd: Math.min(MAX_FUND_USD, Math.max(1, Math.round(usd * 100) / 100)), reason: (m[2] || "").trim() };
}
export const stripFundTags = (t: string) => t.replace(/<fund\b[^>]*\/?>(\s*<\/fund>)?/gi, "").replace(/[ \t]+\n/g, "\n").trim();
