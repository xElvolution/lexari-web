import { desktopOn, listDesktop, readDesktop } from "@/server/desktop";
import { jsonError } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Files in your desktop's home folder (?path=/home/agent/...), or one file's text with ?read=. */
export const GET = withUser(async (user, req) => {
  if (!desktopOn()) return jsonError(503, "Desktops are not set up on this server.");
  const url = new URL(req.url);
  const read = url.searchParams.get("read");
  if (read) return Response.json(await readDesktop(user.userId, read));
  return Response.json(await listDesktop(user.userId, url.searchParams.get("path") || undefined));
});
