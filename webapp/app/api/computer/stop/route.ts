import { stopComputer } from "@/server/computer";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Stop button: ends the computer task your agent is running (it replies with where it got to). */
export const POST = withUser(async (user, req) => {
  let convo: string | undefined;
  try { const b = (await req.json()) as { convo?: unknown }; if (typeof b.convo === "string") convo = b.convo.slice(0, 80); } catch {}
  return Response.json({ ok: true, stopped: stopComputer(user.userId, convo) });
});
