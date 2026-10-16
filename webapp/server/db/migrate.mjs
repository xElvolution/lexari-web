// Applies webapp/server/db/migrations/*.sql in order, once each. Tracks them in schema_migrations.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to webapp/.env.local and run again.");
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  for (const name of files) {
    if (done.has(name)) { console.log(`skip ${name}`); continue; }
    const body = readFileSync(join(dir, name), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${name})`;
    });
    console.log(`applied ${name}`);
  }
  // Network lock (0036_network_lock.sql): stamp this database for LEXARI_NETWORK, or stop when it belongs to the other mode.
  const network = (process.env.LEXARI_NETWORK || "testnet").trim().toLowerCase();
  if (network !== "mainnet" && network !== "testnet") throw new Error(`LEXARI_NETWORK must be mainnet or testnet (got ${network})`);
  await sql`insert into lexari_network (id, network) values (1, ${network}) on conflict (id) do nothing`;
  const [row] = await sql`select network from lexari_network where id = 1`;
  if (row.network !== network) {
    console.error(`This database belongs to ${row.network}; LEXARI_NETWORK is ${network}. Nothing else was changed.`);
    process.exitCode = 1;
  } else console.log(`network ${network}`);
} finally {
  await sql.end();
}
