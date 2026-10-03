import { sql } from "drizzle-orm";
import { db } from "@/server/db";

export const runtime = "nodejs";

/** Reports which required settings are present. Never returns secret values. */
export async function GET() {
  const dbSet = Boolean(process.env.DATABASE_URL);
  const sessionSet = Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16);
  let dbReachable = false;
  if (dbSet) {
    try {
      await db().execute(sql`select 1`);
      dbReachable = true;
    } catch {
      dbReachable = false;
    }
  }
  return Response.json({
    ok: dbSet && sessionSet && dbReachable,
    databaseUrl: dbSet,
    databaseReachable: dbReachable,
    sessionSecret: sessionSet,
  });
}
