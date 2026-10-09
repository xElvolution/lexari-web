import { z } from "zod";
import { KEY_PROVIDERS, type KeyProvider } from "@/content/models";
import { recheckKey, removeKey, saveKey, setBaseUrl } from "@/server/models";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
export const maxDuration = 30;
type Ctx = { params: Promise<{ provider: string }> };
const providerOf = async (ctx: Ctx) => { const p = (await ctx.params).provider; return KEY_PROVIDERS.some((x) => x.id === p) ? (p as KeyProvider) : null; };

/** Verify and save: the provider must accept the key before it's stored (encrypted). */
export const PUT = withUser<Ctx>(async (user, req, ctx) => {
  const provider = await providerOf(ctx);
  if (!provider) return jsonError(404, "Unknown provider.");
  const b = await readJson(req, z.object({ key: z.string().trim().min(8, "Paste the full API key.").max(400) }).strict());
  if (b instanceof Response) return b;
  if (!(await rateLimit(`byo:key:${user.userId}`, 30, 3_600_000))) return jsonError(429, "That's a lot of keys. Try again later.");
  return Response.json(await saveKey(user.userId, provider, b.key));
});

/** Verify a saved key again. */
export const POST = withUser<Ctx>(async (user, req, ctx) => {
  const provider = await providerOf(ctx);
  if (!provider) return jsonError(404, "Unknown provider.");
  const b = await readJson(req, z.object({ op: z.literal("verify") }).strict());
  if (b instanceof Response) return b;
  if (!(await rateLimit(`byo:verify:${user.userId}`, 40, 3_600_000))) return jsonError(429, "That's a lot of checks. Try again in a bit.");
  return Response.json({ result: await recheckKey(user.userId, provider) });
});

/** OpenAI only: override the base URL (null turns it off). */
export const PATCH = withUser<Ctx>(async (user, req, ctx) => {
  if ((await providerOf(ctx)) !== "openai") return jsonError(400, "Only the OpenAI key has a base URL override.");
  const b = await readJson(req, z.object({ baseUrl: z.string().trim().max(300).nullable() }).strict());
  if (b instanceof Response) return b;
  if (!(await rateLimit(`byo:base:${user.userId}`, 30, 3_600_000))) return jsonError(429, "That's a lot of changes. Try again later.");
  await setBaseUrl(user.userId, b.baseUrl || null);
  return Response.json({ ok: true });
});

/** Removes the key. Its models leave your list. */
export const DELETE = withUser<Ctx>(async (user, _req, ctx) => {
  const provider = await providerOf(ctx);
  if (!provider) return jsonError(404, "Unknown provider.");
  await removeKey(user.userId, provider);
  return Response.json({ ok: true });
});
