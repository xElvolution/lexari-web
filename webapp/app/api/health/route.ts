import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { missingConfig } from "@/server/config";
import { llmConfig } from "@/server/engram/cortex";
import { programStatus } from "@/server/hub/chain";
import { attestorKeypair } from "@/server/hub/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Readiness, as yes/no flags. Never returns setting names' values or secrets. */
export async function GET() {
  let database = false;
  if (process.env.DATABASE_URL) {
    try { await db().execute(sql`select 1`); database = true; } catch { database = false; }
  }
  let program = false, attestor = false;
  try {
    const st = await programStatus();
    program = st.ok;
    let key: string | null = null;
    try { key = attestorKeypair()?.publicKey.toBase58() ?? null; } catch { key = null; }
    attestor = !!key && st.attestor === key;
  } catch { /* RPC down */ }
  const llm = llmConfig();
  const configured = missingConfig().length === 0;
  return Response.json({ ok: configured && database, configured, database, llm: { provider: llm.provider, ready: llm.ready }, program, attestor }, { headers: { "cache-control": "no-store" } });
}
