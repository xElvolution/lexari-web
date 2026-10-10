import { api } from "./api";
import type { SavedSession } from "./session";

type Verify = { token?: string; expires?: string };

/** SIWS against the existing nonce + verify routes. Mobile asks for the token in the JSON body. */
export async function signInWithServer(input: { wallet: string; signature: string; message: string; privyToken?: string; email?: string }): Promise<SavedSession> {
  const body: Record<string, string> = { wallet: input.wallet, signature: input.signature, message: input.message };
  if (input.privyToken) body.privyToken = input.privyToken;
  if (input.email) body.email = input.email;
  const res = await api<Verify>("/api/auth/verify?client=mobile", { method: "POST", body: JSON.stringify(body) });
  if (!res.token) {
    throw new Error("Mobile sessions are not on this server yet. The bearer-token change in standalone/mainnet still needs a deploy.");
  }
  return { token: res.token, expires: res.expires || new Date(Date.now() + 30 * 864e5).toISOString(), wallet: input.wallet };
}

export async function nonceFor(wallet: string): Promise<string> {
  const res = await api<{ message: string }>("/api/auth/nonce", { method: "POST", body: JSON.stringify({ wallet }) });
  if (!res.message) throw new Error("Sign-in did not start.");
  return res.message;
}
