import { FILE_MAX, saveUpload } from "@/server/agentFiles";
import { jsonError, rateLimit } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Upload a file to chat (the raw bytes as the body, the name in x-file-name). It is stored for you and put on your
 * agent's computer in ~/Uploads. Up to LEXARI_FILE_MAX (10 MB).
 */
export const POST = withUser(async (user, req) => {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > FILE_MAX) return jsonError(413, `Files can be up to ${Math.round(FILE_MAX / 1048576)} MB.`);
  if (!(await rateLimit(`upload:${user.userId}`, 30, 3_600_000).catch(() => true))) return jsonError(429, "That's a lot of uploads. Try again in a bit.");
  const name = decodeURIComponent(req.headers.get("x-file-name") || "file").slice(0, 200);
  const convo = (req.headers.get("x-convo") || "").replace(/[^\w-]/g, "").slice(0, 120);
  // read with a hard cap, whatever content-length said
  const reader = req.body?.getReader();
  if (!reader) return jsonError(400, "No file.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > FILE_MAX) { await reader.cancel().catch(() => {}); return jsonError(413, `Files can be up to ${Math.round(FILE_MAX / 1048576)} MB.`); }
    chunks.push(value);
  }
  const file = await saveUpload(user.userId, name, Buffer.concat(chunks), convo);
  return Response.json({ file });
});
