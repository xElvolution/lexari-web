import { withUser } from "@/server/route";
import { readJson } from "@/server/http";
import { createKey, keyBody, requireDeveloper } from "@/server/market/developers";
import { logEvent, requireStepUp } from "@/server/security";

export const runtime = "nodejs";

/** A new developer key: needs a fresh step-up; the key is in this response only and never shown again. */
export const POST = withUser(async (user, req) => {
  const body = await readJson(req, keyBody);
  if (body instanceof Response) return body;
  const d = await requireDeveloper(user.userId);
  requireStepUp(user, "create a developer key");
  const made = await createKey(d.id, body.name, body.scopes);
  await logEvent(user, "settings", `Created developer key ${made.view.prefix}… (${made.view.scopes.join(", ")})`);
  return Response.json({ key: made.key, view: made.view }, { headers: { "cache-control": "no-store" } });
});
