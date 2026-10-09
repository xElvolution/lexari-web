import { z } from "zod";
import { BYO_PROVIDERS, MODELS, type ByoProvider } from "@/content/models";
import { modelReady } from "@/server/engram/cortex";
import { accountDefault, addCustom, listCustom } from "@/server/models";
import { secretBoxReady } from "@/server/secretBox";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/** Settings > Models: built-in models (and whether this server can serve them), your own models (masked) and the default. */
export const GET = withUser(async (user) => {
  const [custom, def] = await Promise.all([listCustom(user.userId), accountDefault(user.userId)]);
  return Response.json({
    builtIn: MODELS.map((m) => ({ id: m.id, ready: modelReady(m) })),
    custom, default: def || "lamina", byoReady: secretBoxReady(),
  }, { headers: { "cache-control": "no-store" } });
});

const providers = BYO_PROVIDERS.map((p) => p.id) as [ByoProvider, ...ByoProvider[]];
const body = z.object({
  provider: z.enum(providers),
  model: z.string().trim().min(1).max(120).regex(/^[\w.:\/@+-]+$/, "Model ids use letters, numbers and . : / @ + - _"),
  key: z.string().trim().min(8, "Paste the full API key.").max(400),
  label: z.string().trim().max(40).optional(),
  baseUrl: z.string().trim().max(300).nullable().optional(),
}).strict();

/** Adds a model on your own key. The key is encrypted at once and never sent back. */
export const POST = withUser(async (user, req) => {
  if (!(await rateLimit(`byo:add:${user.userId}`, 20, 3_600_000))) return jsonError(429, "That's a lot of models. Try again later.");
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const model = await addCustom(user.userId, b);
  return Response.json({ model });
});
