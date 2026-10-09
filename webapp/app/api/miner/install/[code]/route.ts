import { rateLimit } from "@/server/http";
import { installScript } from "@/server/miner/hosts";

export const runtime = "nodejs";

/** The one-line install (curl … | sh). One use: the code becomes this server's token. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const text = (s: string, status = 200) => new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (!(await rateLimit(`miner:install:${ip}`, 20, 600_000))) return text("echo 'Lexari: too many tries. Wait a few minutes.' >&2; exit 1\n", 429);
  const s = await installScript(code).catch(() => null);
  if (!s) return text("echo 'Lexari: this install line was already used or expired. Get a fresh one in the ORE Miner > Mining.' >&2; exit 1\n", 410);
  return text(s);
}
