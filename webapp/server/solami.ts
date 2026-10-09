/**
 * Solami (solami.dev): live Solana data for the Solami sidetrack. Solami serves MAINNET only, so on devnet everything
 * here reports "waiting for mainnet" and Lexari keeps its normal RPC path. What's wired:
 *  - RPC: server/rpc.ts uses https://rpc.solami.dev/sol?api_key=… on mainnet when SOLAMI_API_KEY is set.
 *  - Webhooks: registerTransferWebhook() asks Solami (POST https://api.solami.dev/data/webhooks, needs the DataApi
 *    permission) to POST transfer events for agent wallets to /api/solami/webhook?secret=SOLAMI_WEBHOOK_SECRET, which
 *    logs incoming transfers as receipts (server/txlog.ts) instead of polling signatures.
 *  - Beam: on mainnet a sendTransaction carrying a tip (>= 100,000 lamports to a Solami tip account) through the
 *    Solami RPC is routed by Beam. MAINNET TODO: add the tip instruction in server/integrations/solana.ts sendIxs.
 * The user must provide: a Solami account and API key with DataApi (SOLAMI_API_KEY), a webhook secret
 * (SOLAMI_WEBHOOK_SECRET), and mainnet (NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta). The sidetrack also wants a public
 * repo with a runnable README and a 2–3 minute live mainnet demo.
 */
import { cluster } from "./rpc";
import { appOrigin } from "./config";

export const solamiKey = () => (process.env.SOLAMI_API_KEY || "").trim();
export function solamiStatus() {
  if (!solamiKey()) return { on: false, why: "No SOLAMI_API_KEY on the server." };
  if (cluster() !== "mainnet-beta") return { on: false, why: "Solami serves Solana mainnet; this server runs devnet." };
  return { on: true, why: "" };
}

/** Registers one webhook for transfer events touching these wallets. Mainnet only. */
export async function registerTransferWebhook(wallets: string[]) {
  const st = solamiStatus();
  if (!st.on) throw new Error(st.why);
  const secret = (process.env.SOLAMI_WEBHOOK_SECRET || "").trim();
  if (!secret) throw new Error("Set SOLAMI_WEBHOOK_SECRET first.");
  const url = `${appOrigin()?.uri}/api/solami/webhook?secret=${encodeURIComponent(secret)}`;
  const r = await fetch("https://api.solami.dev/data/webhooks", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${solamiKey()}` },
    body: JSON.stringify({ chain: "solana", url, filter: { types: ["transfer"], traders: wallets.slice(0, 500) } }), signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Solami answered ${r.status}`);
  return (await r.json()) as { id: string };
}

export type SolamiTransfer = { signature?: string; from?: string; to?: string; trader?: string; amount?: string | number; mint?: string; block_time?: number };
