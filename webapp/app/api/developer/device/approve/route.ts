import { z } from "zod";
import { withUser } from "@/server/route";
import { readJson } from "@/server/http";
import { decideDevice, deviceInfo, requireDeveloper } from "@/server/market/developers";
import { logEvent, requireStepUp } from "@/server/security";

export const runtime = "nodejs";

/** What you're about to approve (the CLI's label). */
export const GET = withUser(async (user, req) => {
  await requireDeveloper(user.userId);
  const code = new URL(req.url).searchParams.get("code") || "";
  return Response.json(await deviceInfo(code), { headers: { "cache-control": "no-store" } });
});

const body = z.object({ code: z.string().min(8).max(12), approve: z.boolean() }).strict();
/** Approve or deny a CLI login. Approving creates a key, so it needs a fresh step-up. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const d = await requireDeveloper(user.userId);
  if (b.approve) requireStepUp(user, "sign in the Lexari CLI");
  const r = await decideDevice(d.id, b.code, b.approve);
  await logEvent(user, "settings", b.approve ? "Approved a Lexari CLI login" : "Denied a Lexari CLI login");
  return Response.json(r);
});
