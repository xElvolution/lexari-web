/** Shared by the server and the browser: which social accounts can be linked and what linking earns. */
export const SOCIALS = ["twitter", "discord", "telegram"] as const;
export type Social = (typeof SOCIALS)[number];
export const isSocial = (v: unknown): v is Social => typeof v === "string" && (SOCIALS as readonly string[]).includes(v);

export const SOCIAL_NAME: Record<Social, string> = { twitter: "X", discord: "Discord", telegram: "Telegram" };

export type SocialLink = { provider: Social; handle: string | null; verifiedAt: number };

/** Profile status from linked accounts. Verified unlocks the badge and the Hub quest; Trusted needs two. */
export type SocialStatus = { tier: "member" | "verified" | "trusted"; label: string; linked: number; next: string | null };
export function socialStatus(linked: number): SocialStatus {
  if (linked >= 2) return { tier: "trusted", label: "Trusted", linked, next: null };
  if (linked === 1) return { tier: "verified", label: "Verified", linked, next: "Link one more account to become Trusted." };
  return { tier: "member", label: "Member", linked, next: "Link an account to get verified." };
}

/**
 * X and Discord are on whenever Privy is set up (blank or unset means that default). Telegram needs a bot in the
 * Privy dashboard, so it is opt in. "none" turns linking off.
 */
export function enabledSocials(list = process.env.NEXT_PUBLIC_SOCIAL_LINKS): Social[] {
  const raw = (list?.trim() || "twitter,discord").split(",").map((s) => s.trim().toLowerCase());
  return SOCIALS.filter((s) => raw.includes(s));
}

export const SOCIAL_QUEST = { id: "h-social", reward: 150 } as const;
