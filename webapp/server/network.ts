/**
 * Server half of the network mode (lib/network.ts): keeps a mainnet deployment and a testnet deployment from ever
 * sharing a database, secrets or faucet keys.
 *
 *  - networkConfigProblems(): env mistakes that would let the two modes cross (the build was made for one mode and
 *    the server started in the other, a testnet database URL or session secret reused on mainnet, a faucet key on
 *    mainnet, a devnet USDC mint on mainnet). They are reported through missingConfig(), so every API returns the
 *    "not set up" 503 instead of running half configured. Names only; values are never logged.
 *  - checkDatabaseNetwork(): the database carries one row in lexari_network (migration 0036). The first server or
 *    migration to touch it stamps its mode; a server in the other mode refuses to use it.
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { FAUCETS_ENABLED, IS_MAINNET, NETWORK, SOLANA_CLUSTER_FOR_MODE, SOLANA_TOKENS } from "@/lib/network";
import { db } from "./db";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Env problems for this mode, as short descriptions without values. Empty when the server is fine to run. */
export function networkConfigProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  const runtime = (env.LEXARI_NETWORK || "").trim().toLowerCase();
  if (runtime && runtime !== NETWORK) out.push(`LEXARI_NETWORK (server started as ${runtime}, build is ${NETWORK})`);
  const cl = (env.NEXT_PUBLIC_SOLANA_CLUSTER || "").trim();
  if (cl && cl !== SOLANA_CLUSTER_FOR_MODE) out.push(`NEXT_PUBLIC_SOLANA_CLUSTER (must be ${SOLANA_CLUSTER_FOR_MODE} on ${NETWORK})`);
  if (!IS_MAINNET) return out;
  if (!runtime) out.push("LEXARI_NETWORK (must be set to mainnet on a mainnet server)");
  const testDb = (env.LEXARI_TESTNET_DATABASE_URL || "").trim();
  if (testDb && testDb === (env.DATABASE_URL || "").trim()) out.push("DATABASE_URL (same database as testnet)");
  const testSecret = (env.LEXARI_TESTNET_SESSION_SECRET_SHA256 || "").trim().toLowerCase();
  if (testSecret && env.SESSION_SECRET && sha256(env.SESSION_SECRET) === testSecret) out.push("SESSION_SECRET (same as testnet, so agent wallets would be shared)");
  if (!FAUCETS_ENABLED && (env.LEXARI_FAUCET_KEY || "").trim()) out.push("LEXARI_FAUCET_KEY (must not be set on mainnet)");
  const mint = (env.NEXT_PUBLIC_USDC_MINT || "").trim();
  if (mint && mint !== SOLANA_TOKENS.USDC) out.push("NEXT_PUBLIC_USDC_MINT (not mainnet USDC)");
  return out;
}

let dbProblem: string | null = null;
/** Set by checkDatabaseNetwork when the database belongs to the other mode. */
export const databaseNetworkProblem = () => dbProblem;

/**
 * Stamps an unstamped database with this mode, or confirms the stamp matches. Returns the problem (and remembers it
 * for missingConfig) when the database belongs to the other mode. A database without the table yet (migration 0036
 * not applied) is reported too, so a mainnet server never runs on an unchecked database.
 */
export async function checkDatabaseNetwork(): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const d = db();
    await d.execute(sql`insert into lexari_network (id, network) values (1, ${NETWORK}) on conflict (id) do nothing`);
    const rows = (await d.execute(sql`select network from lexari_network where id = 1`)) as unknown as { network: string }[];
    const stamped = rows[0]?.network;
    dbProblem = stamped && stamped !== NETWORK ? `DATABASE_URL (database belongs to ${stamped}, server is ${NETWORK})` : null;
  } catch (e) {
    const m = (e as Error).message || "";
    dbProblem = /lexari_network/.test(m) && /exist/.test(m) ? "DATABASE_URL (run migrations: lexari_network is missing)" : dbProblem;
  }
  if (dbProblem) console.error(`[network] ${dbProblem}`);
  return dbProblem;
}
