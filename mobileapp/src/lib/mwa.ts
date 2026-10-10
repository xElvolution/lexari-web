import { Buffer } from "buffer";
import { PublicKey, Transaction } from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { env } from "./env";
import { chainId } from "./network";
import { loadAuthToken, saveAuthToken } from "./session";

const identity = { name: "Lexari", uri: "https://lexari.ai", icon: "favicon.ico" };

function toBase58(address: string): string {
  try {
    const bytes = Buffer.from(address, "base64");
    if (bytes.length === 32) return new PublicKey(bytes).toBase58();
  } catch { /* the wallet may already return base58 */ }
  return address;
}

export type WalletSession = { address: string; authToken: string };

/** Authorize Seed Vault, Phantom, Solflare, or any other MWA wallet. Caches auth_token. */
export async function authorizeWallet(): Promise<WalletSession> {
  const cached = await loadAuthToken();
  return transact(async (wallet) => {
    const chain = chainId(env.cluster);
    let result;
    if (cached) {
      try { result = await wallet.reauthorize({ auth_token: cached, identity }); }
      catch { result = await wallet.authorize({ identity, chain }); }
    } else {
      result = await wallet.authorize({ identity, chain });
    }
    const authToken = result.auth_token;
    await saveAuthToken(authToken);
    const first = result.accounts[0];
    if (!first) throw new Error("The wallet did not share an account.");
    return { address: toBase58(first.address), authToken };
  });
}

/** Sign the exact server nonce message. The signature is base64, which /api/auth/verify expects. */
export async function signMessage(address: string, message: string): Promise<string> {
  const auth = await loadAuthToken();
  return transact(async (wallet) => {
    const chain = chainId(env.cluster);
    const session = auth
      ? await wallet.reauthorize({ auth_token: auth, identity }).catch(() => wallet.authorize({ identity, chain }))
      : await wallet.authorize({ identity, chain });
    await saveAuthToken(session.auth_token);
    const account = session.accounts[0];
    if (!account) throw new Error("The wallet did not share an account.");
    const signed = await wallet.signMessages({
      addresses: [account.address],
      payloads: [new TextEncoder().encode(message)],
    });
    const sig = signed[0];
    if (!sig || sig.length !== 64) throw new Error("The wallet did not return a signature.");
    if (toBase58(account.address) !== address) throw new Error("Signed with a different account.");
    return Buffer.from(sig).toString("base64");
  });
}

/** User-approved send. Never called without a Confirm card. */
export async function signAndSend(tx: Transaction): Promise<string> {
  const auth = await loadAuthToken();
  return transact(async (wallet) => {
    const chain = chainId(env.cluster);
    const session = auth
      ? await wallet.reauthorize({ auth_token: auth, identity }).catch(() => wallet.authorize({ identity, chain }))
      : await wallet.authorize({ identity, chain });
    await saveAuthToken(session.auth_token);
    const sigs = await wallet.signAndSendTransactions({ transactions: [tx] });
    const sig = sigs[0];
    if (!sig) throw new Error("The wallet did not send the transaction.");
    return sig;
  });
}
