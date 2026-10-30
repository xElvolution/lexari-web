/** Where a signed-in phone goes next, like the web: no home agent yet means onboarding first. */
import { api } from "./api";

type MeLite = { agents?: { slug: string }[] };

export async function hasHomeAgent(token: string): Promise<boolean | null> {
  try { const me = await api<MeLite>("/api/me", {}, token); return !!me.agents?.some((a) => a.slug === "home"); }
  catch { return null; }
}

export async function nextAfterSignIn(token: string, o: { securityAsked: boolean; name?: string }): Promise<string> {
  const home = await hasHomeAgent(token);
  const clean = (o.name || "").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 12);
  if (home === false) return `/onboarding${clean ? `?name=${encodeURIComponent(clean)}` : ""}`;
  return o.securityAsked ? "/(tabs)/agents" : "/security-setup";
}
