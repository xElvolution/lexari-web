import { ownFile } from "@/server/agentFiles";
import { jsonError } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

// Only these are ever shown inline; everything else downloads as bytes. No HTML, no SVG, nothing a browser runs.
const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "text/plain; charset=utf-8", "text/csv; charset=utf-8"]);

/** A file from your chats (only yours). ?dl=1 downloads it; otherwise images and text preview inline. */
export const GET = withUser<Ctx>(async (user, req, ctx) => {
  const { id } = await ctx.params;
  const row = await ownFile(user.userId, id);
  if (!row) return jsonError(404, "That file is gone.");
  const dl = new URL(req.url).searchParams.get("dl") === "1";
  const inline = !dl && INLINE.has(row.mime);
  // ?peek=1: the first 4 KB of a text file, for the preview on its card
  const data = !dl && inline && row.mime.startsWith("text/") && new URL(req.url).searchParams.get("peek") === "1" ? row.data.subarray(0, 4096) : row.data;
  const ascii = row.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": inline ? row.mime : row.mime === "application/pdf" ? "application/pdf" : row.mime.startsWith("text/") ? "text/plain; charset=utf-8" : "application/octet-stream",
      "content-length": String(data.length),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "cross-origin-resource-policy": "same-origin",
    },
  });
});
