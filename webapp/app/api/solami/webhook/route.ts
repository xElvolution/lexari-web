import { timingSafeEqual } from "node:crypto";
import { jsonError } from "@/server/http";
import { solamiStatus, type SolamiTransfer } from "@/server/solami";

export const runtime = "nodejs";

/** Solami webhook deliveries (mainnet). Checked with SOLAMI_WEBHOOK_SECRET. MAINNET TODO: map `to` to an agent
 * wallet and write an "incoming" receipt with recordTx (server/txlog.ts). On devnet nothing is registered. */
export async function POST(req: Request) {
  const want = (process.env.SOLAMI_WEBHOOK_SECRET || "").trim();
  const got = new URL(req.url).searchParams.get("secret") || "";
  if (!want || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return jsonError(401, "Bad secret.");
  if (!solamiStatus().on) return Response.json({ ok: true, ignored: "devnet" });
  const raw = await req.text();
  if (raw.length > 200_000) return jsonError(413, "Too big.");
  let events: SolamiTransfer[] = [];
  try { const j = JSON.parse(raw); events = Array.isArray(j) ? j : Array.isArray(j?.events) ? j.events : [j]; } catch { return jsonError(400, "Bad JSON."); }
  console.log(`[solami] ${events.length} transfer event(s)`);
  return Response.json({ ok: true, received: events.length });
}
