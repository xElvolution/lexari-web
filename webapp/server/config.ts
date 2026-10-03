/** Server settings, all from env. See webapp/.env.example. */
export const cluster = () => (process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet");
export const rpcUrl = () => process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC || (cluster() === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");

/** Public origin of the webapp (https://app.lexari.ai). Sign-in messages are bound to it. */
export function appOrigin(): { domain: string; uri: string } | null {
  const raw = process.env.LEXARI_APP_ORIGIN || process.env.NEXT_PUBLIC_WEBAPP_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return { domain: u.host, uri: u.origin };
  } catch {
    return null;
  }
}

/** Where hire payments go. Must match NEXT_PUBLIC_LEXARI_TREASURY on the client. */
export const treasury = () => process.env.LEXARI_TREASURY || process.env.NEXT_PUBLIC_LEXARI_TREASURY || "";
export const usdcMint = () => process.env.NEXT_PUBLIC_USDC_MINT || "";
export const HIRE_LAMPORTS = Number(process.env.NEXT_PUBLIC_HIRE_LAMPORTS || 10_000_000);
export const HIRE_USDC = Number(process.env.NEXT_PUBLIC_HIRE_USDC || 1_000_000);

/** What is missing for the database-backed API. Names are logged, never sent to the browser. */
export function missingConfig(): string[] {
  const out: string[] = [];
  if (!process.env.DATABASE_URL) out.push("DATABASE_URL");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) out.push("SESSION_SECRET");
  if (process.env.NODE_ENV === "production" && !appOrigin()) out.push("NEXT_PUBLIC_WEBAPP_URL");
  return out;
}
