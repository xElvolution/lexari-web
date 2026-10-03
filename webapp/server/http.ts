import { sql } from "drizzle-orm";
import { z } from "zod";
import { appOrigin, missingConfig } from "./config";
import { db, DbMissingError } from "./db";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status });
}

let warned = "";
/** A friendly 503 when the server is not configured. The missing names go to the server log only. */
export function configError(): string | null {
  const missing = missingConfig();
  if (!missing.length) return null;
  const line = missing.join(", ");
  if (warned !== line) { console.error(`[config] missing: ${line}`); warned = line; }
  return "Lexari is not set up on this server yet. Try again later.";
}

export async function readJson<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.output<S> | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Expected JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError(400, issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid input.");
  }
  return parsed.data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

export function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) return jsonError(error.status, error.message);
  if (error instanceof DbMissingError) { configError(); return jsonError(503, "Lexari is not set up on this server yet. Try again later."); }
  const message = error instanceof Error ? error.message : "";
  console.error(message && !/postgres(ql)?:\/\//.test(message) ? message : "request failed");
  return jsonError(500, "Something went wrong. Try again.");
}

/** Domain and URI for sign-in messages. Production uses the configured origin, never request headers. */
export function requestOrigin(req: Request) {
  const fixed = appOrigin();
  if (fixed) return fixed;
  const host = req.headers.get("host") || "localhost:3001";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return { domain: host, uri: `${proto}://${host}` };
}

/**
 * Client IP for rate limits. Proxy headers are only trusted when TRUST_PROXY says a proxy sets them:
 * TRUST_PROXY=cloudflare uses CF-Connecting-IP, TRUST_PROXY=1 uses X-Real-IP or the last X-Forwarded-For hop.
 */
export function clientIp(req: Request) {
  const mode = (process.env.TRUST_PROXY || "").toLowerCase();
  if (mode === "cloudflare") return req.headers.get("cf-connecting-ip") || "unknown";
  if (mode === "1" || mode === "true" || mode === "nginx") {
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",").pop()!.trim();
  }
  return "direct";
}

/**
 * Fixed-window limit stored in Postgres, so every server process shares it.
 * Returns false when the key is over the limit.
 */
export async function rateLimit(key: string, limit = 30, windowMs = 60_000): Promise<boolean> {
  const secs = Math.max(1, Math.round(windowMs / 1000));
  const rows = await db().execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${secs}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${secs}) then now() else rate_limits.window_start end
    returning count`);
  if (Math.random() < 0.01) void db().execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`).catch(() => {});
  const count = Number((rows as unknown as { count: number }[])[0]?.count ?? 0);
  return count <= limit;
}

/** Security headers on JSON responses are set in next.config; this marks a response uncacheable. */
export const noStore = { "cache-control": "no-store" };
