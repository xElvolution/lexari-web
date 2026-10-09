/**
 * Response headers for both apps.
 *
 * CSP: scripts only from this site (and Privy's sign-in frame and Cloudflare's bot check that Privy uses), no plugins,
 * nobody can frame Lexari (clickjacking), forms and <base> stay on this site, http is upgraded. 'unsafe-inline' is
 * still needed for Next.js's inline bootstrap scripts (a per-request nonce would make every page dynamic); data and
 * websocket connections are allowed to any https/wss host because agents and wallets talk to many RPCs and APIs.
 */
const PRIVY = ["https://auth.privy.io", "https://*.privy.io", "https://*.privy.systems"];
const WALLETCONNECT = ["https://verify.walletconnect.com", "https://verify.walletconnect.org"];
const TURNSTILE = "https://challenges.cloudflare.com";

export function contentSecurityPolicy(app: boolean) {
  const d: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]), ...(app ? [...PRIVY, TURNSTILE] : [])],
    "style-src": ["'self'", "'unsafe-inline'", ...(app ? PRIVY : [])],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": ["'self'", "https:", "wss:"],
    "frame-src": app ? ["'self'", ...PRIVY, ...WALLETCONNECT, TURNSTILE] : ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(d).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ") + "; upgrade-insecure-requests";
}

export const securityHeaders = (mic: boolean) => [
  { key: "Content-Security-Policy", value: process.env.LEXARI_CSP === "off" ? "" : contentSecurityPolicy(mic) },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: `camera=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), microphone=${mic ? "(self)" : "()"}` },
  { key: "Cross-Origin-Opener-Policy", value: mic ? "same-origin-allow-popups" : "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];
