import { NextResponse, type NextRequest } from "next/server";
import { legacyPath } from "./lib/routes";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Defence in depth for the API on top of SameSite=Lax session cookies: a state-changing request
 * from a browser must come from the app's own origin. Requests with no Origin (curl, server jobs) pass.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/")) return legacy(req);
  if (SAFE.has(req.method)) return NextResponse.next();
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  let allowed = "";
  try { allowed = new URL(process.env.LEXARI_APP_ORIGIN || process.env.NEXT_PUBLIC_WEBAPP_URL || "").origin; } catch {}
  const wrongOrigin = process.env.NODE_ENV === "production" && !!origin && !!allowed && origin !== allowed;
  if (site === "cross-site" || wrongOrigin) return NextResponse.json({ error: "Requests must come from the Lexari app." }, { status: 403 });
  return NextResponse.next();
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
