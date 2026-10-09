import { siteFile } from "@/server/tasks/sites";

export const runtime = "nodejs";

/**
 * A published preview of a site an agent built. Served under a sandbox CSP: the page runs in an opaque origin, so its
 * scripts can't read Lexari's cookies or storage, or call Lexari's API as you. Lexari's own headers (next.config.ts)
 * skip /p/ so this policy is the only one.
 */
const SANDBOX = "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

const NOTE = `<div style="position:fixed;left:8px;bottom:8px;z-index:2147483647;font:600 11px/1 system-ui,sans-serif;color:#fff;background:rgba(20,16,32,.78);padding:6px 9px;border-radius:999px;pointer-events:none">Preview made by an AI agent · not a Lexari page</div>`;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path } = await ctx.params;
  const p = (path || []).map((s) => decodeURIComponent(s)).join("/");
  const f = await siteFile(id, p).catch(() => null);
  const head = { "Content-Security-Policy": SANDBOX, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Cross-Origin-Resource-Policy": "same-origin" };
  if (!f) {
    const nf = await siteFile(id, "404.html").catch(() => null);
    return new Response(nf ? new Uint8Array(nf.data) : "Not found", { status: 404, headers: { ...head, "Content-Type": nf ? nf.mime : "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  // Anyone with the link can open a preview on Lexari's domain, so HTML pages carry a small note that it isn't Lexari's own page.
  const body = f.mime.startsWith("text/html") ? Buffer.concat([f.data, Buffer.from(NOTE)]) : f.data;
  return new Response(new Uint8Array(body), { headers: { ...head, "Content-Type": f.mime, "Cache-Control": "public, max-age=60" } });
}
