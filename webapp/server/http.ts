import { z } from "zod";
import { DbMissingError } from "./db";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

export function configError(): string | null {
  if (!process.env.DATABASE_URL) return "DATABASE_URL is not set";
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) return "SESSION_SECRET is not set";
  return null;
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T | Response> {
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

export function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) return jsonError(error.status, error.message);
  if (error instanceof DbMissingError) return jsonError(503, error.message);
  const message = error instanceof Error ? error.message : "";
  if (message && !message.includes("postgres://") && !message.includes("postgresql://")) {
    console.error(message);
  } else {
    console.error("request failed");
  }
  return jsonError(500, "Something went wrong.");
}

export function requestOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3001";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return { domain: host, uri: `${proto}://${host}` };
}

const hits = new Map<string, { n: number; reset: number }>();

/** Per-process limit. A second server instance has its own window. */
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  row.n += 1;
  return row.n <= limit;
}

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "local";
}
