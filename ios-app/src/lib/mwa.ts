/**
 * iOS has no Mobile Wallet Adapter (it is an Android intent protocol). On iPhone, Solana wallets connect through Privy
 * (embedded wallet, Google, email, Apple) or by linking on app.lexari.ai. These keep the same API as the Android
 * build's mwa.ts so screens compile unchanged; each call explains what to do instead.
 */
import type { Transaction } from "@solana/web3.js";

export type WalletSession = { address: string; authToken: string };
const NO_MWA = "Wallet apps link on app.lexari.ai on iPhone. Use your Lexari wallet here, or link a wallet from the web.";
const fail = (): never => { const e = new Error(NO_MWA); (e as Error & { code?: string }).code = "MWA_UNAVAILABLE"; throw e; };

export const mwaAvailable = false;
export async function authorizeWallet(): Promise<WalletSession> { return fail(); }
export async function signMessage(_address: string, _message: string): Promise<string> { return fail(); }
export async function signMessages(_address: string, _messages: string[]): Promise<string[]> { return fail(); }
export async function signAndSend(_tx: Transaction): Promise<string> { return fail(); }
