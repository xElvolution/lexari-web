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
const sql = postgres(url, { max: 1, prepare: false });

try {
  for (const name of files) {
    const body = readFileSync(join(dir, name), "utf8");
    await sql.unsafe(body);
    console.log(`applied ${name}`);
  }
} finally {
  await sql.end();
}
