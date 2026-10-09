/**
 * Devnet only: a few dollars of a Lexari TEST token (SKR, ORE, USDT, BONK, JUP in content/topup.ts) so people can try
 * paying with it. The Lexari devnet faucet is the mint authority of those test mints. Once a day per person per
 * token, worth about $3 at the real token's live price.
 */
import { PublicKey, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createMintToCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { railById, type Rail } from "@/content/topup";
import { cluster } from "../config";
import { faucetKey } from "../faucet";
import { connection } from "../hub/chain";
import { HttpError, rateLimit } from "../http";
import { coinUsd } from "./prices";

const DRIP_USD = 3;

export async function dripTestToken(userId: string, wallet: string, railKey: string) {
  if (cluster() !== "devnet") throw new HttpError(400, "Test tokens are devnet only.");
  const r: Rail | undefined = railById(railKey);
  if (!r || r.chain !== "solana" || !r.test || !r.token) throw new HttpError(400, "That coin has no devnet test token.");
  const key = faucetKey();
  if (!key) throw new HttpError(503, "The devnet faucet is not set up on this server.");
  const price = await coinUsd(r.coin).catch(() => { throw new HttpError(503, "No live price right now. Try again in a moment."); });
  if (!(await rateLimit(`testtoken:${userId}:${r.coin}`, 1, 86_400_000))) throw new HttpError(429, `You've had today's test ${r.coin}. Come back tomorrow.`);
  const atoms = BigInt(Math.ceil((DRIP_USD / price) * 10 ** Math.min(r.decimals, 9))) * BigInt(10) ** BigInt(Math.max(0, r.decimals - 9));
  const mint = new PublicKey(r.token), owner = new PublicKey(wallet);
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const c = connection();
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: key.publicKey, blockhash, lastValidBlockHeight })
    .add(createAssociatedTokenAccountIdempotentInstruction(key.publicKey, ata, owner, mint))
    .add(createMintToCheckedInstruction(mint, ata, key.publicKey, atoms, r.decimals));
  tx.sign(key);
  const sig = await c.sendRawTransaction(tx.serialize());
  const st = await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (st.value.err) throw new HttpError(502, "The test tokens didn't arrive. Try again.");
  return { sig, amount: Number(atoms) / 10 ** r.decimals, coin: r.coin };
}
