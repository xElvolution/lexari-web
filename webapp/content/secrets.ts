/** Shared shapes for the secrets vault and the secure card in chat (no values ever travel in these). */
export type SecretCard = {
  id: string; name: string; label: string; service: string; why: string; agent: string;
  status: "pending" | "saved" | "cancelled";
};
export type SecretInfo = {
  id: string; name: string; label: string; service: string; last4: string;
  /** agent ids that may use it; empty = every agent */
  agents: string[];
  createdAt: number; updatedAt: number; lastUsedAt: number | null;
};
/** The agent asked the person to take over its desktop (a sign-in page, a CAPTCHA, a 2FA code). */
export type TakeoverCard = { reason: string; site?: string };
