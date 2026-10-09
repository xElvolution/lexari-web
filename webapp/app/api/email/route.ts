import { unreadByAgent } from "@/server/email/mail";
import { emailDomain, emailMode } from "@/server/email/provider";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Whether agent email is on (live, test mode or off) and each agent's unread count. */
export const GET = withUser(async (user) => {
  const mode = emailMode();
  return Response.json({ mode, domain: emailDomain(), unread: mode === "off" ? {} : await unreadByAgent(user.userId) }, { headers: { "cache-control": "no-store" } });
});
