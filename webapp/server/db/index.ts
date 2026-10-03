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
    const sql = postgres(url, { max: 1, prepare: false });
    cached = drizzle(sql, { schema });
  }
  return cached;
}
