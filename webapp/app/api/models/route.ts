import { z } from "zod";
import { KEY_PROVIDERS, MODEL_NAME_RE, type KeyProvider } from "@/content/models";
import { accountDefault, addModel, dropModel, getPrefs, listKeys, toggleModel } from "@/server/models";
import { secretBoxReady } from "@/server/secretBox";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Settings > Models: your keys (masked), your model switches and the account default. */
export const GET = withUser(async (user) => {
  const [keys, prefs, def] = await Promise.all([listKeys(user.userId), getPrefs(user.userId), accountDefault(user.userId)]);
  return Response.json({ keys, prefs, default: def || "lamina", byoReady: secretBoxReady() }, { headers: { "cache-control": "no-store" } });
});

const providers = KEY_PROVIDERS.map((p) => p.id) as [KeyProvider, ...KeyProvider[]];
const id = z.string().min(1).max(160);
const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("toggle"), id, on: z.boolean() }).strict(),
  z.object({ op: z.literal("add"), provider: z.enum(providers), model: z.string().trim().min(1).max(120).regex(MODEL_NAME_RE, "Model ids use letters, numbers and . : / @ + - _") }).strict(),
  z.object({ op: z.literal("drop"), id }).strict(),
]);

/** Switch a model on or off, add one by name, or remove one you added. */
export const PATCH = withUser(async (user, req) => {
  if (!(await rateLimit(`models:edit:${user.userId}`, 240, 3_600_000))) return jsonError(429, "That's a lot of changes. Try again in a bit.");
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (b.op === "toggle") await toggleModel(user.userId, b.id, b.on);
  else if (b.op === "add") return Response.json({ ok: true, id: await addModel(user.userId, b.provider, b.model) });
  else await dropModel(user.userId, b.id);
  return Response.json({ ok: true });
});
