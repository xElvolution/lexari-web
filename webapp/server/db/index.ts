import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export class DbMissingError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DbMissingError";
  }
}

type Database = PostgresJsDatabase<typeof schema>;

let cached: Database | null = null;

/** Opens one pooled client. Throws if DATABASE_URL is missing. Does not connect until a query runs. */
export function db(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DbMissingError();
  if (!cached) {
    // The database is a remote pooler (~100ms away): one connection serialized every parallel query, so the Hub took ~5s per call.
    // Neon's pooler drops idle sockets; reusing one gave "[chat] Premature close". Close ours first (20s idle),
    // recycle every 5 minutes, and keep TCP alive.
    const sql = postgres(url, { max: 10, idle_timeout: 20, max_lifetime: 300, connect_timeout: 10, keep_alive: 30, prepare: false });
    cached = drizzle(sql, { schema });
  }
  return cached;
}

/** A dropped pooled connection (safe to retry a read once). */
export const isConnClosed = (e: unknown) => /premature close|CONNECTION_CLOSED|CONNECTION_ENDED|ECONNRESET|connection terminated|write CONNECTION|socket hang up/i.test(`${(e as Error)?.message || ""} ${(e as { code?: string })?.code || ""} ${(e as { cause?: Error })?.cause?.message || ""}`);
/** Runs a read, and once more if the pooled connection had been dropped. */
export async function retryRead<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (e) { if (!isConnClosed(e)) throw e; return run(); }
}
