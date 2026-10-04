import { desktopOn, desktopTicket } from "@/server/desktop";
import { jsonError } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** A short-lived ticket to attach to your own desktop's terminal. Only you can get one for your container. */
export const GET = withUser(async (user) => {
  if (!desktopOn()) return jsonError(503, "Desktops are not set up on this server.");
  return Response.json({ path: "/desktop/ws", ticket: desktopTicket(user.userId) });
});
