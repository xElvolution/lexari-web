import { desktopOn, openInDesktop } from "@/server/desktop";
import { jsonError } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Open a web page in the browser on your own desktop (the address bar above the screen). */
export const POST = withUser(async (user, req) => {
  if (!desktopOn()) return jsonError(503, "Desktops are not set up on this server.");
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  let raw = String(body.url || "").trim().slice(0, 2000);
  if (!raw) return jsonError(400, "Type a web address.");
  if (!/^https?:\/\//i.test(raw)) raw = /\s/.test(raw) || !/\.[a-z]{2,}/i.test(raw) ? `https://duckduckgo.com/?q=${encodeURIComponent(raw)}` : `https://${raw}`;
  let url: URL;
  try { url = new URL(raw); } catch { return jsonError(400, "That is not a web address."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") return jsonError(400, "Only web pages can be opened.");
  await openInDesktop(user.userId, url.toString());
  return Response.json({ ok: true, url: url.toString() });
});
