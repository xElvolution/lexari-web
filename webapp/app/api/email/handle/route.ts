import { z } from "zod";
import { chooseHandle, handleAvailable, handleInfo } from "@/server/email/mail";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Your email name (agents are <agent>.<name>@agents.lexari.ai). ?check=name also says whether a name is free. */
export const GET = withUser(async (user, req) => {
  const check = new URL(req.url).searchParams.get("check");
  const info = await handleInfo(user.userId);
  if (check === null) return Response.json(info, { headers: { "cache-control": "no-store" } });
  if (!(await rateLimit(`mail:handle:check:${user.userId}`, 300, 3_600_000))) return jsonError(429, "Slow down a little and try again.");
  const h = check.trim().toLowerCase().slice(0, 40);
  return Response.json({ ...info, check: { handle: h, ...(await handleAvailable(user.userId, h)) } }, { headers: { "cache-control": "no-store" } });
});

/** Choose your email name. Allowed once; every agent's address moves to it. */
export const PUT = withUser(async (user, req) => {
  const b = await readJson(req, z.object({ handle: z.string().trim().min(1).max(40) }).strict());
  if (b instanceof Response) return b;
  if (!(await rateLimit(`mail:handle:set:${user.userId}`, 10, 3_600_000))) return jsonError(429, "Try again later.");
  return Response.json(await chooseHandle(user.userId, b.handle));
});
