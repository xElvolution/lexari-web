import { NextResponse, type NextRequest } from "next/server";
import { legacyPath } from "./lib/routes";
import { AGENT_CARDS_ENABLED, DEVELOPER_ALPHA_ENABLED } from "./lib/network";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** The Expo web preview runs on another localhost port, so the browser treats it as a different origin. */
function localPreviewOrigin(origin: string | null) {
  if (!origin || process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

function cors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin");
  if (!localPreviewOrigin(origin)) return res;
  res.headers.set("Access-Control-Allow-Origin", origin!);
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "accept, authorization, content-type, x-lexari-client");
  res.headers.set("Access-Control-Max-Age", "600");
  res.headers.append("Vary", "Origin");
  return res;
}

/**
 * Defence in depth for the API on top of SameSite=Lax session cookies: a state-changing request
 * from a browser must come from the app's own origin. Requests with no Origin (curl, server jobs) pass.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Testnet-only APIs do not exist on a mainnet build: agent test cards and the developer alpha.
  if ((!AGENT_CARDS_ENABLED && /^\/api\/cards(\/|$)/.test(pathname)) || (!DEVELOPER_ALPHA_ENABLED && /^\/api\/developer(\/|$)/.test(pathname))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!pathname.startsWith("/api/")) return legacy(req);
  if (req.method === "OPTIONS" && localPreviewOrigin(req.headers.get("origin"))) return cors(req, new NextResponse(null, { status: 204 }));
  if (SAFE.has(req.method)) return cors(req, NextResponse.next());
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  let allowed = "";
  try { allowed = new URL(process.env.LEXARI_APP_ORIGIN || process.env.NEXT_PUBLIC_WEBAPP_URL || "").origin; } catch {}
  const wrongOrigin = process.env.NODE_ENV === "production" && !!origin && !!allowed && origin !== allowed;
  if (site === "cross-site" || wrongOrigin) return NextResponse.json({ error: "Requests must come from the Lexari app." }, { status: 403 });
  return cors(req, NextResponse.next());
}

function legacy(req: NextRequest) {
  const to = legacyPath(req.nextUrl.pathname, req.nextUrl.searchParams);
  if (!to) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = to;
  url.searchParams.delete("c");
  return NextResponse.redirect(url, 301);
}

export const config = { matcher: ["/api/:path*", "/app", "/app/:path*"] };
