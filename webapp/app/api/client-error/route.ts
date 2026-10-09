import { clientIp } from "@/server/http";
import { currentSession } from "@/server/auth/session";

export const runtime = "nodejs";

/** Errors from people's browsers (window.onerror, unhandled rejections, error boundaries), written to the server log. */
const hits = new Map<string, { n: number; at: number }>();
export async function POST(req: Request) {
  const ip = clientIp(req);
  const h = hits.get(ip);
  const now = Date.now();
  if (h && now - h.at < 60_000) { if (++h.n > 20) return new Response(null, { status: 204 }); } else hits.set(ip, { n: 1, at: now });
  if (hits.size > 5000) hits.clear();
  let body: Record<string, unknown> = {};
  try { const raw = await req.text(); if (raw.length < 12_000) body = JSON.parse(raw); } catch {}
  let who = "anon";
  try { const s = await currentSession(); if (s) who = `${s.userId.slice(0, 8)}${s.privyDid ? "/privy" : "/wallet"}`; } catch {}
  const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\r\n]+/g, " ⏎ ").slice(0, n);
  console.error(`[client-error] ${who} ${clip(body.kind, 20)} ${clip(body.message, 400)} | at ${clip(body.url, 160)} | ${clip(body.ua, 160)} | build ${clip(body.build, 20)} | ${clip(body.stack, 1200)}`);
  return new Response(null, { status: 204 });
}
