import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { serverConnection } from "../rpc";
import { PROGRAM_ID, configPda, decodeConfig } from "@/lib/lexari-ix";

/** The server's shared connection (private RPC when configured, backoff on rate limits). */
export function connection() {
  return serverConnection();
}

/** Many accounts in as few RPC calls as possible (100 per call). */
export async function fetchMany(keys: PublicKey[]): Promise<Map<string, AccountInfo<Buffer> | null>> {
  const out = new Map<string, AccountInfo<Buffer> | null>();
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const infos = await connection().getMultipleAccountsInfo(chunk, "confirmed");
    chunk.forEach((k, j) => out.set(k.toBase58(), infos[j] ?? null));
  }
  return out;
}

let live: { ok: boolean; attestor: string | null; at: number } | null = null;
/** Is the program deployed, and who is the configured attestor. Cached for a minute. */
export async function programStatus() {
  if (live && Date.now() - live.at < 60_000) return live;
  const m = await fetchMany([PROGRAM_ID, configPda()]);
  const prog = m.get(PROGRAM_ID.toBase58());
  const cfg = m.get(configPda().toBase58());
  live = { ok: !!prog?.executable, attestor: cfg ? decodeConfig(cfg.data)?.authority ?? null : null, at: Date.now() };
  return live;
}
export const utcDay = (ms = Date.now()) => Math.floor(ms / 86_400_000);
