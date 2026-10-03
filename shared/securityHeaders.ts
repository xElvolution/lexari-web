/** Response headers for both apps. No CSP yet: Privy and wallet adapters load from several origins. */
export const securityHeaders = (mic: boolean) => [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: `camera=(), geolocation=(), payment=(), microphone=${mic ? "(self)" : "()"}` },
];
