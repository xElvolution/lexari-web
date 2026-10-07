/** Shared by the server and the browser: which social accounts can be linked and what linking earns. */
export const SOCIALS = ["twitter", "discord", "telegram"] as const;
export type Social = (typeof SOCIALS)[number];
export const isSocial = (v: unknown): v is Social => typeof v === "string" && (SOCIALS as readonly string[]).includes(v);

export const SOCIAL_NAME: Record<Social, string> = { twitter: "X", discord: "Discord", telegram: "Telegram" };

export type SocialLink = { provider: Social; handle: string | null; verifiedAt: number };

/**
 * One verified badge: it shows when at least one social account is linked AND the person is on a paid plan (Pro or
 * Max). Linking on any plan still finishes the one-time Verified quest in the Hub.
 */
export type SocialStatus = { badge: boolean; linked: number; paid: boolean; label: string; note: string };
export function socialStatus(linked: number, paid: boolean): SocialStatus {
  if (linked > 0 && paid) return { badge: true, linked, paid, label: "Verified", note: "Your profile shows the verified badge." };
  if (linked > 0) return { badge: false, linked, paid, label: "Linked", note: "Your accounts are linked. The verified badge comes with Pro." };
  return { badge: false, linked, paid, label: "Not linked", note: paid ? "Link an account to get the verified badge on your profile." : "Link an account to show it on your profile. The verified badge comes with Pro." };
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
