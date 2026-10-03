/** Origins of the two Next.js apps. Override these in production. */
function origin(value: string | undefined, fallback: string) {
  return (value && value.length > 0 ? value : fallback).replace(/\/$/, "");
}

export const LANDING_URL = origin(process.env.NEXT_PUBLIC_LANDING_URL, "http://localhost:3000");
export const WEBAPP_URL = origin(process.env.NEXT_PUBLIC_WEBAPP_URL, "http://localhost:3001");
